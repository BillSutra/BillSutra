import type { EmailMessage, PaymentReceivedEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  escapeHtml,
  formatCurrency,
  formatDate,
} from "./shared.js";

export const buildPaymentReceivedEmail = ({
  email,
  customer_name,
  invoice_id,
  amount_received,
  total_amount,
  amount_outstanding,
  paid_at,
  payment_method,
  business_name,
  business_logo_url,
  invoice_url,
  currency = "INR",
}: PaymentReceivedEmailData): EmailMessage => ({
  to: email,
  subject: `Payment received for invoice ${invoice_id}`,
  text: `Hi ${customer_name}, ${business_name} received ${formatCurrency(amount_received, currency)} for invoice ${invoice_id} on ${formatDate(paid_at)}.${invoice_url ? ` View invoice: ${invoice_url}` : ""}`,
  html: createEmailLayout({
    previewText: `Payment received for invoice ${invoice_id}.`,
    title: "Payment received",
    intro: `${business_name} has confirmed your payment and updated the invoice balance.`,
    brandName: business_name,
    brandLogoUrl: business_logo_url,
    cta: invoice_url
      ? {
          label: "View updated invoice",
          url: invoice_url,
        }
      : undefined,
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(customer_name)},</p>`,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">We received your payment for invoice ${escapeHtml(invoice_id)}. Thank you.</p>`,
      createSummaryTable([
        { label: "Invoice ID", value: invoice_id },
        {
          label: "Amount received",
          value: formatCurrency(amount_received, currency),
        },
        { label: "Paid on", value: formatDate(paid_at) },
        { label: "Payment method", value: payment_method ?? "Recorded" },
        { label: "Invoice total", value: formatCurrency(total_amount, currency) },
        {
          label: "Outstanding balance",
          value: formatCurrency(amount_outstanding, currency),
        },
      ]),
    ],
    footer: `This receipt was sent by ${business_name}.`,
  }),
});
