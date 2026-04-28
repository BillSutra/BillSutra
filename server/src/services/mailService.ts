import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import {
  buildInvoiceEmailTemplate,
  buildOtpEmailTemplate,
  buildPaymentSuccessTemplate,
  buildPlanActivationTemplate,
  type InvoiceTemplateData,
  type OtpTemplateData,
  type PaymentSuccessTemplateData,
  type PlanActivationTemplateData,
} from "../templates/mail/index.js";

export type MailAttachment = NonNullable<SendMailOptions["attachments"]>[number];

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
  replyTo?: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
};

export type SendEmailResult = {
  success: boolean;
  provider: "gmail-smtp";
  messageId?: string;
  accepted: string[];
  rejected: string[];
  response?: string;
  error?: {
    code: string;
    message: string;
  };
};

export type MailTemplateName =
  | "invoice"
  | "otp"
  | "payment_success"
  | "plan_activation";

type MailTemplateDataMap = {
  invoice: InvoiceTemplateData;
  otp: OtpTemplateData;
  payment_success: PaymentSuccessTemplateData;
  plan_activation: PlanActivationTemplateData;
};

type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

const MAIL_LOG_PREFIX = "[mailService]";
const DEFAULT_SMTP_HOST = "smtp.gmail.com";
const DEFAULT_SMTP_PORT = 465;

let transporterPromise: Transporter | null = null;
let transporterVerified = false;

const getFromAddress = () => {
  const user = process.env.EMAIL_USER?.trim();
  const fromName = process.env.EMAIL_FROM_NAME?.trim() || "BillSutra";
  const fromEmail = process.env.EMAIL_FROM?.trim() || user;

  return fromEmail ? `${fromName} <${fromEmail}>` : undefined;
};

const getTransporter = (): Transporter => {
  if (transporterPromise) {
    return transporterPromise;
  }

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!user || !pass) {
    throw new Error("EMAIL_USER and EMAIL_PASS must be configured.");
  }

  transporterPromise = nodemailer.createTransport({
    host: process.env.EMAIL_HOST?.trim() || DEFAULT_SMTP_HOST,
    port: Number(process.env.EMAIL_PORT ?? DEFAULT_SMTP_PORT),
    secure: process.env.EMAIL_SECURE
      ? process.env.EMAIL_SECURE === "true"
      : true,
    auth: {
      user,
      pass,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporterPromise;
};

const ensureTransporterReady = async () => {
  const transporter = getTransporter();

  if (!transporterVerified) {
    await transporter.verify();
    transporterVerified = true;
  }

  return transporter;
};

const normalizeRecipients = (value: string | string[] | undefined) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const toStructuredError = (error: unknown) => {
  if (error instanceof Error) {
    const mailError = error as Error & { code?: string };
    return {
      code: mailError.code || "MAIL_SEND_FAILED",
      message: mailError.message,
    };
  }

  return {
    code: "MAIL_SEND_FAILED",
    message: "Unknown mail transport error.",
  };
};

const templateRenderers: {
  [K in MailTemplateName]: (data: MailTemplateDataMap[K]) => RenderedTemplate;
} = {
  invoice: buildInvoiceEmailTemplate,
  otp: buildOtpEmailTemplate,
  payment_success: buildPaymentSuccessTemplate,
  plan_activation: buildPlanActivationTemplate,
};

export const renderMailTemplate = <T extends MailTemplateName>(
  template: T,
  data: MailTemplateDataMap[T],
) => {
  return templateRenderers[template](data);
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  attachments,
  replyTo,
  cc,
  bcc,
  from,
}: SendEmailInput): Promise<SendEmailResult> => {
  try {
    const transporter = await ensureTransporterReady();
    const info = await transporter.sendMail({
      from: from || getFromAddress(),
      to,
      subject,
      html,
      text,
      attachments,
      replyTo,
      cc,
      bcc,
    });

    console.info(`${MAIL_LOG_PREFIX} sent`, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      envelope: info.envelope,
    });

    return {
      success: true,
      provider: "gmail-smtp",
      messageId: info.messageId,
      accepted: normalizeRecipients(info.accepted as string[]),
      rejected: normalizeRecipients(info.rejected as string[]),
      response: info.response,
    };
  } catch (error) {
    const structuredError = toStructuredError(error);

    console.error(`${MAIL_LOG_PREFIX} send failed`, {
      error: structuredError,
      to,
      subject,
      hasAttachments: Boolean(attachments?.length),
    });

    return {
      success: false,
      provider: "gmail-smtp",
      accepted: [],
      rejected: [],
      error: structuredError,
    };
  }
};

export const createPdfAttachment = (
  fileName: string,
  content: Buffer,
): MailAttachment => ({
  filename: fileName.toLowerCase().endsWith(".pdf") ? fileName : `${fileName}.pdf`,
  content,
  contentType: "application/pdf",
});

export const sendTemplateEmail = async <T extends MailTemplateName>({
  template,
  to,
  data,
  attachments,
  subject,
}: {
  template: T;
  to: string | string[];
  data: MailTemplateDataMap[T];
  attachments?: MailAttachment[];
  subject?: string;
}) => {
  const rendered = renderMailTemplate(template, data);

  return sendEmail({
    to,
    subject: subject || rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments,
  });
};

export const sendInvoiceEmailWithPdf = async ({
  to,
  data,
  pdfBuffer,
  pdfFileName,
}: {
  to: string | string[];
  data: InvoiceTemplateData;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
}) => {
  return sendTemplateEmail({
    template: "invoice",
    to,
    data,
    attachments:
      pdfBuffer && pdfBuffer.length > 0
        ? [createPdfAttachment(pdfFileName || `${data.invoiceId}.pdf`, pdfBuffer)]
        : undefined,
  });
};

export const sendOtpEmail = async ({
  to,
  data,
}: {
  to: string | string[];
  data: OtpTemplateData;
}) =>
  sendTemplateEmail({
    template: "otp",
    to,
    data,
  });

export const sendPaymentSuccessEmail = async ({
  to,
  data,
}: {
  to: string | string[];
  data: PaymentSuccessTemplateData;
}) =>
  sendTemplateEmail({
    template: "payment_success",
    to,
    data,
  });

export const sendPlanActivationEmail = async ({
  to,
  data,
}: {
  to: string | string[];
  data: PlanActivationTemplateData;
}) =>
  sendTemplateEmail({
    template: "plan_activation",
    to,
    data,
  });
