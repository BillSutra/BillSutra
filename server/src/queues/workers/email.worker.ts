import {
  deliverInvoiceEmail,
  deliverInvoiceReminderEmail,
} from "../../modules/invoice/invoiceEmail.service.js";
import {
  sendMonthlyReportEmail,
  sendPlanApprovedEmail,
  sendWelcomeEmail,
} from "../../services/email.service.js";
import { sendFreshVerificationEmail } from "../../services/emailVerification.service.js";
import {
  sendLowStockAlertEmail,
  sendPaymentReceivedEmail,
  sendWeeklyReportEmail,
} from "../../services/notificationEmail.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const emailJobHandlers: Pick<
  AppQueueJobHandlerMap,
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
      userId: job.data.context.userId as number,
    }),
  sendEmailVerificationEmail: async (job) =>
    sendFreshVerificationEmail({
      userId: job.data.context.userId as number,
      reason: job.data.payload.reason,
    }),
  sendPlanApprovedEmail: async (job) =>
    sendPlanApprovedEmail({
      paymentId: job.data.payload.paymentId,
    }),
  sendMonthlySalesReportEmail: async (job) =>
    sendMonthlyReportEmail({
      userId: job.data.context.userId as number,
      monthKey: job.data.payload.monthKey,
    }),
  sendPaymentReceivedEmail: async (job) =>
    sendPaymentReceivedEmail({
      paymentId: job.data.payload.paymentId,
    }),
  sendWeeklyReportEmail: async (job) =>
    sendWeeklyReportEmail({
      userId: job.data.context.userId as number,
      weekKey: job.data.payload.weekKey,
    }),
  sendLowStockAlertEmail: async (job) =>
    sendLowStockAlertEmail({
      userId: job.data.context.userId as number,
    }),
  sendInvoiceEmail: async (job) =>
    deliverInvoiceEmail({
      userId: job.data.context.userId as number,
      invoiceId: job.data.payload.invoiceId,
      requestedEmail: job.data.payload.requestedEmail,
    }),
  sendInvoiceReminderEmail: async (job) =>
    deliverInvoiceReminderEmail({
      userId: job.data.context.userId as number,
      invoiceId: job.data.payload.invoiceId,
      requestedEmail: job.data.payload.requestedEmail,
      reminderStage: job.data.payload.reminderStage,
      daysUntilDue: job.data.payload.daysUntilDue,
    }),
};
