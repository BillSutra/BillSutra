import type { Job } from "bullmq";
import type { AppNotificationType } from "../services/notification.service.js";
import type { ExportPayload } from "../modules/export/export.service.js";

export type AppQueueName =
  | "emails"
  | "documents"
  | "exports"
  | "notifications"
  | "maintenance"
  | "analytics";

export type AppQueuePriority = "critical" | "normal" | "low";

export type QueueContextMetadataValue =
  | string
  | number
  | boolean
  | null;

export type QueueContextMetadata = Record<
  string,
  QueueContextMetadataValue | undefined
>;

export type AppQueueJobContext = {
  businessId: string | null;
  userId: number | null;
  actorId: string | null;
  correlationId: string;
  metadata: QueueContextMetadata;
};

export type AppQueueContextInput = Partial<
  Omit<AppQueueJobContext, "correlationId" | "metadata">
> & {
  correlationId?: string | null;
  metadata?: QueueContextMetadata;
};

export type AppQueueJobEnvelope<TPayload> = {
  version: 1;
  queuedAt: string;
  context: AppQueueJobContext;
  payload: TPayload;
};

export type GenerateInvoicePdfJobPayload = {
  invoiceId: number;
};

export type SendInvoiceEmailJobPayload = {
  invoiceId: number;
  requestedEmail?: string | null;
};

export type SendInvoiceReminderJobPayload = {
  invoiceId: number;
  requestedEmail?: string | null;
  reminderStage?: "upcoming" | "due_today" | "overdue" | "manual";
  daysUntilDue?: number | null;
};

export type SendWelcomeEmailJobPayload = Record<string, never>;

export type SendEmailVerificationEmailJobPayload = {
  reason?: "signup" | "manual";
};

export type SendPlanApprovedEmailJobPayload = {
  paymentId: string;
};

export type SendMonthlySalesReportEmailJobPayload = {
  monthKey: string;
};

export type SendPaymentReceivedEmailJobPayload = {
  paymentId: number;
};

export type SendWeeklyReportEmailJobPayload = {
  weekKey: string;
};

export type SendLowStockAlertEmailJobPayload = Record<string, never>;

export type SendExportEmailJobPayload = {
  email: string;
  payload: ExportPayload;
};

export type SanitizeInventoryJobPayload = {
  productId: number;
  warehouseId?: number | null;
  triggeredBy: "invoice" | "sale" | "manual";
  referenceId?: number | string | null;
};

export type CreateNotificationJobPayload = {
  businessId: string;
  type: AppNotificationType;
  message: string;
  referenceKey?: string | null;
};

export type RefreshAnalyticsWindowJobPayload = {
  startDate: string;
  endDate: string;
  source?: string | null;
};

export type AppQueueJobPayloadMap = {
  generateInvoicePDF: GenerateInvoicePdfJobPayload;
  sendInvoiceEmail: SendInvoiceEmailJobPayload;
  sendInvoiceReminderEmail: SendInvoiceReminderJobPayload;
  sendWelcomeEmail: SendWelcomeEmailJobPayload;
  sendEmailVerificationEmail: SendEmailVerificationEmailJobPayload;
  sendPlanApprovedEmail: SendPlanApprovedEmailJobPayload;
  sendMonthlySalesReportEmail: SendMonthlySalesReportEmailJobPayload;
  sendPaymentReceivedEmail: SendPaymentReceivedEmailJobPayload;
  sendWeeklyReportEmail: SendWeeklyReportEmailJobPayload;
  sendLowStockAlertEmail: SendLowStockAlertEmailJobPayload;
  sendExportEmail: SendExportEmailJobPayload;
  sanitizeInventory: SanitizeInventoryJobPayload;
  createNotification: CreateNotificationJobPayload;
  refreshAnalyticsWindow: RefreshAnalyticsWindowJobPayload;
};

export type AppQueueJobName = keyof AppQueueJobPayloadMap;

export type AppQueueJobEnvelopeMap = {
  [TName in AppQueueJobName]: AppQueueJobEnvelope<AppQueueJobPayloadMap[TName]>;
};

export type AppQueueJobNameByQueue = {
  emails:
    | "sendInvoiceEmail"
    | "sendInvoiceReminderEmail"
    | "sendWelcomeEmail"
    | "sendEmailVerificationEmail"
    | "sendPlanApprovedEmail"
    | "sendMonthlySalesReportEmail"
    | "sendPaymentReceivedEmail"
    | "sendWeeklyReportEmail"
    | "sendLowStockAlertEmail";
  documents: "generateInvoicePDF";
  exports: "sendExportEmail";
  notifications: "createNotification";
  maintenance: "sanitizeInventory";
  analytics: "refreshAnalyticsWindow";
};

export type AppQueueJob<
  TName extends AppQueueJobName = AppQueueJobName,
> = Job<AppQueueJobEnvelopeMap[TName], unknown, TName>;

export type AppQueueJobHandler<TName extends AppQueueJobName> = (
  job: AppQueueJob<TName>,
) => Promise<unknown>;

export type AppQueueJobHandlerMap = {
  [TName in AppQueueJobName]: AppQueueJobHandler<TName>;
};

export type AppQueueDefinition = {
  concurrency: number;
  priority: AppQueuePriority;
  defaultAttempts: number;
  defaultBackoffMs: number;
  removeOnComplete: number;
  removeOnFail: number;
  limiter?: {
    max: number;
    duration: number;
  };
};

