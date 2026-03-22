import type { EmailMessage, InvoiceReminderEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  escapeHtml,
  formatCurrency,
  formatDate,
} from "./shared.js";

export const buildInvoiceReminderEmail = ({
  email,
  customer_name,
  invoice_id,
  amount,
  due_date,
  business_name,
  invoice_url,
  currency = "INR",
}: InvoiceReminderEmailData): EmailMessage => ({
  to: email,
  subject: `Payment reminder for invoice ${invoice_id}`,
  text: `Hi ${customer_name}, this is a reminder for invoice ${invoice_id} from ${business_name}. Amount due: ${formatCurrency(amount, currency)}. Due date: ${formatDate(due_date)}.${invoice_url ? ` View invoice: ${invoice_url}` : ""}`,
  html: createEmailLayout({
    previewText: `Reminder for invoice ${invoice_id}.`,
    title: "Payment reminder",
    intro: `${business_name} sent a reminder for invoice ${invoice_id}.`,
    cta: invoice_url
      ? {
          label: "Review invoice",
          url: invoice_url,
        }
      : undefined,
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(customer_name)},</p>`,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">This is a reminder that invoice ${escapeHtml(invoice_id)} is still awaiting payment.</p>`,
      createSummaryTable([
        { label: "Invoice ID", value: invoice_id },
        { label: "Amount due", value: formatCurrency(amount, currency) },
        { label: "Due date", value: formatDate(due_date) },
        { label: "Business", value: business_name },
      ]),
    ],
    footer: `Please contact ${business_name} if you have already completed payment.`,
  }),
});
