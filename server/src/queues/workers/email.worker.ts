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
import {
  sendLowStockAlertEmail,
  sendPaymentReceivedEmail,
  sendWeeklyReportEmail,
} from "../../services/notificationEmail.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const emailJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  | "sendInvoiceEmail"
  | "sendInvoiceReminderEmail"
  | "sendWelcomeEmail"
  | "sendEmailVerificationEmail"
  | "sendPlanApprovedEmail"
  | "sendMonthlySalesReportEmail"
  | "sendPaymentReceivedEmail"
  | "sendWeeklyReportEmail"
  | "sendLowStockAlertEmail"
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
  sendPaymentReceivedEmail: async (job) =>
    sendPaymentReceivedEmail({
      paymentId: job.data.paymentId,
    }),
  sendWeeklyReportEmail: async (job) =>
    sendWeeklyReportEmail({
      userId: job.data.userId,
      weekKey: job.data.weekKey,
    }),
  sendLowStockAlertEmail: async (job) =>
    sendLowStockAlertEmail({
      userId: job.data.userId,
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
      reminderStage: job.data.reminderStage,
      daysUntilDue: job.data.daysUntilDue,
    }),
};