export const APP_QUEUE_JOB_TO_QUEUE: Record<AppQueueJobName, AppQueueName> = {
  generateInvoicePDF: "documents",
  sendInvoiceEmail: "emails",
  sendInvoiceReminderEmail: "emails",
  sendWelcomeEmail: "emails",
  sendEmailVerificationEmail: "emails",
  sendPlanApprovedEmail: "emails",
  sendMonthlySalesReportEmail: "emails",
  sendPaymentReceivedEmail: "emails",
  sendWeeklyReportEmail: "emails",
  sendLowStockAlertEmail: "emails",
  sendExportEmail: "exports",
  sanitizeInventory: "maintenance",
  createNotification: "notifications",
  refreshAnalyticsWindow: "analytics",
};

export const APP_QUEUE_DEFINITIONS: Record<AppQueueName, AppQueueDefinition> = {
  emails: {
    concurrency: Number(process.env.EMAIL_QUEUE_CONCURRENCY ?? 3),
    priority: "critical",
    defaultAttempts: Number(process.env.EMAIL_QUEUE_ATTEMPTS ?? 5),
    defaultBackoffMs: Number(process.env.EMAIL_QUEUE_BACKOFF_MS ?? 10_000),
    removeOnComplete: Number(process.env.EMAIL_QUEUE_REMOVE_ON_COMPLETE ?? 200),
    removeOnFail: Number(process.env.EMAIL_QUEUE_REMOVE_ON_FAIL ?? 500),
    limiter: {
      max: Number(process.env.EMAIL_QUEUE_RATE_LIMIT_MAX ?? 20),
      duration: Number(process.env.EMAIL_QUEUE_RATE_LIMIT_DURATION_MS ?? 60_000),
    },
  },
  documents: {
    concurrency: Number(process.env.DOCUMENT_QUEUE_CONCURRENCY ?? 2),
    priority: "normal",
    defaultAttempts: Number(process.env.DOCUMENT_QUEUE_ATTEMPTS ?? 3),
    defaultBackoffMs: Number(process.env.DOCUMENT_QUEUE_BACKOFF_MS ?? 7_500),
    removeOnComplete: Number(
      process.env.DOCUMENT_QUEUE_REMOVE_ON_COMPLETE ?? 100,
    ),
    removeOnFail: Number(process.env.DOCUMENT_QUEUE_REMOVE_ON_FAIL ?? 250),
  },
  exports: {
    concurrency: Number(process.env.EXPORT_QUEUE_CONCURRENCY ?? 2),
    priority: "normal",
    defaultAttempts: Number(process.env.EXPORT_QUEUE_ATTEMPTS ?? 4),
    defaultBackoffMs: Number(process.env.EXPORT_QUEUE_BACKOFF_MS ?? 15_000),
    removeOnComplete: Number(process.env.EXPORT_QUEUE_REMOVE_ON_COMPLETE ?? 100),
    removeOnFail: Number(process.env.EXPORT_QUEUE_REMOVE_ON_FAIL ?? 250),
  },
  notifications: {
    concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY ?? 6),
    priority: "normal",
    defaultAttempts: Number(process.env.NOTIFICATION_QUEUE_ATTEMPTS ?? 4),
    defaultBackoffMs: Number(
      process.env.NOTIFICATION_QUEUE_BACKOFF_MS ?? 5_000,
    ),
    removeOnComplete: Number(
      process.env.NOTIFICATION_QUEUE_REMOVE_ON_COMPLETE ?? 200,
    ),
    removeOnFail: Number(process.env.NOTIFICATION_QUEUE_REMOVE_ON_FAIL ?? 300),
  },
  maintenance: {
    concurrency: Number(process.env.MAINTENANCE_QUEUE_CONCURRENCY ?? 2),
    priority: "low",
    defaultAttempts: Number(process.env.MAINTENANCE_QUEUE_ATTEMPTS ?? 4),
    defaultBackoffMs: Number(
      process.env.MAINTENANCE_QUEUE_BACKOFF_MS ?? 20_000,
    ),
    removeOnComplete: Number(
      process.env.MAINTENANCE_QUEUE_REMOVE_ON_COMPLETE ?? 100,
    ),
    removeOnFail: Number(process.env.MAINTENANCE_QUEUE_REMOVE_ON_FAIL ?? 300),
  },
  analytics: {
    concurrency: Number(process.env.ANALYTICS_QUEUE_CONCURRENCY ?? 1),
    priority: "low",
    defaultAttempts: Number(process.env.ANALYTICS_QUEUE_ATTEMPTS ?? 3),
    defaultBackoffMs: Number(process.env.ANALYTICS_QUEUE_BACKOFF_MS ?? 30_000),
    removeOnComplete: Number(
      process.env.ANALYTICS_QUEUE_REMOVE_ON_COMPLETE ?? 100,
    ),
    removeOnFail: Number(process.env.ANALYTICS_QUEUE_REMOVE_ON_FAIL ?? 300),
  },
};

export const APP_QUEUE_NAMES = Object.keys(APP_QUEUE_DEFINITIONS) as AppQueueName[];

export type AppQueueJobStatus =
  | "queued"
  | "active"
  | "completed"
  | "failed";

export type AppQueueJobStatusRecord = {
  jobId: string;
  queueName: AppQueueName;
  jobName: AppQueueJobName;
  status: AppQueueJobStatus;
  queuedAt: string;
  updatedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  attemptsMade: number;
  businessId: string | null;
  userId: number | null;
  actorId: string | null;
  correlationId: string;
  metadata: QueueContextMetadata;
  result?: unknown;
  error?: {
    message: string;
  } | null;
};
