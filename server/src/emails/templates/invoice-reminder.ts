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
  business_logo_url,
  payment_status,
  reminder_stage = "manual",
  days_until_due,
  invoice_url,
  currency = "INR",
}: InvoiceReminderEmailData): EmailMessage => {
  const reminderCopy =
    reminder_stage === "overdue"
      ? {
          subject: `Overdue payment reminder for invoice ${invoice_id}`,
          title: "Invoice payment is overdue",
          intro: `${business_name} is waiting on the overdue balance for invoice ${invoice_id}.`,
          body: `Your payment for invoice ${escapeHtml(invoice_id)} is overdue. Please complete it as soon as possible to avoid interruptions.`,
        }
      : reminder_stage === "due_today"
        ? {
            subject: `Invoice ${invoice_id} is due today`,
            title: "Invoice due today",
            intro: `${business_name} wants to help you close invoice ${invoice_id} on time today.`,
            body: `This is a friendly reminder that invoice ${escapeHtml(invoice_id)} is due today.`,
          }
        : reminder_stage === "upcoming"
          ? {
              subject: `Upcoming payment reminder for invoice ${invoice_id}`,
              title: "Upcoming invoice reminder",
              intro: `${business_name} is sharing a heads-up before invoice ${invoice_id} becomes due.`,
              body: `Invoice ${escapeHtml(invoice_id)} is due in ${days_until_due ?? "-"} day${days_until_due === 1 ? "" : "s"}.`,
            }
          : {
              subject: `Payment reminder for invoice ${invoice_id}`,
              title: "Payment reminder",
              intro: `${business_name} sent a reminder for invoice ${invoice_id}.`,
              body: `This is a reminder that invoice ${escapeHtml(invoice_id)} is still awaiting payment.`,
            };

  return {
    to: email,
    subject: reminderCopy.subject,
    text: `Hi ${customer_name}, ${business_name} sent a reminder for invoice ${invoice_id}. Amount due: ${formatCurrency(amount, currency)}. Due date: ${formatDate(due_date)}. Payment status: ${payment_status ?? "Pending"}.${invoice_url ? ` Pay now: ${invoice_url}` : ""}`,
    html: createEmailLayout({
      previewText: `Reminder for invoice ${invoice_id}.`,
      title: reminderCopy.title,
      intro: reminderCopy.intro,
      brandName: business_name,
      brandLogoUrl: business_logo_url,
      cta: invoice_url
        ? {
            label: "Pay Now",
            url: invoice_url,
          }
        : undefined,
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(customer_name)},</p>`,
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${reminderCopy.body}</p>`,
        createSummaryTable([
          { label: "Invoice ID", value: invoice_id },
          { label: "Amount due", value: formatCurrency(amount, currency) },
          { label: "Due date", value: formatDate(due_date) },
          { label: "Payment status", value: payment_status ?? "Pending" },
          { label: "Business", value: business_name },
        ]),
      ],
      footer: `Please contact ${business_name} if you have already completed payment.`,
    }),
  };
};
