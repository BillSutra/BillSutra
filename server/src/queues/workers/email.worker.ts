import {
  deliverInvoiceEmail,
  deliverInvoiceReminderEmail,
} from "../../modules/invoice/invoiceEmail.service.js";
import {
  sendMonthlyReportEmail,
  sendPlanApprovedEmail,
  sendWelcomeEmail,
} from "../../services/email.service.js";
import { sendVerificationEmail } from "../../services/emailVerification.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const emailJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  | "sendInvoiceEmail"
  | "sendInvoiceReminderEmail"
  | "sendWelcomeEmail"
  | "sendEmailVerificationEmail"
  | "sendPlanApprovedEmail"
  | "sendMonthlySalesReportEmail"
> = {
  sendWelcomeEmail: async (job) =>
    sendWelcomeEmail({
      userId: job.data.userId,
    }),
  sendEmailVerificationEmail: async (job) =>
    sendVerificationEmail({
      userId: job.data.userId,
      rawToken: job.data.rawToken,
    }),
  sendPlanApprovedEmail: async (job) =>
    sendPlanApprovedEmail({
      paymentId: job.data.paymentId,
    }),
  sendMonthlySalesReportEmail: async (job) =>
    sendMonthlyReportEmail({
      userId: job.data.userId,
      monthKey: job.data.monthKey,
    }),
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
