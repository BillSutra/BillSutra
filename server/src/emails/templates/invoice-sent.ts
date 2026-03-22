import type { EmailMessage, InvoiceSentEmailData } from "../types.js";
import {
  createEmailLayout,
  createSummaryTable,
  escapeHtml,
  formatCurrency,
  formatDate,
} from "./shared.js";

const renderItemsTable = (items: InvoiceSentEmailData["items"], currency: string) =>
  `
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <thead>
        <tr>
          <th style="padding:10px;border:1px solid #e5e7eb;background:#fafaf9;text-align:left;">Item</th>
          <th style="padding:10px;border:1px solid #e5e7eb;background:#fafaf9;text-align:right;">Qty</th>
          <th style="padding:10px;border:1px solid #e5e7eb;background:#fafaf9;text-align:right;">Unit Price</th>
          <th style="padding:10px;border:1px solid #e5e7eb;background:#fafaf9;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items
          .map(
            (item) => `
              <tr>
                <td style="padding:10px;border:1px solid #e5e7eb;">${escapeHtml(item.name)}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${item.quantity}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(item.unit_price, currency))}</td>
                <td style="padding:10px;border:1px solid #e5e7eb;text-align:right;">${escapeHtml(formatCurrency(item.line_total, currency))}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;

export const buildInvoiceSentEmail = ({
  email,
  customer_name,
  invoice_id,
  amount,
  date,
  due_date,
  business_name,
  business_email,
  business_phone,
  notes,
  invoice_url,
  currency = "INR",
  items,
}: InvoiceSentEmailData): EmailMessage => ({
  to: email,
  subject: `Invoice ${invoice_id} from ${business_name}`,
  text: `Hi ${customer_name}, invoice ${invoice_id} for ${formatCurrency(amount, currency)} was issued on ${formatDate(date)}.${invoice_url ? ` View it here: ${invoice_url}` : ""}`,
  html: createEmailLayout({
    previewText: `Invoice ${invoice_id} from ${business_name}.`,
    title: "Your invoice is ready",
    intro: `${business_name} has shared invoice ${invoice_id} with you.`,
    cta: invoice_url
      ? {
          label: "View invoice",
          url: invoice_url,
        }
      : undefined,
    sections: [
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(customer_name)},</p>`,
      createSummaryTable([
        { label: "Invoice ID", value: invoice_id },
        { label: "Amount", value: formatCurrency(amount, currency) },
        { label: "Issue date", value: formatDate(date) },
        { label: "Due date", value: formatDate(due_date) },
        { label: "Business", value: business_name },
        {
          label: "Contact",
          value:
            [business_email?.trim(), business_phone?.trim()]
              .filter(Boolean)
              .join(" | ") || "-",
        },
      ]),
      items.length > 0
        ? `<h2 style="margin:24px 0 12px;font-size:18px;">Invoice items</h2>${renderItemsTable(items, currency)}`
        : "",
      notes?.trim()
        ? `<div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:14px;background:#fafaf9;padding:16px;"><strong>Notes</strong><p style="margin:10px 0 0;font-size:15px;line-height:1.7;">${escapeHtml(notes)}</p></div>`
        : "",
    ],
    footer: `Invoice ${invoice_id} was sent by ${business_name}.`,
  }),
});
