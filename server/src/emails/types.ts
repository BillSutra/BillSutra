import type { Attachment } from "resend";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | string[];
  attachments?: Attachment[];
};

export type WelcomeEmailData = {
  email: string;
  user_name: string;
  login_url: string;
};

export type PasswordResetEmailData = {
  email: string;
  user_name: string;
  reset_url: string;
};

export type OtpLoginEmailData = {
  email: string;
  user_name: string;
  code: string;
  expires_in_minutes: number;
  resend_in_seconds: number;
};

export type InvoiceLineItem = {
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type InvoiceSentEmailData = {
  email: string;
  customer_name: string;
  invoice_id: string;
  amount: number;
  date: Date | string;
  due_date?: Date | string | null;
  business_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  notes?: string | null;
  invoice_url?: string | null;
  currency?: string;
  items: InvoiceLineItem[];
};

export type InvoiceReminderEmailData = {
  email: string;
  customer_name: string;
  invoice_id: string;
  amount: number;
  due_date?: Date | string | null;
  business_name: string;
  invoice_url?: string | null;
  currency?: string;
};

export type ExportReadyEmailData = {
  email: string;
  user_name: string;
  resource: string;
  format: string;
  exported_count: number;
  file_name: string;
  attachment: Attachment;
};

export type DeleteDataConfirmationEmailData = {
  email: string;
  user_name: string;
};

export type DeleteAccountConfirmationEmailData = {
  email: string;
  user_name: string;
};

export type EmailTemplateDataMap = {
  welcome: WelcomeEmailData;
  password_reset: PasswordResetEmailData;
  otp_login: OtpLoginEmailData;
  invoice_sent: InvoiceSentEmailData;
  invoice_reminder: InvoiceReminderEmailData;
  export_ready: ExportReadyEmailData;
  delete_data_confirmation: DeleteDataConfirmationEmailData;
  delete_account_confirmation: DeleteAccountConfirmationEmailData;
};

export type EmailType = keyof EmailTemplateDataMap;
