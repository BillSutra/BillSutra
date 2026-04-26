import { buildDeleteAccountConfirmationEmail } from "./templates/delete-account-confirmation.js";
import { buildDeleteDataConfirmationEmail } from "./templates/delete-data-confirmation.js";
import { buildExportReadyEmail } from "./templates/export-ready.js";
import { buildInvoiceReminderEmail } from "./templates/invoice-reminder.js";
import { buildInvoiceSentEmail } from "./templates/invoice-sent.js";
import { buildMonthlySalesReportEmail } from "./templates/monthly-sales-report.js";
import { buildOtpLoginEmail } from "./templates/otp-login.js";
import { buildPasswordResetEmail } from "./templates/password-reset.js";
import { buildPaymentAccessApprovedEmail } from "./templates/payment-access-approved.js";
import { buildVerifyEmailEmail } from "./templates/verify-email.js";
import { buildWelcomeEmail } from "./templates/welcome.js";
import type {
  EmailMessage,
  EmailTemplateDataMap,
  EmailType,
} from "./types.js";
import { sendEmail as sendWithMailService } from "../services/mailService.js";
import type { MailAttachment } from "../services/mailService.js";

const DEFAULT_FROM_EMAIL = "BillSutra <no-reply@billsutra.com>";

const templateBuilders = {
  welcome: buildWelcomeEmail,
  verify_email: buildVerifyEmailEmail,
  password_reset: buildPasswordResetEmail,
  otp_login: buildOtpLoginEmail,
  invoice_sent: buildInvoiceSentEmail,
  invoice_reminder: buildInvoiceReminderEmail,
  export_ready: buildExportReadyEmail,
  delete_data_confirmation: buildDeleteDataConfirmationEmail,
  delete_account_confirmation: buildDeleteAccountConfirmationEmail,
  payment_access_approved: buildPaymentAccessApprovedEmail,
  monthly_sales_report: buildMonthlySalesReportEmail,
} satisfies {
  [K in EmailType]: (payload: EmailTemplateDataMap[K]) => EmailMessage;
};

const buildMessage = <T extends EmailType>(
  type: T,
  payload: EmailTemplateDataMap[T],
) => templateBuilders[type](payload as never);

export const sendEmail = async <T extends EmailType>(
  type: T,
  payload: EmailTemplateDataMap[T],
  options?: {
    attachments?: MailAttachment[];
    replyTo?: string | string[];
  },
) => {
  const message = buildMessage(type, payload);
  const to = Array.isArray(message.to) ? message.to : [message.to];
  const attachments = [
    ...(message.attachments ?? []),
    ...(options?.attachments ?? []),
  ];

  const result = await sendWithMailService({
    from: process.env.EMAIL_FROM?.trim() || DEFAULT_FROM_EMAIL,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    replyTo: options?.replyTo ?? message.replyTo,
    attachments: attachments.length > 0 ? attachments : undefined,
  });

  if (!result.success) {
    throw new Error(result.error?.message || "Unable to send email.");
  }

  console.info("[email] sent", {
    type,
    to,
    id: result.messageId ?? null,
    provider: result.provider,
  });

  return result;
};

export type { EmailType, EmailTemplateDataMap } from "./types.js";
