import { Resend } from "resend";
import { buildDeleteAccountConfirmationEmail } from "./templates/delete-account-confirmation.js";
import { buildDeleteDataConfirmationEmail } from "./templates/delete-data-confirmation.js";
import { buildExportReadyEmail } from "./templates/export-ready.js";
import { buildInvoiceReminderEmail } from "./templates/invoice-reminder.js";
import { buildInvoiceSentEmail } from "./templates/invoice-sent.js";
import { buildOtpLoginEmail } from "./templates/otp-login.js";
import { buildPasswordResetEmail } from "./templates/password-reset.js";
import { buildWelcomeEmail } from "./templates/welcome.js";
import type {
  EmailMessage,
  EmailTemplateDataMap,
  EmailType,
} from "./types.js";

const DEFAULT_FROM_EMAIL = "BillSutra <onboarding@resend.dev>";

let resendClient: Resend | null = null;

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
};

const templateBuilders = {
  welcome: buildWelcomeEmail,
  password_reset: buildPasswordResetEmail,
  otp_login: buildOtpLoginEmail,
  invoice_sent: buildInvoiceSentEmail,
  invoice_reminder: buildInvoiceReminderEmail,
  export_ready: buildExportReadyEmail,
  delete_data_confirmation: buildDeleteDataConfirmationEmail,
  delete_account_confirmation: buildDeleteAccountConfirmationEmail,
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
) => {
  const message = buildMessage(type, payload);
  const to = Array.isArray(message.to) ? message.to : [message.to];

  try {
    const resend = getResendClient();
    const response = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      replyTo: message.replyTo,
      attachments: message.attachments,
    });

    if (response.error) {
      console.error("[email] send failed", {
        type,
        to,
        error: response.error,
      });
      throw new Error(response.error.message);
    }

    console.info("[email] sent", {
      type,
      to,
      id: response.data?.id ?? null,
    });

    return response.data;
  } catch (error) {
    console.error("[email] send failed", {
      type,
      to,
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
};

export type { EmailType, EmailTemplateDataMap } from "./types.js";
