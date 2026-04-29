import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { AccessPaymentStatus } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sendEmail } from "../emails/index.js";
import { buildLoginUrl, getFrontendAppUrl } from "../lib/appUrls.js";
import { PRIVATE_EXPORTS_ROOT } from "../lib/uploadPaths.js";
import type { ExportPayload } from "../modules/export/export.service.js";
import {
  enqueueMonthlySalesReportEmail,
  enqueuePlanApprovedEmail,
  enqueueWelcomeEmail,
} from "../queues/jobs/email.jobs.js";
import type { AppQueueContextInput } from "../queues/types.js";
import { computeInvoicePaymentSnapshotFromPayments } from "../utils/invoicePaymentSnapshot.js";
import {
  buildSecureFileUrl,
  registerUploadedFile,
} from "./uploadedFiles.service.js";

const DEFAULT_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const parsedAttachmentMaxBytes = Number(
  process.env.EMAIL_ATTACHMENT_MAX_BYTES ?? DEFAULT_ATTACHMENT_MAX_BYTES,
);
const EXPORT_EMAIL_ATTACHMENT_MAX_BYTES =
  Number.isFinite(parsedAttachmentMaxBytes) && parsedAttachmentMaxBytes > 0
    ? parsedAttachmentMaxBytes
    : DEFAULT_ATTACHMENT_MAX_BYTES;

const planNameMap: Record<string, string> = {
  pro: "Pro",
  "pro-plus": "Pro Plus",
};

const getPreviousMonthWindow = (reference = new Date()) => {
  const currentMonthStart = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1),
  );
  const previousMonthStart = new Date(currentMonthStart);
  previousMonthStart.setUTCMonth(previousMonthStart.getUTCMonth() - 1);

  return {
    start: previousMonthStart,
    endExclusive: currentMonthStart,
  };
};

const parseMonthKey = (monthKey: string) => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const endExclusive = new Date(Date.UTC(year, monthIndex + 1, 1));

  return { start, endExclusive };
};

export const resolveMonthlyReportWindow = (monthKey?: string) => {
  const resolved = monthKey ? parseMonthKey(monthKey) : null;
  const { start, endExclusive } = resolved ?? getPreviousMonthWindow();

  return {
    start,
    endExclusive,
    monthKey: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
    label: start.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
};

const getUserRecipient = async (userId: number) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      deleted_at: true,
    },
  });

const persistExportForSecureDownload = async (params: {
  userId: number;
  fileName: string;
  contentType: string;
  content: Buffer;
}) => {
  const safeFileName = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const userDir = path.join(PRIVATE_EXPORTS_ROOT, String(params.userId));
  await fs.mkdir(userDir, { recursive: true });

  const absoluteFilePath = path.join(
    userDir,
    `${crypto.randomUUID()}-${safeFileName}`,
  );
  await fs.writeFile(absoluteFilePath, params.content);

  const uploadedFile = await registerUploadedFile({
    ownerUserId: params.userId,
    fileName: params.fileName,
    originalName: params.fileName,
    filePath: absoluteFilePath,
    type: "export",
    mimeType: params.contentType,
  });

  if (!uploadedFile) {
    await fs.unlink(absoluteFilePath).catch(() => undefined);
    return null;
  }

  return buildSecureFileUrl(uploadedFile.id);
};

const buildMonthlyReport = async (userId: number, monthKey?: string) => {
  const window = resolveMonthlyReportWindow(monthKey);
  const now = window.endExclusive;

  const [
    invoiceStats,
    paymentsStats,
    purchaseStats,
    saleStats,
    purchasePayments,
    reportInvoices,
  ] = await Promise.all([
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
      _count: { id: true },
      _sum: { total: true },
    }),
    prisma.sale.aggregate({
      where: {
        user_id: userId,
        sale_date: { gte: window.start, lt: window.endExclusive },
      },
      _count: { id: true },
      _sum: { total: true },
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        purchase_date: { gte: window.start, lt: window.endExclusive },
      },
      select: {
        total: true,
        totalAmount: true,
        paidAmount: true,
        paymentStatus: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        user_id: userId,
        date: { gte: window.start, lt: window.endExclusive },
      },
      select: {
        total: true,
        status: true,
        due_date: true,
        payments: {
          where: { paid_at: { lt: window.endExclusive } },
          select: { amount: true },
        },
      },
    }),
  ]);

  const overdueCount = reportInvoices.reduce((count, invoice) => {
    const snapshot = computeInvoicePaymentSnapshotFromPayments({
      total: invoice.total,
      status: invoice.status,
      dueDate: invoice.due_date,
      payments: invoice.payments,
      now,
    });

    return snapshot.isOverdue ? count + 1 : count;
  }, 0);

  const realizedPurchaseSpend = purchasePayments.reduce((sum, purchase) => {
    const totalAmount = Number(purchase.totalAmount ?? purchase.total ?? 0);
    if (purchase.paymentStatus === "PAID") {
      return sum + Math.max(totalAmount, 0);
    }

    if (purchase.paymentStatus === "PARTIALLY_PAID") {
      return sum + Math.max(Number(purchase.paidAmount ?? 0), 0);
    }

    return sum;
  }, 0);

  return {
    monthKey: window.monthKey,
    label: window.label,
    invoicesIssued: invoiceStats._count.id,
    totalBilled: Number(invoiceStats._sum.total ?? 0),
    totalCollected: Number(paymentsStats._sum.amount ?? 0),
    salesCount: saleStats._count.id,
    totalSales: Number(saleStats._sum.total ?? 0),
    purchasesCount: purchaseStats._count.id,
    totalPurchases: Number(purchaseStats._sum.total ?? 0),
    profit: Number(paymentsStats._sum.amount ?? 0) - realizedPurchaseSpend,
    overdueCount,
  };
};

