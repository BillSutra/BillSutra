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

export type VerifyEmailData = {
  email: string;
  user_name: string;
  verify_url: string;
  expires_in_minutes: number;
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
  business_logo_url?: string | null;
  payment_status?: string | null;
  reminder_stage?: "upcoming" | "due_today" | "overdue" | "manual";
  days_until_due?: number | null;
  invoice_url?: string | null;
  currency?: string;
};

export type PaymentReceivedEmailData = {
  email: string;
  customer_name: string;
  invoice_id: string;
  amount_received: number;
  total_amount: number;
  amount_outstanding: number;
  paid_at: Date | string;
  payment_method?: string | null;
  business_name: string;
  business_logo_url?: string | null;
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
  attachment?: MailAttachment;
  download_url?: string | null;
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

export type MonthlySalesReportEmailData = {
  email: string;
  user_name: string;
  report_month_label: string;
  invoices_issued: number;
  total_billed: number;
  total_collected: number;
  sales_count: number;
  total_sales: number;
  purchases_count: number;
  total_purchases: number;
  profit: number;
  overdue_count: number;
  reports_url: string;
};

export type WeeklyReportEmailData = {
  email: string;
  user_name: string;
  report_week_label: string;
  invoices_issued: number;
  total_billed: number;
  total_collected: number;
  pending_amount: number;
  profit: number;
  overdue_count: number;
  reports_url: string;
};

export type LowStockAlertEmailData = {
  email: string;
  user_name: string;
  business_name: string;
  business_logo_url?: string | null;
  inventory_url: string;
  insights: Array<{
    product_name: string;
    stock_left: number;
    threshold?: number | null;
    severity: "critical" | "warning" | "info";
    warehouse_name?: string | null;
    suggested_quantity?: number | null;
  }>;
};

export type EmailTemplateDataMap = {
  welcome: WelcomeEmailData;
  verify_email: VerifyEmailData;
  password_reset: PasswordResetEmailData;
  otp_login: OtpLoginEmailData;
  invoice_sent: InvoiceSentEmailData;
  invoice_reminder: InvoiceReminderEmailData;
  payment_received: PaymentReceivedEmailData;
  export_ready: ExportReadyEmailData;
  delete_data_confirmation: DeleteDataConfirmationEmailData;
  delete_account_confirmation: DeleteAccountConfirmationEmailData;
  payment_access_approved: PaymentAccessApprovedEmailData;
  monthly_sales_report: MonthlySalesReportEmailData;
  weekly_report: WeeklyReportEmailData;
  low_stock_alert: LowStockAlertEmailData;
};

export type EmailType = keyof EmailTemplateDataMap;
