import prisma from "../config/db.config.js";
import { sendEmail } from "../emails/index.js";
import { getFrontendAppUrl, buildPublicInvoiceUrl } from "../lib/appUrls.js";
import { getInventoryInsights } from "./inventoryInsights.service.js";
import {
  enqueueLowStockAlertEmail,
  enqueuePaymentReceivedEmail,
  enqueueWeeklyReportEmail,
} from "../queues/jobs/email.jobs.js";
import type { AppQueueContextInput } from "../queues/types.js";
import { hasSuccessfulEmailLogSince } from "./emailLog.service.js";

const getStartOfUtcDay = (value = new Date()) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

const toWeekKey = (value: Date) => value.toISOString().slice(0, 10);

const getPreviousWeekWindow = (reference = new Date()) => {
  const endExclusive = getStartOfUtcDay(reference);
  const start = new Date(endExclusive);
  start.setUTCDate(start.getUTCDate() - 7);

  return {
    start,
    endExclusive,
    weekKey: toWeekKey(start),
    label: `${start.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })} - ${new Date(endExclusive.getTime() - 1).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })}`,
  };
};

const parseWeekKey = (weekKey: string) => {
  const trimmed = weekKey.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }

  const start = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const endExclusive = new Date(start);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);

  return {
    start,
    endExclusive,
    weekKey: toWeekKey(start),
    label: `${start.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })} - ${new Date(endExclusive.getTime() - 1).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })}`,
  };
};

export const resolveWeeklyReportWindow = (weekKey?: string) =>
  (weekKey ? parseWeekKey(weekKey) : null) ?? getPreviousWeekWindow();

const dispatchWithFallback = async (
  emailType: string,
  queueAttempt: Promise<{ queued: boolean } & Record<string, unknown>>,
  fallback: () => Promise<unknown>,
  logContext: Record<string, unknown>,
) => {
  let queued:
    | ({ queued: boolean } & Record<string, unknown>)
    | { queued: false; reason: "enqueue_error" };

  try {
    queued = await queueAttempt;
  } catch (error) {
    console.warn("[email] queue enqueue attempt failed", {
      emailType,
      ...logContext,
      message: error instanceof Error ? error.message : String(error),
    });
    queued = { queued: false, reason: "enqueue_error" };
  }

  if (queued.queued) {
    return queued;
  }

  try {
    await fallback();
  } catch (error) {
    console.warn("[email] queued delivery fallback failed", {
      emailType,
      ...logContext,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return queued;
};

export const sendPaymentReceivedEmail = async ({
  paymentId,
}: {
  paymentId: number;
}) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      user_id: true,
      invoice_id: true,
      amount: true,
      method: true,
      paid_at: true,
      invoice: {
        select: {
          id: true,
          invoice_number: true,
          total: true,
          customer_id: true,
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payments: {
            select: {
              amount: true,
            },
          },
        },
      },
      user: {
        select: {
          business_profile: {
            select: {
              business_name: true,
              logo_url: true,
              currency: true,
            },
          },
        },
      },
    },
  });

  const recipientEmail = payment?.invoice.customer?.email?.trim();
  if (!payment || !recipientEmail) {
    return null;
  }

  const invoiceTotal = Number(payment.invoice.total ?? 0);
  const totalPaid = payment.invoice.payments.reduce(
    (sum, entry) => sum + Number(entry.amount ?? 0),
    0,
  );
  const amountOutstanding = Math.max(invoiceTotal - totalPaid, 0);
  const businessProfile = payment.user.business_profile;

  return sendEmail(
    "payment_received",
    {
      email: recipientEmail,
      customer_name: payment.invoice.customer?.name ?? "Customer",
      invoice_id: payment.invoice.invoice_number,
      amount_received: Number(payment.amount ?? 0),
      total_amount: invoiceTotal,
      amount_outstanding: amountOutstanding,
      paid_at: payment.paid_at,
      payment_method: payment.method,
      business_name: businessProfile?.business_name ?? "BillSutra",
      business_logo_url: businessProfile?.logo_url ?? null,
      invoice_url: buildPublicInvoiceUrl(
        payment.invoice.id,
        payment.invoice.invoice_number,
      ),
      currency: businessProfile?.currency ?? "INR",
    },
    {
      audit: {
        userId: payment.user_id,
        invoiceId: payment.invoice_id,
        customerId: payment.invoice.customer_id,
        metadata: {
          flow: "payment_received",
          paymentId: payment.id,
          invoiceNumber: payment.invoice.invoice_number,
        },
      },
    },
  );
};

export const dispatchPaymentReceivedEmail = async (paymentId: number) =>
  dispatchWithFallback(
    "payment_received",
    enqueuePaymentReceivedEmail({
      paymentId,
      context: {
        metadata: {
          flow: "payment_received",
          paymentId,
        },
      },
    }),
    () => sendPaymentReceivedEmail({ paymentId }),
    { paymentId },
  );