export const sendWelcomeEmail = async ({ userId }: { userId: number }) => {
  const user = await getUserRecipient(userId);
  if (!user || user.deleted_at || !user.email.trim()) {
    return null;
  }

  return sendEmail("welcome", {
    email: user.email,
    user_name: user.name,
    login_url: buildLoginUrl(user.email),
  }, {
    audit: {
      userId: user.id,
      metadata: {
        flow: "welcome",
      },
    },
  });
};

export const sendPlanApprovedEmail = async ({
  paymentId,
}: {
  paymentId: string;
}) => {
  const payment = await prisma.accessPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      user_id: true,
      plan_id: true,
      amount: true,
      status: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (
    !payment ||
    !payment.user.email?.trim() ||
    (payment.status !== AccessPaymentStatus.APPROVED &&
      payment.status !== AccessPaymentStatus.SUCCESS)
  ) {
    return null;
  }

  return sendEmail("payment_access_approved", {
    email: payment.user.email,
    user_name: payment.user.name,
    plan_name: planNameMap[payment.plan_id] ?? payment.plan_id,
    amount: Number(payment.amount),
    status_page_url: `${getFrontendAppUrl()}/payments`,
  }, {
    audit: {
      userId: payment.user_id,
      metadata: {
        flow: "plan_approved",
        paymentId: payment.id,
      },
    },
  });
};

export const sendMonthlyReportEmail = async ({
  userId,
  monthKey,
}: {
  userId: number;
  monthKey?: string;
}) => {
  const user = await getUserRecipient(userId);
  if (!user || user.deleted_at || !user.email.trim()) {
    return null;
  }

  const report = await buildMonthlyReport(user.id, monthKey);

  return sendEmail("monthly_sales_report", {
    email: user.email,
    user_name: user.name,
    report_month_label: report.label,
    invoices_issued: report.invoicesIssued,
    total_billed: report.totalBilled,
    total_collected: report.totalCollected,
    sales_count: report.salesCount,
    total_sales: report.totalSales,
    purchases_count: report.purchasesCount,
    total_purchases: report.totalPurchases,
    profit: report.profit,
    overdue_count: report.overdueCount,
    reports_url: `${getFrontendAppUrl()}/reports`,
  }, {
    audit: {
      userId: user.id,
      metadata: {
        flow: "monthly_sales_report",
        monthKey: report.monthKey,
      },
    },
  });
};

export const sendExportEmail = async (params: {
  userId: number;
  recipientEmail: string;
  recipientName: string;
  fileName: string;
  contentType: string;
  content: Buffer;
  payload: ExportPayload;
  exportedCount: number;
}) => {
  let downloadUrl: string | null = null;
  const shouldAttach =
    params.content.length <= EXPORT_EMAIL_ATTACHMENT_MAX_BYTES;

  if (!shouldAttach) {
    try {
      downloadUrl = await persistExportForSecureDownload({
        userId: params.userId,
        fileName: params.fileName,
        contentType: params.contentType,
        content: params.content,
      });
    } catch (error) {
      console.warn("[email] export secure link preparation failed", {
        userId: params.userId,
        fileName: params.fileName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const attachment =
    shouldAttach || !downloadUrl
      ? {
          filename: params.fileName,
          content: params.content,
          contentType: params.contentType,
        }
      : undefined;

  return sendEmail("export_ready", {
    email: params.recipientEmail,
    user_name: params.recipientName,
    resource: params.payload.resource,
    format: params.payload.format,
    exported_count: params.exportedCount,
    file_name: params.fileName,
    attachment,
    download_url: downloadUrl,
  }, {
    audit: {
      userId: params.userId,
      metadata: {
        flow: "export_ready",
        resource: params.payload.resource,
        format: params.payload.format,
        exportedCount: params.exportedCount,
      },
    },
  });
};

const dispatchWithFallback = async (
  emailType: "welcome" | "plan_approved" | "monthly_report",
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

export const dispatchWelcomeEmail = async (userId: number) =>
  dispatchWithFallback(
    "welcome",
    enqueueWelcomeEmail({
      userId,
      context: {
        userId,
        metadata: {
          flow: "welcome",
        },
      },
    }),
    () => sendWelcomeEmail({ userId }),
    { userId },
  );

export const dispatchPlanApprovedEmail = async (paymentId: string) =>
  dispatchWithFallback(
    "plan_approved",
    enqueuePlanApprovedEmail({
      paymentId,
      context: {
        metadata: {
          flow: "plan_approved",
          paymentId,
        },
      },
    }),
    () => sendPlanApprovedEmail({ paymentId }),
    { paymentId },
  );

export const dispatchMonthlySalesReportEmail = async (
  userId: number,
  monthKey?: string,
  context?: AppQueueContextInput,
) => {
  const reportWindow = resolveMonthlyReportWindow(monthKey);

  return dispatchWithFallback(
    "monthly_report",
    enqueueMonthlySalesReportEmail({
      userId,
      monthKey: reportWindow.monthKey,
      context: {
        userId,
        ...context,
        metadata: {
          ...(context?.metadata ?? {}),
          flow: "monthly_sales_report",
          monthKey: reportWindow.monthKey,
        },
      },
    }),
    () =>
      sendMonthlyReportEmail({
        userId,
        monthKey: reportWindow.monthKey,
      }),
    {
      userId,
      monthKey: reportWindow.monthKey,
    },
  );
};
