import { InvoiceStatus } from "@prisma/client";
import { sendMail } from "../../utils/mailer.js";

type InvoiceEmailPayload = {
  invoiceId: number;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  total: unknown;
  subtotal: unknown;
  tax: unknown;
  discount: unknown;
  customer: {
    name: string;
    email: string | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: unknown;
    total: unknown;
  }>;
  businessProfile: {
    business_name: string;
    email: string | null;
    phone: string | null;
  } | null;
};

type NotificationType = "created" | "sent" | "reminder";

const toNumber = (value: unknown) => Number(value ?? 0);

const formatDate = (value: Date | null) => {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatAmount = (value: unknown) => toNumber(value).toFixed(2);

const getSubject = (type: NotificationType, invoiceNumber: string) => {
  switch (type) {
    case "created":
      return `Invoice ${invoiceNumber} created`;
    case "sent":
      return `Invoice ${invoiceNumber} sent`;
    case "reminder":
      return `Payment reminder for invoice ${invoiceNumber}`;
    default:
      return `Invoice ${invoiceNumber}`;
  }
};

const getLeadLine = (type: NotificationType, customerName: string) => {
  switch (type) {
    case "created":
      return `Hello ${customerName}, your invoice has been created.`;
    case "sent":
      return `Hello ${customerName}, your invoice has been sent.`;
    case "reminder":
      return `Hello ${customerName}, this is a payment reminder for your invoice.`;
    default:
      return `Hello ${customerName}, please find your invoice details below.`;
  }
};

const escapeHtml = (text: unknown) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const buildItemsHtml = (items: InvoiceEmailPayload["items"]) => {
  return items
    .map(
      (item, index) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${index + 1}</td>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.name)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;">${formatAmount(item.price)}</td>
          <td style="padding:8px;border:1px solid #ddd;">${formatAmount(item.total)}</td>
        </tr>
      `,
    )
    .join("");
};

export const sendInvoiceNotification = async (
  type: NotificationType,
  payload: InvoiceEmailPayload,
  publicInvoiceUrl: string,
) => {
  if (!payload.customer.email) {
    throw new Error("Client email is required to send invoice notification");
  }

  const subject = getSubject(type, payload.invoiceNumber);
  const leadLine = getLeadLine(type, payload.customer.name);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.5;">
      <h2>${escapeHtml(subject)}</h2>
      <p>${escapeHtml(leadLine)}</p>
      <p><strong>Invoice Number:</strong> ${escapeHtml(payload.invoiceNumber)}</p>
      <p><strong>Status:</strong> ${escapeHtml(payload.status)}</p>
      <p><strong>Issue Date:</strong> ${escapeHtml(formatDate(payload.issueDate))}</p>
      <p><strong>Due Date:</strong> ${escapeHtml(formatDate(payload.dueDate))}</p>

      <h3>Invoice Items</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <thead>
          <tr>
            <th style="padding:8px;border:1px solid #ddd;">#</th>
            <th style="padding:8px;border:1px solid #ddd;">Item</th>
            <th style="padding:8px;border:1px solid #ddd;">Qty</th>
            <th style="padding:8px;border:1px solid #ddd;">Price</th>
            <th style="padding:8px;border:1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${buildItemsHtml(payload.items)}
        </tbody>
      </table>

      <h3>Totals</h3>
      <p><strong>Subtotal:</strong> ${formatAmount(payload.subtotal)}</p>
      <p><strong>Tax:</strong> ${formatAmount(payload.tax)}</p>
      <p><strong>Discount:</strong> ${formatAmount(payload.discount)}</p>
      <p><strong>Grand Total:</strong> ${formatAmount(payload.total)}</p>

      <p>
        <a href="${escapeHtml(publicInvoiceUrl)}" target="_blank" rel="noopener noreferrer">
          View Invoice
        </a>
      </p>

      <p style="margin-top: 24px; color: #555; font-size: 12px;">
        ${escapeHtml(payload.businessProfile?.business_name ?? "Billing Team")}
        ${payload.businessProfile?.email ? ` | ${escapeHtml(payload.businessProfile.email)}` : ""}
        ${payload.businessProfile?.phone ? ` | ${escapeHtml(payload.businessProfile.phone)}` : ""}
      </p>
    </div>
  `;

  const text = [
    subject,
    leadLine,
    `Invoice Number: ${payload.invoiceNumber}`,
    `Status: ${payload.status}`,
    `Issue Date: ${formatDate(payload.issueDate)}`,
    `Due Date: ${formatDate(payload.dueDate)}`,
    `Subtotal: ${formatAmount(payload.subtotal)}`,
    `Tax: ${formatAmount(payload.tax)}`,
    `Discount: ${formatAmount(payload.discount)}`,
    `Grand Total: ${formatAmount(payload.total)}`,
    `Public Invoice Link: ${publicInvoiceUrl}`,
  ].join("\n");

  await sendMail({
    to: payload.customer.email,
    subject,
    html,
    text,
  });
};
