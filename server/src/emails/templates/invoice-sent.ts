import type {
  EmailMessage,
  InvoiceEmailPreviewPayload,
  InvoiceLineItem,
  InvoiceSentEmailData,
} from "../types.js";
import {
  createEmailLayout,
  escapeHtml,
  formatCurrency,
  formatDate,
} from "./shared.js";

const normalizeLabel = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return "-";
  }

  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolvePaymentStatusLabel = (value: string | null | undefined) => {
  switch (value) {
    case "PAID":
      return "Paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    case "FAILED":
    case "VOID":
      return "Failed";
    case "OVERDUE":
      return "Overdue";
    case "SENT":
    case "DRAFT":
    default:
      return "Pending";
  }
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asArray = <T = Record<string, unknown>>(value: unknown): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const asString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const asNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const renderSectionTitle = (title: string) =>
  `<h2 style="margin:24px 0 12px;font-size:18px;line-height:1.3;color:#111827;">${escapeHtml(title)}</h2>`;

const renderSnapshot = ({
  invoiceId,
  amount,
  currency,
  issueDate,
  dueDate,
  paymentStatus,
}: {
  invoiceId: string;
  amount: number;
  currency: string;
  issueDate: Date | string;
  dueDate: Date | string | null | undefined;
  paymentStatus: string;
}) => `
  <table style="width:100%;border-collapse:separate;border-spacing:12px 0;margin:8px 0 4px;">
    <tbody>
      <tr>
        <td style="width:50%;padding:16px;border:1px solid #dbeafe;border-radius:18px;background:#eff6ff;vertical-align:top;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1d4ed8;">Invoice ID</div>
          <div style="margin-top:8px;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(invoiceId)}</div>
        </td>
        <td style="width:50%;padding:16px;border:1px solid #dbeafe;border-radius:18px;background:#eff6ff;vertical-align:top;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#1d4ed8;">Grand Total</div>
          <div style="margin-top:8px;font-size:22px;font-weight:800;color:#0f172a;">${escapeHtml(formatCurrency(amount, currency))}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:16px;border:1px solid #e5e7eb;border-radius:18px;background:#ffffff;vertical-align:top;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Issue Date</div>
          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(formatDate(issueDate))}</div>
        </td>
        <td style="padding:16px;border:1px solid #e5e7eb;border-radius:18px;background:#ffffff;vertical-align:top;">
          <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;">Due / Status</div>
          <div style="margin-top:8px;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(formatDate(dueDate ?? issueDate))}</div>
          <div style="margin-top:6px;font-size:13px;color:#4b5563;">${escapeHtml(paymentStatus)}</div>
        </td>
      </tr>
    </tbody>
  </table>
`;

const renderDetailRows = (rows: Array<{ label: string; value: string }>) => `
  <table style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;margin:0 0 18px;background:#ffffff;">
    <tbody>
      ${rows
        .map(
          ({ label, value }, index) => `
            <tr>
              <td style="padding:12px 14px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}background:#fafaf9;font-size:13px;font-weight:700;color:#374151;width:36%;vertical-align:top;">
                ${escapeHtml(label)}
              </td>
              <td style="padding:12px 14px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:14px;line-height:1.6;color:#111827;vertical-align:top;">
                ${escapeHtml(value)}
              </td>
            </tr>
          `,
        )
        .join("")}
    </tbody>
  </table>
`;

const renderRawTaxLabel = (item: InvoiceLineItem, currency: string) => {
  const taxRate = Number(item.tax_rate ?? 0);
  const gstAmount = Number(item.gst_amount ?? 0);
  const cgstAmount = Number(item.cgst_amount ?? 0);
  const sgstAmount = Number(item.sgst_amount ?? 0);
  const igstAmount = Number(item.igst_amount ?? 0);

  if (taxRate <= 0 && gstAmount <= 0) {
    return "-";
  }

  if (item.gst_type === "CGST_SGST") {
    return `${taxRate.toFixed(0)}% (CGST ${formatCurrency(cgstAmount, currency)} + SGST ${formatCurrency(sgstAmount, currency)})`;
  }

  if (item.gst_type === "IGST") {
    return `${taxRate.toFixed(0)}% (IGST ${formatCurrency(igstAmount, currency)})`;
  }

  return `${taxRate.toFixed(0)}% (${formatCurrency(gstAmount, currency)})`;
};

const renderPreviewTaxLabel = (
  item: Record<string, unknown>,
  currency: string,
) => {
  const taxRate = asNumber(item.taxRate);
  const gstType = asString(item.gstType);
  const gstAmount = asNumber(item.gstAmount);
  const cgstAmount = asNumber(item.cgstAmount);
  const sgstAmount = asNumber(item.sgstAmount);
  const igstAmount = asNumber(item.igstAmount);

  if (taxRate <= 0 && gstAmount <= 0 && cgstAmount <= 0 && sgstAmount <= 0 && igstAmount <= 0) {
    return "-";
  }

  if (gstType === "CGST_SGST") {
    return `${taxRate.toFixed(0)}% (CGST ${formatCurrency(cgstAmount, currency)} + SGST ${formatCurrency(sgstAmount, currency)})`;
  }

  if (gstType === "IGST") {
    return `${taxRate.toFixed(0)}% (IGST ${formatCurrency(igstAmount, currency)})`;
  }

  const totalTax = gstAmount || cgstAmount + sgstAmount + igstAmount;
  return `${taxRate.toFixed(0)}% (${formatCurrency(totalTax, currency)})`;
};

const renderItemsTable = (
  rows: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    taxLabel: string;
    total: number;
  }>,
  currency: string,
) => `
  <table style="width:100%;border-collapse:collapse;margin:12px 0 20px;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;background:#ffffff;">
    <thead>
      <tr>
        <th style="padding:12px 10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Item</th>
        <th style="padding:12px 10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;text-align:right;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;width:64px;">Qty</th>
        <th style="padding:12px 10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;text-align:right;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;width:112px;">Price</th>
        <th style="padding:12px 10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;text-align:left;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;width:180px;">Tax</th>
        <th style="padding:12px 10px;border-bottom:1px solid #e5e7eb;background:#fafaf9;text-align:right;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;width:120px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row, index) => `
            <tr>
              <td style="padding:12px 10px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:14px;line-height:1.5;color:#111827;">
                <div style="font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">
                  ${escapeHtml(row.name)}
                </div>
              </td>
              <td style="padding:12px 10px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}text-align:right;font-size:14px;color:#111827;">${escapeHtml(String(row.quantity))}</td>
              <td style="padding:12px 10px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}text-align:right;font-size:14px;color:#111827;">${escapeHtml(formatCurrency(row.unitPrice, currency))}</td>
              <td style="padding:12px 10px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}font-size:13px;line-height:1.5;color:#374151;">${escapeHtml(row.taxLabel)}</td>
              <td style="padding:12px 10px;${index < rows.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}text-align:right;font-size:14px;font-weight:700;color:#111827;">${escapeHtml(formatCurrency(row.total, currency))}</td>
            </tr>
          `,
        )
        .join("")}
    </tbody>
  </table>
`;

