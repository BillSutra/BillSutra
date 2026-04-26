import { buildDeleteAccountConfirmationEmail } from "./templates/delete-account-confirmation.js";
import { buildDeleteDataConfirmationEmail } from "./templates/delete-data-confirmation.js";
import { buildExportReadyEmail } from "./templates/export-ready.js";
import { buildInvoiceReminderEmail } from "./templates/invoice-reminder.js";
import { buildInvoiceSentEmail } from "./templates/invoice-sent.js";
import { buildLowStockAlertEmail } from "./templates/low-stock-alert.js";
import { buildMonthlySalesReportEmail } from "./templates/monthly-sales-report.js";
import { buildOtpLoginEmail } from "./templates/otp-login.js";
import { buildPasswordResetEmail } from "./templates/password-reset.js";
import { buildPaymentAccessApprovedEmail } from "./templates/payment-access-approved.js";
import { buildPaymentReceivedEmail } from "./templates/payment-received.js";
import { buildVerifyEmailEmail } from "./templates/verify-email.js";
import { buildWeeklyReportEmail } from "./templates/weekly-report.js";
import { buildWelcomeEmail } from "./templates/welcome.js";
import type {
  EmailMessage,
  EmailTemplateDataMap,
  EmailType,
} from "./types.js";
import { sendEmail as sendWithMailService } from "../services/mailService.js";
import type { MailAttachment } from "../services/mailService.js";
import {
  createPendingEmailLog,
  markEmailLogFailed,
  markEmailLogSent,
  type EmailAuditContext,
} from "../services/emailLog.service.js";

const DEFAULT_FROM_EMAIL = "BillSutra <no-reply@billsutra.com>";

const templateBuilders = {
  welcome: buildWelcomeEmail,
  verify_email: buildVerifyEmailEmail,
  password_reset: buildPasswordResetEmail,
  otp_login: buildOtpLoginEmail,
  invoice_sent: buildInvoiceSentEmail,
  invoice_reminder: buildInvoiceReminderEmail,
  payment_received: buildPaymentReceivedEmail,
  export_ready: buildExportReadyEmail,
  delete_data_confirmation: buildDeleteDataConfirmationEmail,
  delete_account_confirmation: buildDeleteAccountConfirmationEmail,
  payment_access_approved: buildPaymentAccessApprovedEmail,
  monthly_sales_report: buildMonthlySalesReportEmail,
  weekly_report: buildWeeklyReportEmail,
  low_stock_alert: buildLowStockAlertEmail,
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
    audit?: EmailAuditContext;
  },
) => {
  const message = buildMessage(type, payload);
  const to = Array.isArray(message.to) ? message.to : [message.to];
  const attachments = [
    ...(message.attachments ?? []),
    ...(options?.attachments ?? []),
  ];
  let emailLog: { id: string } | null = null;
  try {
    emailLog = await createPendingEmailLog({
      type,
      recipientEmail: to[0] ?? "",
      subject: message.subject,
      audit: options?.audit,
    });
  } catch (error) {
    console.warn("[email] log create failed", {
      type,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
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

    if (emailLog?.id) {
      await markEmailLogSent({
        logId: emailLog.id,
        providerMessageId: result.messageId ?? null,
      }).catch((error) => {
        console.warn("[email] log sent update failed", {
          type,
          logId: emailLog.id,
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }

    console.info("[email] sent", {
      type,
      to,
      id: result.messageId ?? null,
      provider: result.provider,
    });

    return result;
  } catch (error) {
    if (emailLog?.id) {
      await markEmailLogFailed({
        logId: emailLog.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch((logError) => {
        console.warn("[email] log failure update failed", {
          type,
          logId: emailLog.id,
          message:
            logError instanceof Error ? logError.message : String(logError),
        });
      });
    }

    throw error;
  }
};

export type { EmailType, EmailTemplateDataMap } from "./types.js";
