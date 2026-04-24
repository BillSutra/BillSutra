import type { MailAttachment } from "../services/mailService.js";

export type EmailMessage = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string | string[];
  attachments?: MailAttachment[];
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
  line_subtotal?: number;
  discount?: number | null;
  tax_rate?: number | null;
  gst_type?: string | null;
  gst_amount?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  line_total: number;
};

export type InvoiceEmailPreviewPayload = {
  templateId?: string | null;
  templateName?: string | null;
  data: Record<string, unknown>;
  enabledSections: string[];
  sectionOrder?: string[];
  theme?: Record<string, unknown> | null;
  designConfig?: Record<string, unknown> | null;
};

export type InvoiceSentEmailData = {
  email: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  invoice_id: string;
  amount: number;
  subtotal: number;
  tax: number;
  tax_mode?: string | null;
  discount?: number;
  discount_type?: "PERCENTAGE" | "FIXED";
  discount_value?: number;
  total_cgst?: number | null;
  total_sgst?: number | null;
  total_igst?: number | null;
  date: Date | string;
  due_date?: Date | string | null;
  business_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  payment_status?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  invoice_url?: string | null;
  currency?: string;
  items: InvoiceLineItem[];
  preview_payload?: InvoiceEmailPreviewPayload | null;
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
  attachment: MailAttachment;
};

export type DeleteDataConfirmationEmailData = {
  email: string;
  user_name: string;
};

export type DeleteAccountConfirmationEmailData = {
  email: string;
  user_name: string;
};

export type PaymentAccessApprovedEmailData = {
  email: string;
  user_name: string;
  plan_name: string;
  amount: number;
  status_page_url: string;
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
  payment_access_approved: PaymentAccessApprovedEmailData;
};

export type EmailType = keyof EmailTemplateDataMap;
