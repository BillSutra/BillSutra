import type { Job } from "bullmq";
import type { AppNotificationType } from "../services/notification.service.js";
import type { ExportPayload } from "../modules/export/export.service.js";

export type GenerateInvoicePdfJobData = {
  userId: number;
  invoiceId: number;
};

export type SendInvoiceEmailJobData = {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
};

export type SendInvoiceReminderJobData = {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
};

export type SendWelcomeEmailJobData = {
  userId: number;
};

export type SendEmailVerificationEmailJobData = {
  userId: number;
  rawToken: string;
};

export type SendPlanApprovedEmailJobData = {
  paymentId: string;
};

export type SendMonthlySalesReportEmailJobData = {
  userId: number;
  monthKey: string;
};

export type SendExportEmailJobData = {
  userId: number;
  actorId?: string;
  email: string;
  payload: ExportPayload;
};

export type CreateNotificationJobData = {
  userId: number;
  businessId: string;
  type: AppNotificationType;
  message: string;
  referenceKey?: string | null;
};

export type DefaultQueueJobDataMap = {
  generateInvoicePDF: GenerateInvoicePdfJobData;
  sendInvoiceEmail: SendInvoiceEmailJobData;
  sendInvoiceReminderEmail: SendInvoiceReminderJobData;
  sendWelcomeEmail: SendWelcomeEmailJobData;
  sendEmailVerificationEmail: SendEmailVerificationEmailJobData;
  sendPlanApprovedEmail: SendPlanApprovedEmailJobData;
  sendMonthlySalesReportEmail: SendMonthlySalesReportEmailJobData;
  sendExportEmail: SendExportEmailJobData;
  createNotification: CreateNotificationJobData;
};

export type DefaultQueueJobName = keyof DefaultQueueJobDataMap;

export type DefaultQueueJob<TName extends DefaultQueueJobName = DefaultQueueJobName> =
  Job<DefaultQueueJobDataMap[TName], unknown, TName>;

export type DefaultQueueJobHandler<TName extends DefaultQueueJobName> = (
  job: DefaultQueueJob<TName>,
) => Promise<unknown>;

export type DefaultQueueJobHandlerMap = {
  [TName in DefaultQueueJobName]: DefaultQueueJobHandler<TName>;
};
