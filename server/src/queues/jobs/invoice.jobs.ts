import { createHash } from "node:crypto";
import { enqueueDefaultJob } from "../queue.js";

const hashValue = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

export const enqueueInvoicePdfGeneration = async (params: {
  userId: number;
  invoiceId: number;
}) =>
  enqueueDefaultJob({
    jobName: "generateInvoicePDF",
    data: params,
    jobId: `invoice:${params.userId}:${params.invoiceId}:pdf`,
  });

export const enqueueInvoiceEmailDelivery = async (params: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
}) =>
  enqueueDefaultJob({
    jobName: "sendInvoiceEmail",
    data: params,
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
}) =>
  enqueueDefaultJob({
    jobName: "sendInvoiceReminderEmail",
    data: params,
    jobId: `invoice:${params.userId}:${params.invoiceId}:reminder:${hashValue(
      params.requestedEmail?.trim().toLowerCase() || "customer",
    )}`,
  });
