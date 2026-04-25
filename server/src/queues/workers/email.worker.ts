import {
  deliverInvoiceEmail,
  deliverInvoiceReminderEmail,
} from "../../modules/invoice/invoiceEmail.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const emailJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  "sendInvoiceEmail" | "sendInvoiceReminderEmail"
> = {
  sendInvoiceEmail: async (job) =>
    deliverInvoiceEmail({
      userId: job.data.userId,
      invoiceId: job.data.invoiceId,
      requestedEmail: job.data.requestedEmail,
    }),
  sendInvoiceReminderEmail: async (job) =>
    deliverInvoiceReminderEmail({
      userId: job.data.userId,
      invoiceId: job.data.invoiceId,
      requestedEmail: job.data.requestedEmail,
    }),
};
