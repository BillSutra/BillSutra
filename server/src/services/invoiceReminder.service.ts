import prisma from "../config/db.config.js";
import { enqueueInvoiceReminderDelivery } from "../queues/jobs/invoice.jobs.js";
import { hasSuccessfulEmailLogSince } from "./emailLog.service.js";
import { deliverInvoiceReminderEmail } from "../modules/invoice/invoiceEmail.service.js";
import { computeInvoicePaymentSnapshotFromPayments } from "../utils/invoicePaymentSnapshot.js";

type ReminderStage = "upcoming" | "due_today" | "overdue" | "manual";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getStartOfUtcDay = (value = new Date()) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

const differenceInUtcDays = (left: Date, right: Date) =>
  Math.round(
    (getStartOfUtcDay(left).getTime() - getStartOfUtcDay(right).getTime()) /
      DAY_IN_MS,
  );

export const parseReminderOffsets = (rawValue?: string | null) => {
  const raw = rawValue?.trim() || "1,3,7";
  const values = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => left - right);

  return values.length > 0 ? Array.from(new Set(values)) : [1, 3, 7];
};

const dispatchInvoiceReminderWithFallback = async (params: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
  reminderStage: ReminderStage;
  daysUntilDue?: number | null;
}) => {
  let queued:
    | ({ queued: boolean } & Record<string, unknown>)
    | { queued: false; reason: "enqueue_error" };

  try {
    queued = await enqueueInvoiceReminderDelivery(params);
  } catch (error) {
    console.warn("[email] invoice reminder enqueue attempt failed", {
      userId: params.userId,
      invoiceId: params.invoiceId,
      reminderStage: params.reminderStage,
      message: error instanceof Error ? error.message : String(error),
    });
    queued = { queued: false, reason: "enqueue_error" };
  }

  if (queued.queued) {
    return queued;
  }

  try {
    await deliverInvoiceReminderEmail(params);
  } catch (error) {
    console.warn("[email] invoice reminder fallback failed", {
      userId: params.userId,
      invoiceId: params.invoiceId,
      reminderStage: params.reminderStage,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return queued;
};

export const runInvoiceReminderSweep = async () => {
  const now = new Date();
  const dayStart = getStartOfUtcDay(now);

  const invoices = await prisma.invoice.findMany({
    where: {
      due_date: { not: null },
      status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
      user: {
        is: {
          deleted_at: null,
        },
      },
      customer: {
        is: {
          email: { not: null },
        },
      },
    },
    select: {
      id: true,
      user_id: true,
      customer_id: true,
      due_date: true,
      total: true,
      status: true,
      customer: {
        select: {
          email: true,
        },
      },
      payments: {
        select: {
          amount: true,
          paid_at: true,
        },
      },
      user: {
        select: {
          preferences: {
            select: {
              email_payment_reminders_enabled: true,
              email_payment_reminder_offsets: true,
            },
          },
        },
      },
    },
  });

  let scheduled = 0;
  let skipped = 0;

  for (const invoice of invoices) {
    const customerEmail = invoice.customer.email?.trim();
    if (!customerEmail) {
      skipped += 1;
      continue;
    }

    const preferences = invoice.user.preferences;
    if (preferences?.email_payment_reminders_enabled === false) {
      skipped += 1;
      continue;
    }

    const paymentSnapshot = computeInvoicePaymentSnapshotFromPayments({
      total: invoice.total,
      status: invoice.status,
      dueDate: invoice.due_date,
      payments: invoice.payments,
      now,
    });

    if (paymentSnapshot.paymentStatus === "PAID") {
      skipped += 1;
      continue;
    }

    const dueDate = invoice.due_date;
    if (!dueDate) {
      skipped += 1;
      continue;
    }

    const sentToday = await hasSuccessfulEmailLogSince({
      type: "invoice_reminder",
      invoiceId: invoice.id,
      since: dayStart,
    });
    if (sentToday) {
      skipped += 1;
      continue;
    }

    const daysUntilDue = differenceInUtcDays(dueDate, now);
    const offsets = parseReminderOffsets(
      preferences?.email_payment_reminder_offsets,
    );

    let reminderStage: ReminderStage | null = null;
    if (daysUntilDue < 0) {
      reminderStage = "overdue";
    } else if (daysUntilDue === 0) {
      reminderStage = "due_today";
    } else if (offsets.includes(daysUntilDue)) {
      reminderStage = "upcoming";
    }

    if (!reminderStage) {
      skipped += 1;
      continue;
    }

    await dispatchInvoiceReminderWithFallback({
      userId: invoice.user_id,
      invoiceId: invoice.id,
      requestedEmail: customerEmail,
      reminderStage,
      daysUntilDue,
    });
    scheduled += 1;
  }

  return {
    scheduled,
    skipped,
    scanned: invoices.length,
  };
};