const renderTotals = ({
  subtotal,
  discount,
  discountLabel,
  tax,
  totalCgst,
  totalSgst,
  totalIgst,
  amount,
  currency,
}: {
  subtotal: number;
  discount: number;
  discountLabel?: string;
  tax: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  amount: number;
  currency: string;
}) => {
  const taxRows =
    totalCgst > 0 || totalSgst > 0
      ? `
        <tr>
          <td style="padding:10px 0;color:#4b5563;">CGST</td>
          <td style="padding:10px 0;text-align:right;color:#111827;">${escapeHtml(formatCurrency(totalCgst, currency))}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#4b5563;">SGST</td>
          <td style="padding:10px 0;text-align:right;color:#111827;">${escapeHtml(formatCurrency(totalSgst, currency))}</td>
        </tr>
      `
      : totalIgst > 0
        ? `
          <tr>
            <td style="padding:10px 0;color:#4b5563;">IGST</td>
            <td style="padding:10px 0;text-align:right;color:#111827;">${escapeHtml(formatCurrency(totalIgst, currency))}</td>
          </tr>
        `
        : `
          <tr>
            <td style="padding:10px 0;color:#4b5563;">Tax</td>
            <td style="padding:10px 0;text-align:right;color:#111827;">${escapeHtml(formatCurrency(tax, currency))}</td>
          </tr>
        `;

  return `
    <div style="margin:8px 0 0;border:1px solid #dbeafe;border-radius:18px;background:#f8fbff;padding:18px 20px;">
      <h3 style="margin:0 0 12px;font-size:17px;color:#0f172a;">Invoice summary</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          <tr>
            <td style="padding:10px 0;color:#4b5563;">Subtotal</td>
            <td style="padding:10px 0;text-align:right;color:#111827;">${escapeHtml(formatCurrency(subtotal, currency))}</td>
          </tr>
          ${
            discount > 0
              ? `
                <tr>
                  <td style="padding:10px 0;color:#4b5563;">${escapeHtml(discountLabel || "Discount")}</td>
                  <td style="padding:10px 0;text-align:right;color:#111827;">-${escapeHtml(formatCurrency(discount, currency))}</td>
                </tr>
              `
              : ""
          }
          ${taxRows}
          <tr>
            <td style="padding:12px 0 0;border-top:1px solid #bfdbfe;font-size:15px;font-weight:800;color:#0f172a;">Grand Total</td>
            <td style="padding:12px 0 0;border-top:1px solid #bfdbfe;text-align:right;font-size:18px;font-weight:800;color:#0f172a;">${escapeHtml(formatCurrency(amount, currency))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

const renderSecondaryAction = (invoiceUrl: string) => `
  <div style="margin-top:24px;border:1px dashed #cbd5e1;border-radius:16px;padding:16px 18px;background:#f8fafc;">
    <div style="font-size:14px;line-height:1.6;color:#475569;">
      Need the hosted invoice page as well? You can open it anytime from the secure link below.
    </div>
    <div style="margin-top:14px;">
      <a
        href="${escapeHtml(invoiceUrl)}"
        style="display:inline-block;border-radius:999px;border:1px solid #cbd5e1;background:#ffffff;color:#0f172a;padding:12px 18px;text-decoration:none;font-weight:700;"
        target="_blank"
        rel="noopener noreferrer"
      >
        View Invoice Online
      </a>
    </div>
  </div>
`;

const getPreviewContext = (
  previewPayload: InvoiceEmailPreviewPayload | null | undefined,
) => {
  const payload = previewPayload ?? null;
  const data = asRecord(payload?.data);
  const business = asRecord(data.business);
  const client = asRecord(data.client);
  const totals = asRecord(data.totals);
  const discount = asRecord(data.discount);
  const paymentSummary = asRecord(data.paymentSummary);
  const payment = asRecord(data.payment);
  const items = asArray<Record<string, unknown>>(data.items);

  return {
    hasPreview: Boolean(payload),
    invoiceId: asString(data.invoiceNumber),
    issueDate: asString(data.invoiceDate),
    dueDate: asString(data.dueDate),
    businessName: asString(business.businessName),
    businessEmail: asString(business.email),
    businessPhone: asString(business.phone),
    customerName: asString(client.name),
    customerEmail: asString(client.email),
    customerPhone: asString(client.phone),
    paymentStatus: asString(paymentSummary.statusLabel),
    paymentMethod: asString(payment.mode),
    items: items.map((item) => ({
      name: asString(item.name, "Item"),
      quantity: asNumber(item.quantity),
      unitPrice: asNumber(item.unitPrice),
      taxLabel: renderPreviewTaxLabel(item, asString(business.currency, "INR")),
      total: asNumber(item.amount),
    })),
    subtotal: asNumber(totals.subtotal),
    discountAmount: asNumber(
      discount.calculatedAmount,
      asNumber(totals.discount),
    ),
    discountLabel: asString(discount.label),
    tax: asNumber(totals.tax),
    totalCgst: asNumber(totals.cgst),
    totalSgst: asNumber(totals.sgst),
    totalIgst: asNumber(totals.igst),
    amount: asNumber(totals.grandTotal, asNumber(totals.total)),
    notes: asString(data.notes),
    currency: asString(business.currency, "INR"),
  };
};

export const buildInvoiceSentEmail = ({
  email,
  customer_name,
  customer_email,
  customer_phone,
  invoice_id,
  amount,
  subtotal,
  tax,
  tax_mode,
  discount = 0,
  discount_type = "FIXED",
  discount_value = 0,
  total_cgst = 0,
  total_sgst = 0,
  total_igst = 0,
  date,
  due_date,
  business_name,
  business_email,
  business_phone,
  payment_status,
  payment_method,
  notes,
  invoice_url,
  currency = "INR",
  items,
  preview_payload,
}: InvoiceSentEmailData): EmailMessage => {
  const preview = getPreviewContext(preview_payload);
  const resolvedInvoiceId = preview.invoiceId || invoice_id;
  const resolvedIssueDate = preview.issueDate || date;
  const resolvedDueDate = preview.dueDate || due_date || date;
  const resolvedCurrency = preview.currency || currency;
  const resolvedBusinessName = preview.businessName || business_name;
  const resolvedCustomerName = preview.customerName || customer_name;
  const resolvedCustomerEmail =
    preview.customerEmail || customer_email?.trim() || email;
  const resolvedCustomerPhone = preview.customerPhone || customer_phone?.trim() || "-";
  const resolvedPaymentStatus =
    preview.paymentStatus || resolvePaymentStatusLabel(payment_status);
  const resolvedPaymentMethod =
    preview.paymentMethod || normalizeLabel(payment_method);
  const resolvedAmount = preview.hasPreview ? preview.amount : amount;
  const resolvedSubtotal = preview.hasPreview ? preview.subtotal : subtotal;
  const resolvedDiscount = preview.hasPreview ? preview.discountAmount : discount;
  const resolvedTax = preview.hasPreview ? preview.tax : tax;
  const resolvedTotalCgst = preview.hasPreview
    ? preview.totalCgst
    : (total_cgst ?? 0);
  const resolvedTotalSgst = preview.hasPreview
    ? preview.totalSgst
    : (total_sgst ?? 0);
  const resolvedTotalIgst = preview.hasPreview
    ? preview.totalIgst
    : (total_igst ?? 0);
  const resolvedNotes = preview.notes || notes || "";
  const resolvedItems =
    preview.hasPreview && preview.items.length > 0
      ? preview.items
      : items.map((item) => ({
          name: item.name,
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unit_price ?? 0),
          taxLabel: renderRawTaxLabel(item, resolvedCurrency),
          total: Number(item.line_total ?? 0),
        }));
  const resolvedDiscountLabel =
    preview.discountLabel ||
    (discount_type === "PERCENTAGE"
      ? `Discount (${discount_value.toFixed(2)}%)`
      : `Discount (${formatCurrency(discount_value, resolvedCurrency)})`);
  const resolvedBusinessContact =
    [
      preview.businessEmail || business_email?.trim(),
      preview.businessPhone || business_phone?.trim(),
    ]
      .filter(Boolean)
      .join(" | ") || "-";

  return {
    to: email,
    subject: `Invoice ${resolvedInvoiceId} from ${resolvedBusinessName}`,
    text: `Hi ${resolvedCustomerName}, invoice ${resolvedInvoiceId} from ${resolvedBusinessName} is ready. Total: ${formatCurrency(resolvedAmount, resolvedCurrency)}. Issue date: ${formatDate(resolvedIssueDate)}. Due date: ${formatDate(resolvedDueDate)}.${invoice_url ? ` View invoice: ${invoice_url}` : ""}`,
    html: createEmailLayout({
      previewText: `Invoice ${resolvedInvoiceId} from ${resolvedBusinessName} for ${formatCurrency(resolvedAmount, resolvedCurrency)}.`,
      title: "Your invoice is ready",
      intro: `${resolvedBusinessName} has shared the complete invoice details below so you can review the bill directly from this email.`,
      sections: [
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hi ${escapeHtml(resolvedCustomerName)},</p>`,
        `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4b5563;">This invoice email uses the same bill data as the attached PDF so the totals, GST breakdown, and customer details stay consistent across both formats.</p>`,
        renderSnapshot({
          invoiceId: resolvedInvoiceId,
          amount: resolvedAmount,
          currency: resolvedCurrency,
          issueDate: resolvedIssueDate,
          dueDate: resolvedDueDate,
          paymentStatus: resolvedPaymentStatus,
        }),
        renderSectionTitle("Invoice details"),
        renderDetailRows([
          { label: "Invoice ID", value: resolvedInvoiceId },
          { label: "Issue date", value: formatDate(resolvedIssueDate) },
          { label: "Due date", value: formatDate(resolvedDueDate) },
          { label: "Business name", value: resolvedBusinessName },
          { label: "Customer name", value: resolvedCustomerName },
          { label: "Customer email", value: resolvedCustomerEmail },
          { label: "Customer phone", value: resolvedCustomerPhone },
          { label: "Payment status", value: resolvedPaymentStatus },
          { label: "Payment method", value: resolvedPaymentMethod },
          { label: "Business contact", value: resolvedBusinessContact },
          {
            label: "Tax mode",
            value: preview.hasPreview
              ? normalizeLabel(asString(asRecord(preview_payload?.data).taxMode))
              : normalizeLabel(tax_mode),
          },
        ]),
        resolvedItems.length > 0
          ? `${renderSectionTitle("Items")}<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">Line totals already include GST where applicable. Any invoice-level discount is shown separately in the summary below.</p>${renderItemsTable(
              resolvedItems,
              resolvedCurrency,
            )}`
          : "",
        renderTotals({
          subtotal: resolvedSubtotal,
          discount: resolvedDiscount,
          discountLabel: resolvedDiscountLabel,
          tax: resolvedTax,
          totalCgst: resolvedTotalCgst,
          totalSgst: resolvedTotalSgst,
          totalIgst: resolvedTotalIgst,
          amount: resolvedAmount,
          currency: resolvedCurrency,
        }),
        resolvedNotes.trim()
          ? `<div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:16px;background:#fafaf9;padding:16px 18px;"><strong style="display:block;font-size:15px;color:#111827;">Notes</strong><p style="margin:10px 0 0;font-size:14px;line-height:1.7;color:#4b5563;">${escapeHtml(resolvedNotes)}</p></div>`
          : "",
        invoice_url ? renderSecondaryAction(invoice_url) : "",
      ],
      footer: `Invoice ${resolvedInvoiceId} was sent by ${resolvedBusinessName}.`,
    }),
  };
};
