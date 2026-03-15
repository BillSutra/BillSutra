"use client";

import emailjs from "@emailjs/browser";
import Env from "./env";

type EmailTemplateParams = {
  account_verification: {
    user_email: string;
    verification_link: string;
    user_name: string;
  };
  password_reset: {
    user_email: string;
    reset_link: string;
  };
  delete_account_confirmation: {
    user_email: string;
    user_name: string;
  };
  delete_data_confirmation: {
    user_email: string;
    user_name: string;
  };
  welcome_email: {
    user_email: string;
    user_name: string;
    login_link: string;
  };
  contact_form: {
    from_name: string;
    from_email: string;
    message: string;
  };
  invoice_sent: {
    user_email: string;
    customer_name: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    total: string;
    business_name: string;
    business_email: string;
    business_phone: string;
    notes: string;
    items_summary: string;
  };
  invoice_reminder: {
    user_email: string;
    customer_name: string;
    invoice_number: string;
    due_date: string;
    total: string;
    business_name: string;
  };
};

export type EmailTemplateKey = keyof EmailTemplateParams;

const TEMPLATE_IDS: Record<EmailTemplateKey, string | undefined> = {
  account_verification:
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ACCOUNT_VERIFICATION_ID,
  password_reset: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_PASSWORD_RESET_ID,
  delete_account_confirmation:
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DELETE_ACCOUNT_CONFIRMATION_ID,
  delete_data_confirmation:
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_DELETE_DATA_CONFIRMATION_ID,
  welcome_email: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_WELCOME_EMAIL_ID,
  contact_form: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_CONTACT_FORM_ID,
  invoice_sent: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_INVOICE_SENT_ID,
  invoice_reminder:
    process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_INVOICE_REMINDER_ID,
};

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

const getRequiredConfig = (template: EmailTemplateKey) => {
  if (!SERVICE_ID || !PUBLIC_KEY) {
    throw new Error("EmailJS is not configured.");
  }

  const templateId = TEMPLATE_IDS[template];
  if (!templateId) {
    throw new Error(`EmailJS template is not configured for ${template}.`);
  }

  return { templateId };
};

export const sendEmail = async <T extends EmailTemplateKey>(
  template: T,
  params: EmailTemplateParams[T],
) => {
  try {
    const { templateId } = getRequiredConfig(template);
    return await emailjs.send(SERVICE_ID as string, templateId, params, {
      publicKey: PUBLIC_KEY,
    });
  } catch (error) {
    console.error("Email failed:", error);
    throw error;
  }
};

const getAppUrl = () => {
  if (Env.APP_URL) return Env.APP_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
};

export const sendAccountVerificationEmail = async (payload: {
  user_email: string;
  user_name: string;
  verification_link?: string;
}) =>
  sendEmail("account_verification", {
    user_email: payload.user_email,
    user_name: payload.user_name,
    verification_link:
      payload.verification_link ||
      `${getAppUrl()}/login?email=${encodeURIComponent(payload.user_email)}`,
  });

export const sendWelcomeEmail = async (payload: {
  user_email: string;
  user_name: string;
  login_link?: string;
}) =>
  sendEmail("welcome_email", {
    user_email: payload.user_email,
    user_name: payload.user_name,
    login_link:
      payload.login_link ||
      `${getAppUrl()}/login?email=${encodeURIComponent(payload.user_email)}`,
  });

export const sendPasswordResetEmail = async (payload: {
  user_email: string;
  reset_link: string;
}) => sendEmail("password_reset", payload);

export const sendDeleteAccountConfirmationEmail = async (payload: {
  user_email: string;
  user_name: string;
}) => sendEmail("delete_account_confirmation", payload);

export const sendDeleteDataConfirmationEmail = async (payload: {
  user_email: string;
  user_name: string;
}) => sendEmail("delete_data_confirmation", payload);

export const sendContactFormEmail = async (payload: {
  from_name: string;
  from_email: string;
  message: string;
}) => sendEmail("contact_form", payload);

export const sendInvoiceSentEmail = async (payload: {
  user_email: string;
  customer_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  total: string;
  business_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  notes?: string | null;
  items_summary: string;
}) =>
  sendEmail("invoice_sent", {
    user_email: payload.user_email,
    customer_name: payload.customer_name,
    invoice_number: payload.invoice_number,
    invoice_date: payload.invoice_date,
    due_date: payload.due_date || "-",
    total: payload.total,
    business_name: payload.business_name,
    business_email: payload.business_email || "-",
    business_phone: payload.business_phone || "-",
    notes: payload.notes || "-",
    items_summary: payload.items_summary,
  });

export const sendInvoiceReminderEmail = async (payload: {
  user_email: string;
  customer_name: string;
  invoice_number: string;
  due_date?: string | null;
  total: string;
  business_name: string;
}) =>
  sendEmail("invoice_reminder", {
    user_email: payload.user_email,
    customer_name: payload.customer_name,
    invoice_number: payload.invoice_number,
    due_date: payload.due_date || "-",
    total: payload.total,
    business_name: payload.business_name,
  });
