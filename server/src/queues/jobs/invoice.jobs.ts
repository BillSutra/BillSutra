import { createHash } from "node:crypto";
import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

const hashValue = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

export const enqueueInvoicePdfGeneration = async (params: {
  userId: number;
  invoiceId: number;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "generateInvoicePDF",
    payload: {
      invoiceId: params.invoiceId,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        invoiceId: params.invoiceId,
        task: "invoice_pdf_generation",
      },
    },
    jobId: `invoice:${params.userId}:${params.invoiceId}:pdf`,
  });

export const enqueueInvoiceEmailDelivery = async (params: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendInvoiceEmail",
    payload: {
      invoiceId: params.invoiceId,
      requestedEmail: params.requestedEmail,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        invoiceId: params.invoiceId,
        task: "invoice_email_delivery",
        recipientHash: hashValue(
          params.requestedEmail?.trim().toLowerCase() || "customer",
        ),
      },
    },
    jobId: `invoice:${params.userId}:${params.invoiceId}:email:${hashValue(
      params.requestedEmail?.trim().toLowerCase() || "customer",
    )}`,
  });

export const enqueueInvoiceReminderDelivery = async (params: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
  reminderStage?: "upcoming" | "due_today" | "overdue" | "manual";
  daysUntilDue?: number | null;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sendInvoiceReminderEmail",
    payload: {
      invoiceId: params.invoiceId,
      requestedEmail: params.requestedEmail,
      reminderStage: params.reminderStage,
      daysUntilDue: params.daysUntilDue,
    },
    context: {
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        invoiceId: params.invoiceId,
        task: "invoice_reminder_delivery",
        reminderStage: params.reminderStage ?? "manual",
        recipientHash: hashValue(
          params.requestedEmail?.trim().toLowerCase() || "customer",
        ),
      },
    },
    jobId: `invoice:${params.userId}:${params.invoiceId}:reminder:${hashValue(
      `${params.reminderStage ?? "manual"}:${params.requestedEmail?.trim().toLowerCase() || "customer"}`,
    )}`,
  });
