import Env from "@/lib/env";
import type { InvoicePreviewData } from "@/types/invoice-template";

const DEFAULT_INVOICE_SECTIONS = [
  "header",
  "company_details",
  "client_details",
  "items",
  "tax",
  "discount",
  "payment_info",
  "notes",
  "footer",
] as const;

const DEFAULT_INVOICE_THEME = {
  primaryColor: "#1f2937",
  fontFamily: "var(--font-geist-sans)",
  tableStyle: "grid",
} as const;

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const formatInvoiceDate = (value?: string | null) => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const getStatusNote = (status: PublicInvoice["status"]) => {
  switch (status) {
    case "PAID":
      return {
        label: "Paid",
        tone: "paid" as const,
        note: "Settled in full",
      };
    case "PARTIALLY_PAID":
      return {
        label: "Partial",
        tone: "partial" as const,
        note: "Partially collected",
      };
    case "OVERDUE":
      return {
        label: "Overdue",
        tone: "pending" as const,
        note: "Payment overdue",
      };
    case "DRAFT":
      return {
        label: "Draft",
        tone: "pending" as const,
        note: "Draft invoice",
      };
    case "VOID":
      return {
        label: "Void",
        tone: "pending" as const,
        note: "Invoice voided",
      };
    default:
      return {
        label: "Pending",
        tone: "pending" as const,
        note: "Awaiting payment",
      };
  }
};

export type PublicInvoice = {
  id: number;
  public_id: string;
  invoice_id: string;
  amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  currency: string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "VOID";
  date: string;
  due_date: string | null;
  notes: string | null;
  customer_type: "individual" | "business";
  customer_display_name: string;
  customer_name: string;
  customer_business_name: string | null;
  customer_gstin: string | null;
  email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  business_name: string;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  public_url: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    tax_rate: number | null;
    line_total: number;
  }>;
};

export class PublicInvoiceNotFoundError extends Error {
  constructor(message = "Invoice not found") {
    super(message);
    this.name = "PublicInvoiceNotFoundError";
  }
}

export const fetchPublicInvoice = async (
  invoiceId: string,
): Promise<PublicInvoice> => {
  const trimmedInvoiceId = invoiceId.trim();
  const backendUrl = normalizeBaseUrl(Env.BACKEND_URL);
  const response = await fetch(
    `${backendUrl}/api/invoices/${encodeURIComponent(trimmedInvoiceId)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    throw new PublicInvoiceNotFoundError();
  }

  const payload = (await response.json().catch(() => null)) as {
    message?: string;
    data?: PublicInvoice;
  } | null;

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "Unable to load invoice");
  }

  return payload.data;
};

export const buildPublicInvoicePreviewData = (
  invoice: PublicInvoice,
): InvoicePreviewData => {
  const statusMeta = getStatusNote(invoice.status);

  return {
    invoiceNumber: invoice.invoice_id,
    invoiceDate: formatInvoiceDate(invoice.date),
    dueDate: formatInvoiceDate(invoice.due_date),
    business: {
      businessName: invoice.business_name,
      address: invoice.business_address ?? "",
      phone: invoice.business_phone ?? "",
      email: invoice.business_email ?? "",
      website: "",
      logoUrl: "",
      taxId: "",
      currency: invoice.currency,
      showLogoOnInvoice: false,
      showTaxNumber: false,
      showPaymentQr: false,
    },
    client: {
      name: invoice.customer_display_name || invoice.customer_name,
      type: invoice.customer_type,
      businessName: invoice.customer_business_name ?? "",
      gstin: invoice.customer_gstin ?? "",
      email: invoice.email ?? "",
      phone: invoice.customer_phone ?? "",
      address: invoice.customer_address ?? "",
    },
    items: invoice.items.map((item) => ({
      name: item.name,
      description: item.tax_rate ? `GST ${item.tax_rate}%` : "No GST",
      quantity: item.quantity,
      unitPrice: item.unit_price,
      taxRate: item.tax_rate ?? 0,
    })),
    totals: {
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discount: invoice.discount,
      total: invoice.amount,
      cgst: invoice.tax > 0 ? invoice.tax / 2 : 0,
      sgst: invoice.tax > 0 ? invoice.tax / 2 : 0,
    },
    paymentSummary: {
      statusLabel: statusMeta.label,
      statusTone: statusMeta.tone,
      statusNote: statusMeta.note,
      paidAmount: invoice.status === "PAID" ? invoice.amount : 0,
      remainingAmount: invoice.status === "PAID" ? 0 : invoice.amount,
    },
    notes: invoice.notes ?? "",
    paymentInfo:
      invoice.business_email || invoice.business_phone
        ? [invoice.business_email, invoice.business_phone]
            .filter(Boolean)
            .join(" | ")
        : "Contact the business for payment instructions.",
    closingNote: "Thank you for your business.",
    signatureLabel: "Authorized signatory",
  };
};

export { DEFAULT_INVOICE_SECTIONS, DEFAULT_INVOICE_THEME };