const buildWeeklyReport = async (userId: number, weekKey?: string) => {
  const window = resolveWeeklyReportWindow(weekKey);

  const [user, invoiceStats, paymentsStats, purchaseStats, invoiceRows] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          deleted_at: true,
          preferences: {
            select: {
              email_weekly_reports_enabled: true,
            },
          },
        },
      }),
      prisma.invoice.aggregate({
        where: {
          user_id: userId,
          date: { gte: window.start, lt: window.endExclusive },
        },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.payment.aggregate({
        where: {
          user_id: userId,
          paid_at: { gte: window.start, lt: window.endExclusive },
        },
        _sum: { amount: true },
      }),
      prisma.purchase.aggregate({
        where: {
          user_id: userId,
          purchase_date: { gte: window.start, lt: window.endExclusive },
        },
        _sum: { paidAmount: true },
      }),
      prisma.invoice.findMany({
        where: {
          user_id: userId,
          status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        },
        select: {
          total: true,
          status: true,
          payments: {
            select: { amount: true },
          },
        },
      }),
    ]);

  if (
    !user ||
    user.deleted_at ||
    !user.email.trim() ||
    user.preferences?.email_weekly_reports_enabled === false
  ) {
    return null;
  }

  const totalBilled = Number(invoiceStats._sum.total ?? 0);
  const totalCollected = Number(paymentsStats._sum.amount ?? 0);
  const pendingAmount = invoiceRows.reduce((sum, invoice) => {
    const paid = invoice.payments.reduce(
      (paymentSum, payment) => paymentSum + Number(payment.amount ?? 0),
      0,
    );
    return sum + Math.max(Number(invoice.total ?? 0) - paid, 0);
  }, 0);
  const realizedPurchaseSpend = Number(purchaseStats._sum.paidAmount ?? 0);

  return {
    user,
    window,
    report: {
      invoicesIssued: invoiceStats._count.id,
      totalBilled,
      totalCollected,
      pendingAmount,
      profit: totalCollected - realizedPurchaseSpend,
      overdueCount: invoiceRows.filter((invoice) => invoice.status === "OVERDUE")
        .length,
    },
  };
};

export const sendWeeklyReportEmail = async ({
  userId,
  weekKey,
}: {
  userId: number;
  weekKey?: string;
}) => {
  const payload = await buildWeeklyReport(userId, weekKey);
  if (!payload) {
    return null;
  }

  return sendEmail(
    "weekly_report",
    {
      email: payload.user.email,
      user_name: payload.user.name,
      report_week_label: payload.window.label,
      invoices_issued: payload.report.invoicesIssued,
      total_billed: payload.report.totalBilled,
      total_collected: payload.report.totalCollected,
      pending_amount: payload.report.pendingAmount,
      profit: payload.report.profit,
      overdue_count: payload.report.overdueCount,
      reports_url: `${getFrontendAppUrl()}/reports`,
    },
    {
      audit: {
        userId: payload.user.id,
        metadata: {
          flow: "weekly_report",
          weekKey: payload.window.weekKey,
        },
      },
    },
  );
};

export const dispatchWeeklyReportEmail = async (
  userId: number,
  weekKey?: string,
  context?: AppQueueContextInput,
) => {
  const window = resolveWeeklyReportWindow(weekKey);

  return dispatchWithFallback(
    "weekly_report",
    enqueueWeeklyReportEmail({
      userId,
      weekKey: window.weekKey,
      context: {
        userId,
        ...context,
        metadata: {
          ...(context?.metadata ?? {}),
          flow: "weekly_report",
          weekKey: window.weekKey,
        },
      },
    }),
    () => sendWeeklyReportEmail({ userId, weekKey: window.weekKey }),
    { userId, weekKey: window.weekKey },
  );
};

export const sendLowStockAlertEmail = async ({ userId }: { userId: number }) => {
  const [user, businessProfile, insightsPayload] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        deleted_at: true,
        preferences: {
          select: {
            email_low_stock_alerts_enabled: true,
          },
        },
      },
    }),
    prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: {
        business_name: true,
        logo_url: true,
      },
    }),
    getInventoryInsights(userId, { useCache: false }),
  ]);

  if (
    !user ||
    user.deleted_at ||
    !user.email.trim() ||
    user.preferences?.email_low_stock_alerts_enabled === false
  ) {
    return null;
  }

  const actionableInsights = insightsPayload.insights
    .filter((item) => item.severity === "critical" || item.severity === "warning")
    .slice(0, 6);

  if (actionableInsights.length === 0) {
    return null;
  }

  return sendEmail(
    "low_stock_alert",
    {
      email: user.email,
      user_name: user.name,
      business_name: businessProfile?.business_name ?? "BillSutra",
      business_logo_url: businessProfile?.logo_url ?? null,
      inventory_url: `${getFrontendAppUrl()}/products`,
      insights: actionableInsights.map((item) => ({
        product_name: item.productName,
        stock_left: item.stockLeft,
        threshold: item.threshold ?? null,
        severity: item.severity,
        warehouse_name: item.warehouseName ?? null,
        suggested_quantity: item.suggestedQuantity ?? null,
      })),
    },
    {
      audit: {
        userId: user.id,
        metadata: {
          flow: "low_stock_alert",
          insightCount: actionableInsights.length,
        },
      },
    },
  );
};

export const dispatchLowStockAlertEmail = async (userId: number) =>
  dispatchWithFallback(
    "low_stock_alert",
    enqueueLowStockAlertEmail({
      userId,
      context: {
        userId,
        metadata: {
          flow: "low_stock_alert",
        },
      },
    }),
    () => sendLowStockAlertEmail({ userId }),
    { userId },
  );

export const hasWeeklyReportBeenSent = async (params: {
  userId: number;
  weekKey?: string;
}) => {
  const window = resolveWeeklyReportWindow(params.weekKey);
  return hasSuccessfulEmailLogSince({
    type: "weekly_report",
    userId: params.userId,
    since: window.start,
  });
};

export const hasLowStockAlertBeenSentToday = async (userId: number) =>
  hasSuccessfulEmailLogSince({
    type: "low_stock_alert",
    userId,
    since: getStartOfUtcDay(),
  });
