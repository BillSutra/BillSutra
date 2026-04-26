import prisma from "../../config/db.config.js";
import {
  Prisma,
} from "@prisma/client";
import type { InvoiceStatus, PaymentMethod, PaymentStatus, SaleStatus } from "@prisma/client";
import { calculateTotals } from "../../utils/calculateTotals.js";
import type { InvoiceCalcItem } from "../../utils/calculateTotals.js";
import { generateInvoiceNumber } from "../../utils/generateInvoiceNumber.js";
import { normalizeTaxMode } from "../../utils/invoiceCalculations.js";
import { launchPuppeteerBrowser } from "../../lib/launchPuppeteerBrowser.js";
import {
  buildPublicInvoiceReference,
  buildPublicInvoiceUrl,
} from "../../lib/appUrls.js";
import { renderPublicInvoiceHtml } from "./publicInvoiceView.js";
import {
  buildBusinessAddressLines,
  normalizeBusinessAddressDraft,
} from "../../lib/indianAddress.js";
import { getStateFromGstin } from "../../lib/gstin.js";
import {
  computeInvoicePaymentSnapshotFromPayments,
} from "../../utils/invoicePaymentSnapshot.js";
import {
  applyBillingSaleInventoryAdjustments,
  getBillingInventorySchemaSupport,
  restoreBillingSaleInventoryAdjustments,
  resolveBillingProducts,
  resolveBillingWarehouse,
} from "../../services/billingInventorySync.service.js";
import { enqueueInventorySanitization } from "../../queues/jobs/inventory.jobs.js";
import { renderInvoicePreviewPdfBuffer } from "./invoicePreviewPdf.service.js";

const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  OVERDUE: "OVERDUE",
  VOID: "VOID",
} as const satisfies Record<string, InvoiceStatus>;

const PAYMENT_STATUS = {
  PAID: "PAID",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  UNPAID: "UNPAID",
} as const satisfies Record<string, PaymentStatus>;

const SALE_STATUS = {
  COMPLETED: "COMPLETED",
} as const satisfies Record<string, SaleStatus>;

type ListInvoiceFilters = {
  status?: InvoiceStatus;
  clientId?: number;
  from?: Date;
  to?: Date;
};

type InvoicePaymentStatusInput = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export type PublicInvoiceViewData = {
  id: number;
  public_id: string;
  invoice_id: string;
  amount: number;
  subtotal: number;
  tax: number;
  tax_mode: "CGST_SGST" | "IGST" | "NONE";
  discount: number;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  discount_calculated: number;
  currency: string;
  status: InvoiceStatus;
  payment_status: "PAID" | "PENDING" | "FAILED" | "PARTIALLY_PAID";
  paid_amount: number;
  pending_amount: number;
  payment_method: string | null;
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

const publicInvoiceInclude = {
  customer: true,
  items: true,
  payments: {
    select: {
      id: true,
      amount: true,
      method: true,
      paid_at: true,
    },
    orderBy: {
      paid_at: "desc",
    },
  },
  user: {
    select: {
      business_profile: {
        select: {
          business_name: true,
          address: true,
          address_line1: true,
          city: true,
          state: true,
          pincode: true,
          phone: true,
          email: true,
          currency: true,
        },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

const invoicePaymentSelect = {
  id: true,
  amount: true,
  method: true,
  provider: true,
  transaction_id: true,
  reference: true,
  paid_at: true,
  created_at: true,
} satisfies Prisma.PaymentSelect;

const invoiceInclude = {
  customer: true,
  items: true,
  payments: {
    select: invoicePaymentSelect,
  },
} satisfies Prisma.InvoiceInclude;

type PublicInvoiceRecord = Prisma.InvoiceGetPayload<{
  include: typeof publicInvoiceInclude;
}>;

type CustomerInvoiceProfile = {
  customer_type: string | null;
  business_name: string | null;
  gstin: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
};

type InvoiceTemplateSnapshot = {
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: string[];
  sectionOrder?: string[];
  theme?: Record<string, unknown> | null;
  designConfig?: Record<string, unknown> | null;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const roundCurrencyAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeDiscountType = (value: unknown): "PERCENTAGE" | "FIXED" =>
  value === "PERCENTAGE" ? "PERCENTAGE" : "FIXED";

const normalizeInvoiceTaxMode = (
  value: unknown,
): "CGST_SGST" | "IGST" | "NONE" =>
  normalizeTaxMode(typeof value === "string" ? value : undefined);

const toAbsoluteBackendAssetUrl = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  const baseUrl = (
    process.env.BACKEND_URL ??
    process.env.APP_URL ??
    process.env.SERVER_URL ??
    `http://127.0.0.1:${process.env.PORT ?? 4000}`
  )
    .trim()
    .replace(/\/$/, "");

  if (!baseUrl) {
    return null;
  }

  const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${baseUrl}${normalizedPath}`;
};

const formatPreviewDate = (value?: Date | string | null) => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === "string" ? value : "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseInvoiceTemplateSnapshot = (
  value: Prisma.JsonValue | null | undefined,
): InvoiceTemplateSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  const enabledSections = Array.isArray(value.enabledSections)
    ? value.enabledSections.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : [];

  if (enabledSections.length === 0) {
    return null;
  }

  const sectionOrder = Array.isArray(value.sectionOrder)
    ? value.sectionOrder.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
      )
    : undefined;

  return {
    templateId:
      typeof value.templateId === "string" && value.templateId.trim()
        ? value.templateId
        : null,
    templateName:
      typeof value.templateName === "string" && value.templateName.trim()
        ? value.templateName
        : null,
    enabledSections,
    sectionOrder,
    theme: isRecord(value.theme) ? value.theme : null,
    designConfig: isRecord(value.designConfig) ? value.designConfig : null,
  };
};

type InvoiceGstMetadataRow = {
  id: number;
  total_base: Prisma.Decimal | number | null;
  total_cgst: Prisma.Decimal | number | null;
  total_sgst: Prisma.Decimal | number | null;
  total_igst: Prisma.Decimal | number | null;
  grand_total: Prisma.Decimal | number | null;
};

type InvoiceItemGstMetadataRow = {
  id: number;
  gst_type: string | null;
  base_amount: Prisma.Decimal | number | null;
  gst_amount: Prisma.Decimal | number | null;
  cgst_amount: Prisma.Decimal | number | null;
  sgst_amount: Prisma.Decimal | number | null;
  igst_amount: Prisma.Decimal | number | null;
};

const buildDiscountLabel = ({
  discountType,
  discountValue,
  currency,
}: {
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  currency: string;
}) => {
  if (discountType === "PERCENTAGE") {
    return `Discount (${roundCurrencyAmount(discountValue).toFixed(2)}%)`;
  }

  return `Discount (${formatCurrency(discountValue, currency)})`;
};

const normalizeStatusLabel = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const resolveDisplayPaymentStatusLabel = ({
  total,
  paidAmount,
  dueDate,
}: {
  total: number;
  paidAmount: number;
  dueDate: Date | null;
}) => {
  if (paidAmount >= total && total > 0) {
    return "Paid";
  }

  if (paidAmount > 0) {
    return "Partially Paid";
  }

  if (dueDate && dueDate.getTime() < Date.now()) {
    return "Pending";
  }

  return "Pending";
};

const resolvePublicInvoicePaymentStatus = ({
  status,
  total,
  paidAmount,
}: {
  status: InvoiceStatus;
  total: number;
  paidAmount: number;
}): PublicInvoiceViewData["payment_status"] => {
  if (paidAmount >= total && total > 0) {
    return "PAID";
  }

  if (paidAmount > 0) {
    return "PARTIALLY_PAID";
  }

  if (status === INVOICE_STATUS.VOID) {
    return "FAILED";
  }

  return "PENDING";
};

const createInvoiceValidationError = (
  message: string,
  errors: Record<string, string[]>,
) => {
  const error = new Error(message) as Error & {
    status?: number;
    errors?: Record<string, string[]>;
  };
  error.status = 422;
  error.errors = errors;
  return error;
};

const hasUnknownPrismaArgument = (error: unknown, argument: string) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes(`Unknown argument \`${argument}\``);
};

const buildSyncedSaleNote = (
  invoiceNumber: string,
  warehouseId?: number | null,
  notes?: string | null,
) => {
  const warehouseSuffix = warehouseId ? `, Warehouse ${warehouseId}` : "";
  const syncDescriptor = `Synced from invoice ${invoiceNumber}${warehouseSuffix}`;

  return notes?.trim()
    ? `${notes.trim()} (${syncDescriptor})`
    : syncDescriptor;
};

const findSyncedSalesWhereClause = (userId: number, invoiceNumber: string) => ({
  user_id: userId,
  notes: {
    contains: `Synced from invoice ${invoiceNumber}`,
  },
});

const validateDiscountInput = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: number;
  discountType: "PERCENTAGE" | "FIXED";
}) => {
  if (discountValue < 0) {
    throw createInvoiceValidationError("Discount cannot be negative.", {
      discount: ["Discount cannot be negative."],
    });
  }

  if (subtotal <= 0 && discountValue > 0) {
    throw createInvoiceValidationError("Add items first to apply a discount.", {
      discount: ["Add items first to apply a discount."],
    });
  }

  if (discountType === "PERCENTAGE" && discountValue > 100) {
    throw createInvoiceValidationError(
      "Discount percentage cannot exceed 100%.",
      {
        discount: ["Discount percentage cannot exceed 100%."],
      },
    );
  }

  if (discountType === "FIXED" && discountValue > subtotal) {
    throw createInvoiceValidationError(
      "Discount cannot exceed subtotal.",
      {
        discount: ["Discount cannot exceed subtotal."],
      },
    );
  }
};

const resolveRequestedInvoicePaymentStatus = (
  status?: InvoiceStatus,
  paymentStatus?: InvoicePaymentStatusInput,
): InvoicePaymentStatusInput => {
  if (paymentStatus) {
    return paymentStatus;
  }

  if (status === INVOICE_STATUS.PAID) {
    return "PAID";
  }

  if (status === INVOICE_STATUS.PARTIALLY_PAID) {
    return "PARTIALLY_PAID";
  }

  return "UNPAID";
};

const resolveInvoicePaymentState = (params: {
  total: number;
  status?: InvoiceStatus;
  payment_status?: InvoicePaymentStatusInput;
  amount_paid?: number | null;
  payment_method?: PaymentMethod | null;
  payment_date?: Date | string | null;
}) => {
  const total = roundCurrencyAmount(Math.max(0, params.total));
  const requestedPaymentStatus = resolveRequestedInvoicePaymentStatus(
    params.status,
    params.payment_status,
  );
  const paidInput =
    params.amount_paid === undefined || params.amount_paid === null
      ? undefined
      : roundCurrencyAmount(Math.max(0, Number(params.amount_paid)));

  const paymentDateProvided =
    params.payment_date !== undefined && params.payment_date !== null;
  const parsedPaymentDate = paymentDateProvided
    ? new Date(params.payment_date as Date | string)
    : null;

  if (
    paymentDateProvided &&
    (!parsedPaymentDate || Number.isNaN(parsedPaymentDate.getTime()))
  ) {
    throw createInvoiceValidationError("Invalid payment date.", {
      payment_date: ["Payment date must be a valid date."],
    });
  }

  if (requestedPaymentStatus !== "UNPAID" && total <= 0) {
    throw createInvoiceValidationError(
      "Cannot apply paid or partial payment to an empty invoice.",
      {
        amount_paid: ["Add at least one valid line item before recording payment."],
      },
    );
  }

  if (requestedPaymentStatus === "UNPAID") {
    if (params.status === INVOICE_STATUS.PAID) {
      throw createInvoiceValidationError(
        "Status conflicts with payment status.",
        {
          status: ["Status PAID requires a paid payment status."],
        },
      );
    }

    if (params.status === INVOICE_STATUS.PARTIALLY_PAID) {
      throw createInvoiceValidationError(
        "Status conflicts with payment status.",
        {
          status: [
            "Status PARTIALLY_PAID requires a partial payment status.",
          ],
        },
      );
    }

    if (paidInput !== undefined && paidInput > 0) {
      throw createInvoiceValidationError(
        "Paid amount is not allowed for unpaid invoices.",
        {
          amount_paid: [
            "Set paid amount to 0 or choose partial/paid payment status.",
          ],
        },
      );
    }

    const status =
      params.status === INVOICE_STATUS.DRAFT ||
      params.status === INVOICE_STATUS.VOID ||
      params.status === INVOICE_STATUS.SENT ||
      params.status === INVOICE_STATUS.OVERDUE
        ? params.status
        : INVOICE_STATUS.SENT;

    return {
      invoiceStatus: status,
      paymentStatus: requestedPaymentStatus,
      paidAmount: 0,
      remainingAmount: total,
      paymentMethod: null,
      paymentDate: null,
    };
  }

  if (!params.payment_method) {
    throw createInvoiceValidationError("Payment method is required.", {
      payment_method: [
        "Payment method is required for paid and partial invoices.",
      ],
    });
  }

  if (requestedPaymentStatus === "PAID") {
    if (paidInput !== undefined && Math.abs(paidInput - total) > 0.009) {
      throw createInvoiceValidationError(
        "Paid invoices must be fully settled.",
        {
          amount_paid: [
            "For paid invoices, amount_paid must match the invoice total.",
          ],
        },
      );
    }

    return {
      invoiceStatus: INVOICE_STATUS.PAID,
      paymentStatus: requestedPaymentStatus,
      paidAmount: total,
      remainingAmount: 0,
      paymentMethod: params.payment_method,
      paymentDate: parsedPaymentDate ?? new Date(),
    };
  }

  if (paidInput === undefined || paidInput <= 0) {
    throw createInvoiceValidationError(
      "Partial payment requires a positive paid amount.",
      {
        amount_paid: [
          "For partially paid invoices, amount_paid must be greater than 0.",
        ],
      },
    );
  }

  if (paidInput >= total) {
    throw createInvoiceValidationError(
      "Partial payment must be smaller than invoice total.",
      {
        amount_paid: [
          "For partially paid invoices, amount_paid must be less than total.",
        ],
      },
    );
  }

  return {
    invoiceStatus: INVOICE_STATUS.PARTIALLY_PAID,
    paymentStatus: requestedPaymentStatus,
    paidAmount: paidInput,
    remainingAmount: roundCurrencyAmount(total - paidInput),
    paymentMethod: params.payment_method,
    paymentDate: parsedPaymentDate ?? new Date(),
  };
};

const formatCurrency = (value: unknown, currency = "INR") => {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (value: Date | null | undefined) => {
  if (!value) {
    return "-";
  }

  return value.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const attachInvoiceGstMetadata = async <
  T extends
    | (Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }> & {
        [key: string]: unknown;
      })
    | null,
>(invoice: T) => {
  if (!invoice) {
    return invoice;
  }

  const paymentSnapshot = computeInvoicePaymentSnapshotFromPayments({
    total: invoice.total,
    status: invoice.status,
    dueDate: "due_date" in invoice ? invoice.due_date : null,
    payments: invoice.payments,
  });

  const [invoiceRows, itemRows] = await Promise.all([
    prisma.$queryRaw<InvoiceGstMetadataRow[]>(Prisma.sql`
      SELECT id, total_base, total_cgst, total_sgst, total_igst, grand_total
      FROM "invoices"
      WHERE id = ${invoice.id}
      LIMIT 1
    `),
    prisma.$queryRaw<InvoiceItemGstMetadataRow[]>(Prisma.sql`
      SELECT id, gst_type, base_amount, gst_amount, cgst_amount, sgst_amount, igst_amount
      FROM "invoice_items"
      WHERE invoice_id = ${invoice.id}
    `),
  ]);

  const invoiceRow = invoiceRows[0];
  const itemMetaById = new Map(itemRows.map((row) => [row.id, row]));

  return {
    ...invoice,
    total_base: invoiceRow?.total_base ?? null,
    total_cgst: invoiceRow?.total_cgst ?? null,
    total_sgst: invoiceRow?.total_sgst ?? null,
    total_igst: invoiceRow?.total_igst ?? null,
    grand_total: invoiceRow?.grand_total ?? null,
    totalPaid: paymentSnapshot.paidAmount,
    computedStatus: paymentSnapshot.dynamicPaymentStatus,
    items: invoice.items.map((item) => {
      const meta = itemMetaById.get(item.id);
      return {
        ...item,
        gst_type: meta?.gst_type ?? null,
        base_amount: meta?.base_amount ?? null,
        gst_amount: meta?.gst_amount ?? null,
        cgst_amount: meta?.cgst_amount ?? null,
        sgst_amount: meta?.sgst_amount ?? null,
        igst_amount: meta?.igst_amount ?? null,
      };
    }),
  } as T;
};

const escapeHtml = (text: unknown) =>
  String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const normalizeCustomerType = (value: unknown) =>
  value === "business" ? "business" : "individual";

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isCustomerSchemaMismatchError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const code = (error.meta as { code?: string } | undefined)?.code;
      return code === "42703" || code === "42P01";
    }
  }

  if (error instanceof Error) {
    return (
      /business_name/i.test(error.message) ||
      /customer_type/i.test(error.message) ||
      /address_line1/i.test(error.message)
    );
  }

  return false;
};

const fetchCustomerInvoiceProfile = async (
  userId: number,
  customerId: number,
): Promise<CustomerInvoiceProfile | null> => {
  try {
    const rows = await prisma.$queryRaw<
      Array<
        CustomerInvoiceProfile & {
          id: number;
        }
      >
    >(Prisma.sql`
      SELECT
        id,
        customer_type,
        business_name,
        gstin,
        address_line1,
        city,
        state,
        pincode
      FROM "customers"
      WHERE id = ${customerId}
        AND user_id = ${userId}
      LIMIT 1
    `);

    return rows[0] ?? null;
  } catch (error) {
    if (isCustomerSchemaMismatchError(error)) {
      return null;
    }

    throw error;
  }
};

const buildCustomerAddressLines = (
  customerAddress: string | null | undefined,
  customerProfile?: CustomerInvoiceProfile | null,
) => {
  const normalizedStructuredAddress = normalizeBusinessAddressDraft({
    addressLine1: customerProfile?.address_line1 ?? undefined,
    city: customerProfile?.city ?? undefined,
    state: customerProfile?.state ?? undefined,
    pincode: customerProfile?.pincode ?? undefined,
  });

  return buildBusinessAddressLines(
    normalizedStructuredAddress,
    customerAddress,
  );
};

export const buildInvoicePdfPreviewPayload = (params: {
  invoice: {
    invoice_number: string;
    date: Date;
    due_date: Date | null;
    status: InvoiceStatus;
    notes: string | null;
    subtotal: unknown;
    total_base?: unknown;
    tax: unknown;
    tax_mode: unknown;
    total_cgst?: unknown;
    total_sgst?: unknown;
    total_igst?: unknown;
    discount: unknown;
    discount_type: unknown;
    discount_value: unknown;
    discount_calculated?: unknown;
    total: unknown;
    grand_total?: unknown;
    template_snapshot?: Prisma.JsonValue | null;
    payments: Array<{
      id: number;
      amount: Prisma.Decimal | number;
      method: PaymentMethod | null;
      paid_at: Date;
    }>;
    customer: {
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    };
    items: Array<{
      name: string;
      quantity: number;
      price: unknown;
      tax_rate: unknown;
      gst_type?: string | null;
      base_amount?: unknown;
      gst_amount?: unknown;
      cgst_amount?: unknown;
      sgst_amount?: unknown;
      igst_amount?: unknown;
      total: unknown;
    }>;
  };
  company: {
    business_name: string;
    address: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    website?: string | null;
    logo_url: string | null;
    tax_id: string | null;
    currency: string;
    show_logo_on_invoice?: boolean | null;
    show_tax_number?: boolean | null;
    show_payment_qr?: boolean | null;
  } | null;
  customerProfile?: CustomerInvoiceProfile | null;
}) => {
  const templateSnapshot = parseInvoiceTemplateSnapshot(
    params.invoice.template_snapshot,
  );
  if (!templateSnapshot) {
    return null;
  }

  const { invoice, company, customerProfile } = params;
  const currency = company?.currency ?? "INR";
  const paidAmount = invoice.payments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const totalAmount = toNumber(invoice.total);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const businessState =
    getStateFromGstin(company?.tax_id) || company?.state || "";
  const customerState =
    getStateFromGstin(customerProfile?.gstin) || customerProfile?.state || "";
  const taxMode =
    normalizeInvoiceTaxMode(invoice.tax_mode) === "NONE" && toNumber(invoice.tax) > 0
      ? businessState && customerState && businessState !== customerState
        ? "IGST"
        : "CGST_SGST"
      : normalizeInvoiceTaxMode(invoice.tax_mode);
  const latestPayment = [...invoice.payments].sort(
    (left, right) => right.paid_at.getTime() - left.paid_at.getTime(),
  )[0];
  const customerType =
    customerProfile?.customer_type === "business" ? "business" : "individual";
  const customerBusinessName = customerProfile?.business_name ?? "";
  const customerDisplayName =
    customerType === "business" && customerBusinessName
      ? customerBusinessName
      : invoice.customer.name;
  const discountType = normalizeDiscountType(invoice.discount_type);
  const discountValue = toNumber(invoice.discount_value);
  const companyAddressLines = buildBusinessAddressLines(
    {
      addressLine1: company?.address_line1 ?? undefined,
      city: company?.city ?? undefined,
      state: company?.state ?? undefined,
      pincode: company?.pincode ?? undefined,
    },
    company?.address,
  );
  const customerAddressLines = buildCustomerAddressLines(
    invoice.customer.address,
    customerProfile,
  );

  return {
    templateId: templateSnapshot.templateId ?? null,
    templateName: templateSnapshot.templateName ?? null,
    enabledSections: templateSnapshot.enabledSections,
    sectionOrder: templateSnapshot.sectionOrder,
    theme: templateSnapshot.theme ?? undefined,
    designConfig: templateSnapshot.designConfig ?? undefined,
    data: {
      invoiceTitle: taxMode === "NONE" ? "Bill" : "Tax Invoice",
      invoiceNumber: invoice.invoice_number,
      invoiceDate: formatPreviewDate(invoice.date),
      dueDate: formatPreviewDate(invoice.due_date),
      placeOfSupply: customerState || businessState || "",
      taxMode,
      business: {
        businessName: company?.business_name ?? "BillSutra",
        businessAddress: company
          ? {
              addressLine1: company.address_line1 ?? "",
              city: company.city ?? "",
              state: company.state ?? "",
              pincode: company.pincode ?? "",
            }
          : undefined,
        address: companyAddressLines.join(", "),
        phone: company?.phone ?? "",
        email: company?.email ?? "",
        website: company?.website ?? "",
        logoUrl: toAbsoluteBackendAssetUrl(company?.logo_url) ?? "",
        taxId: company?.tax_id ?? "",
        currency,
        showLogoOnInvoice: company?.show_logo_on_invoice ?? false,
        showTaxNumber: company?.show_tax_number ?? true,
        showPaymentQr: company?.show_payment_qr ?? false,
      },
      client: {
        name: customerDisplayName,
        type: customerType,
        businessName: customerBusinessName,
        gstin: customerProfile?.gstin ?? "",
        email: invoice.customer.email ?? "",
        phone: invoice.customer.phone ?? "",
        address: customerAddressLines.join(", "),
      },
      items: invoice.items.map((item) => ({
        name: item.name,
        description:
          item.gst_type === "IGST"
            ? `IGST ${toNumber(item.tax_rate)}%`
            : item.gst_type === "CGST_SGST"
              ? `CGST ${roundCurrencyAmount(toNumber(item.tax_rate) / 2)}% + SGST ${roundCurrencyAmount(toNumber(item.tax_rate) / 2)}%`
              : "",
        quantity: Number(item.quantity ?? 0),
        unitPrice: toNumber(item.price),
        taxRate: toNumber(item.tax_rate),
        gstType:
          item.gst_type === "IGST" || item.gst_type === "CGST_SGST"
            ? item.gst_type
            : undefined,
        baseAmount: toNumber(item.base_amount) || undefined,
        gstAmount: toNumber(item.gst_amount) || undefined,
        cgstAmount: toNumber(item.cgst_amount) || undefined,
        sgstAmount: toNumber(item.sgst_amount) || undefined,
        igstAmount: toNumber(item.igst_amount) || undefined,
        taxableValue: toNumber(item.base_amount) || undefined,
        amount: toNumber(item.total),
      })),
      totals: {
        subtotal: toNumber(invoice.subtotal),
        totalBase: toNumber(invoice.total_base ?? invoice.subtotal),
        tax: toNumber(invoice.tax),
        discount: toNumber(invoice.discount),
        total: totalAmount,
        cgst: toNumber(invoice.total_cgst),
        sgst: toNumber(invoice.total_sgst),
        igst: toNumber(invoice.total_igst),
        grandTotal: toNumber(invoice.grand_total ?? invoice.total),
        roundOff: 0,
      },
      discount: {
        type: discountType,
        value: discountValue,
        calculatedAmount: toNumber(
          invoice.discount_calculated ?? invoice.discount,
        ),
        label: buildDiscountLabel({
          discountType,
          discountValue,
          currency,
        }),
      },
      paymentSummary: {
        statusLabel: resolveDisplayPaymentStatusLabel({
          total: totalAmount,
          paidAmount,
          dueDate: invoice.due_date,
        }),
        statusTone:
          paidAmount >= totalAmount && totalAmount > 0
            ? "paid"
            : paidAmount > 0
              ? "partial"
              : "pending",
        statusNote:
          paidAmount >= totalAmount && totalAmount > 0
            ? "Settled in full"
            : paidAmount > 0
              ? "Part payment received"
              : "Awaiting payment",
        paidAmount,
        remainingAmount,
        history: invoice.payments.map((payment) => ({
          id: payment.id,
          amount: toNumber(payment.amount),
          paidAt: formatPreviewDate(payment.paid_at),
          method: payment.method?.replaceAll("_", " ") ?? null,
        })),
      },
      payment: {
        mode: latestPayment?.method?.replaceAll("_", " ") ?? "",
      },
      notes: invoice.notes ?? "",
      paymentInfo:
        company?.email || company?.phone
          ? [company?.email, company?.phone].filter(Boolean).join(" | ")
          : "Contact the business for payment instructions.",
      closingNote: "Thank you for your business.",
      signatureLabel: "Authorized signatory",
    },
  };
};

const buildInvoicePdfHtml = (
  invoice: {
    invoice_number: string;
    date: Date;
    due_date: Date | null;
    status: InvoiceStatus;
    notes: string | null;
    subtotal: unknown;
    tax: unknown;
    tax_mode: unknown;
    discount: unknown;
    discount_type: unknown;
    discount_value: unknown;
    total: unknown;
    payments: Array<{
      id: number;
      amount: Prisma.Decimal | number;
      method: PaymentMethod | null;
      paid_at: Date;
    }>;
    customer: {
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    };
    items: Array<{
      name: string;
      quantity: number;
      price: unknown;
      tax_rate: unknown;
      total: unknown;
    }>;
  },
  company: {
    business_name: string;
    address: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
    tax_id: string | null;
    currency: string;
  } | null,
  customerProfile?: CustomerInvoiceProfile | null,
) => {
  const currency = company?.currency ?? "INR";
  const totalAmount = toNumber(invoice.total);
  const taxMode = normalizeInvoiceTaxMode(invoice.tax_mode);
  const discountType = normalizeDiscountType(invoice.discount_type);
  const discountValue = toNumber(invoice.discount_value);
  const discountLabel = buildDiscountLabel({
    discountType,
    discountValue,
    currency,
  });
  const companyLogoUrl = toAbsoluteBackendAssetUrl(company?.logo_url);
  const paidFromPayments = invoice.payments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const paidAmount =
    paidFromPayments > 0
      ? Math.max(0, Math.min(paidFromPayments, totalAmount))
      : invoice.status === INVOICE_STATUS.PAID
        ? totalAmount
        : 0;
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentStatusLabel = resolveDisplayPaymentStatusLabel({
    total: totalAmount,
    paidAmount,
    dueDate: invoice.due_date,
  });
  const latestPayment = [...invoice.payments].sort(
    (left, right) => right.paid_at.getTime() - left.paid_at.getTime(),
  )[0];

  const companyAddressLines = buildBusinessAddressLines(
    {
      addressLine1: company?.address_line1 ?? undefined,
      city: company?.city ?? undefined,
      state: company?.state ?? undefined,
      pincode: company?.pincode ?? undefined,
    },
    company?.address,
  );
  const customerType = normalizeCustomerType(customerProfile?.customer_type);
  const customerBusinessName = toNullableString(customerProfile?.business_name);
  const customerGstin = toNullableString(customerProfile?.gstin);
  const customerDisplayName =
    customerType === "business" && customerBusinessName
      ? customerBusinessName
      : invoice.customer.name;
  const customerAddressLines = buildCustomerAddressLines(
    invoice.customer.address,
    customerProfile,
  );

  const itemRows = invoice.items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.price, currency)}</td>
          <td>${item.tax_rate == null ? "-" : `${toNumber(item.tax_rate)}%`}</td>
          <td>${formatCurrency(item.total, currency)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Invoice ${escapeHtml(invoice.invoice_number)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 24px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 24px;
          }
          h1 {
            margin: 0;
            font-size: 28px;
          }
          h2 {
            font-size: 16px;
            margin: 0 0 8px;
          }
          .muted {
            color: #6b7280;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 10px;
            font-size: 12px;
            text-align: left;
          }
          th {
            background: #f9fafb;
          }
          .totals {
            width: 320px;
            margin-left: auto;
            margin-top: 16px;
          }
          .totals table td {
            border: none;
            border-bottom: 1px solid #e5e7eb;
          }
          .totals .final td {
            font-weight: 700;
            font-size: 14px;
          }
          .notes {
            margin-top: 24px;
            padding: 12px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
          }
          .company-block {
            display: flex;
            gap: 16px;
            align-items: flex-start;
          }
          .logo-box {
            width: 64px;
            height: 64px;
            border-radius: 16px;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            overflow: hidden;
          }
          .logo-box img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <div class="row">
          <div>
            <h1>Invoice</h1>
            <div class="muted">#${escapeHtml(invoice.invoice_number)}</div>
            <div class="muted">Issue Date: ${formatDate(invoice.date)}</div>
            <div class="muted">Due Date: ${formatDate(invoice.due_date)}</div>
            <div class="muted">Status: ${escapeHtml(paymentStatusLabel)}</div>
            <div class="muted">Paid: ${formatCurrency(paidAmount, currency)} | Balance: ${formatCurrency(remainingAmount, currency)}</div>
            ${
              latestPayment
                ? `<div class="muted">Last payment: ${formatDate(latestPayment.paid_at)} (${escapeHtml(normalizeStatusLabel(latestPayment.method ?? "OTHER"))})</div>`
                : ""
            }
          </div>
          <div>
            <h2>Company Details</h2>
            <div class="company-block">
              <div class="logo-box">
                ${
                  companyLogoUrl
                    ? `<img src="${escapeHtml(companyLogoUrl)}" alt="${escapeHtml(company?.business_name ?? "Business")} logo" />`
                    : `<span class="muted">Logo</span>`
                }
              </div>
              <div>
                <div>${escapeHtml(company?.business_name ?? "Your Business")}</div>
                ${companyAddressLines
                  .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
                  .join("")}
                <div class="muted">${escapeHtml(company?.phone ?? "")}</div>
                <div class="muted">${escapeHtml(company?.email ?? "")}</div>
                <div class="muted">Tax ID: ${escapeHtml(company?.tax_id ?? "-")}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="row" style="margin-top: 24px;">
          <div>
            <h2>Bill To</h2>
            <div>${escapeHtml(customerDisplayName)}</div>
            ${customerType === "business" ? `<div class="muted">Type: Business</div>` : ""}
            ${customerType === "business" && customerGstin ? `<div class="muted">GSTIN: ${escapeHtml(customerGstin)}</div>` : ""}
            <div class="muted">${escapeHtml(invoice.customer.email ?? "")}</div>
            <div class="muted">${escapeHtml(invoice.customer.phone ?? "")}</div>
            ${customerAddressLines
              .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
              .join("")}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Tax</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="totals">
          <table>
            <tr>
              <td>Subtotal</td>
              <td>${formatCurrency(invoice.subtotal, currency)}</td>
            </tr>
            <tr>
              <td>Tax</td>
              <td>${formatCurrency(invoice.tax, currency)}</td>
            </tr>
            ${
              taxMode === "CGST_SGST"
                ? `
            <tr>
              <td>CGST</td>
              <td>${formatCurrency(roundCurrencyAmount(toNumber(invoice.tax) / 2), currency)}</td>
            </tr>
            <tr>
              <td>SGST</td>
              <td>${formatCurrency(roundCurrencyAmount(toNumber(invoice.tax) / 2), currency)}</td>
            </tr>
            `
                : taxMode === "IGST"
                  ? `
            <tr>
              <td>IGST</td>
              <td>${formatCurrency(invoice.tax, currency)}</td>
            </tr>
            `
                  : ""
            }
            <tr>
              <td>${discountLabel}</td>
              <td>-${formatCurrency(invoice.discount, currency)}</td>
            </tr>
            <tr class="final">
              <td>Grand Total</td>
              <td>${formatCurrency(invoice.total, currency)}</td>
            </tr>
            <tr>
              <td>Paid Amount</td>
              <td>${formatCurrency(paidAmount, currency)}</td>
            </tr>
            <tr>
              <td>Balance Due</td>
              <td>${formatCurrency(remainingAmount, currency)}</td>
            </tr>
          </table>
        </div>

        ${invoice.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</div>` : ""}
      </body>
    </html>
  `;
};

const syncOverdueInvoices = async (userId: number) => {
  const now = new Date();

  await prisma.invoice.updateMany({
    where: {
      user_id: userId,
      due_date: { lt: now },
      status: { not: INVOICE_STATUS.PAID },
    },
    data: {
      status: INVOICE_STATUS.OVERDUE,
    },
  });
};

const markPublicInvoiceOverdueIfNeeded = async (invoice: {
  id: number;
  due_date: Date | null;
  status: InvoiceStatus;
}) => {
  if (
    invoice.due_date &&
    invoice.due_date < new Date() &&
    invoice.status !== INVOICE_STATUS.PAID &&
    invoice.status !== INVOICE_STATUS.OVERDUE
  ) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: INVOICE_STATUS.OVERDUE },
    });

    invoice.status = INVOICE_STATUS.OVERDUE;
  }
};

const mapPublicInvoice = (
  invoice: {
    id: number;
    invoice_number: string;
    status: InvoiceStatus;
    date: Date;
    due_date: Date | null;
    notes: string | null;
    subtotal: unknown;
    tax: unknown;
    tax_mode: unknown;
    discount: unknown;
    discount_type: unknown;
    discount_value: unknown;
    discount_calculated: unknown;
    total: unknown;
    payments: Array<{
      id: number;
      amount: Prisma.Decimal | number;
      method: PaymentMethod | null;
      paid_at: Date;
    }>;
    customer: {
      name: string;
      email: string | null;
      phone: string | null;
      address: string | null;
    };
    items: Array<{
      name: string;
      quantity: number;
      price: unknown;
      tax_rate: unknown;
      total: unknown;
    }>;
    user: {
      business_profile: {
        business_name: string;
        address: string | null;
        address_line1: string | null;
        city: string | null;
        state: string | null;
        pincode: string | null;
        phone: string | null;
        email: string | null;
        currency: string;
      } | null;
    };
  },
  customerProfile?: CustomerInvoiceProfile | null,
): PublicInvoiceViewData => {
  const currency = invoice.user.business_profile?.currency ?? "INR";
  const amount = toNumber(invoice.total);
  const paidAmount = roundCurrencyAmount(
    invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
  );
  const pendingAmount = roundCurrencyAmount(Math.max(amount - paidAmount, 0));
  const paymentStatus = resolvePublicInvoicePaymentStatus({
    status: invoice.status,
    total: amount,
    paidAmount,
  });
  const latestPaymentMethod = invoice.payments[0]?.method ?? null;
  const businessProfile = invoice.user.business_profile;
  const customerType = normalizeCustomerType(customerProfile?.customer_type);
  const customerBusinessName = toNullableString(customerProfile?.business_name);
  const customerDisplayName =
    customerType === "business" && customerBusinessName
      ? customerBusinessName
      : invoice.customer.name;
  const customerAddressLines = buildCustomerAddressLines(
    invoice.customer.address,
    customerProfile,
  );
  const customerAddress =
    customerAddressLines.length > 0 ? customerAddressLines.join("\n") : null;
  const businessAddressLines = buildBusinessAddressLines(
    {
      addressLine1: businessProfile?.address_line1 ?? undefined,
      city: businessProfile?.city ?? undefined,
      state: businessProfile?.state ?? undefined,
      pincode: businessProfile?.pincode ?? undefined,
    },
    businessProfile?.address,
  );
  const businessAddress =
    businessAddressLines.length > 0 ? businessAddressLines.join("\n") : null;

  return {
    id: invoice.id,
    public_id: buildPublicInvoiceReference(invoice.id, invoice.invoice_number),
    invoice_id: invoice.invoice_number,
    amount,
    subtotal: toNumber(invoice.subtotal),
    tax: toNumber(invoice.tax),
    tax_mode: normalizeInvoiceTaxMode(invoice.tax_mode),
    discount: toNumber(invoice.discount),
    discount_type: normalizeDiscountType(invoice.discount_type),
    discount_value: toNumber(invoice.discount_value),
    discount_calculated: toNumber(invoice.discount_calculated),
    currency,
    status: invoice.status,
    payment_status: paymentStatus,
    paid_amount: paidAmount,
    pending_amount: pendingAmount,
    payment_method: latestPaymentMethod,
    date: invoice.date.toISOString(),
    due_date: invoice.due_date?.toISOString() ?? null,
    notes: invoice.notes,
    customer_type: customerType,
    customer_display_name: customerDisplayName,
    customer_name: customerDisplayName,
    customer_business_name: customerBusinessName,
    customer_gstin: toNullableString(customerProfile?.gstin),
    email: invoice.customer.email,
    customer_phone: invoice.customer.phone,
    customer_address: customerAddress,
    business_name: businessProfile?.business_name ?? "BillSutra",
    business_email: businessProfile?.email ?? null,
    business_phone: businessProfile?.phone ?? null,
    business_address: businessAddress,
    public_url: buildPublicInvoiceUrl(invoice.id, invoice.invoice_number),
    items: invoice.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit_price: toNumber(item.price),
      tax_rate: item.tax_rate == null ? null : toNumber(item.tax_rate),
      line_total: toNumber(item.total),
    })),
  };
};

export const listInvoices = async (
  userId: number,
  filters: ListInvoiceFilters = {},
) => {
  await syncOverdueInvoices(userId);

  const where: Prisma.InvoiceWhereInput = {
    user_id: userId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.clientId) {
    where.customer_id = filters.clientId;
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(invoices.map((invoice) => attachInvoiceGstMetadata(invoice)));
};

export const getInvoiceBootstrap = async (userId: number) => {
  const [customers, products, warehouses] = await prisma.$transaction([
    prisma.customer.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
      },
      orderBy: { created_at: "desc" },
      take: 1000,
    }),
    prisma.product.findMany({
      where: { user_id: userId },
      include: { category: true },
      orderBy: { created_at: "desc" },
      take: 1000,
    }),
    prisma.warehouse.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return {
    customers,
    products,
    warehouses,
    defaults: {
      invoiceDate: today,
      dueDate: today,
      taxMode: "CGST_SGST",
      invoiceNumberPreview: generateInvoiceNumber(null),
    },
  };
};

export const createInvoice = async (
  userId: number,
  payload: {
    customer_id: number;
    date?: Date | string | null;
    due_date?: Date | string | null;
    discount?: number | null;
    discount_type?: "PERCENTAGE" | "FIXED" | null;
    tax_mode?: "CGST_SGST" | "IGST" | "NONE" | null;
    status?: InvoiceStatus;
    payment_status?: InvoicePaymentStatusInput;
    amount_paid?: number | null;
    payment_date?: Date | string | null;
    payment_method?: PaymentMethod | null;
    notes?: string | null;
    template_snapshot?: InvoiceTemplateSnapshot | null;
    sync_sales?: boolean;
    warehouse_id?: number | null;
    items: InvoiceCalcItem[];
  },
) => {
  const discountType = normalizeDiscountType(payload.discount_type);
  const taxMode = normalizeInvoiceTaxMode(payload.tax_mode);
  const discountValue = Math.max(0, Number(payload.discount ?? 0));
  const subtotalBeforeDiscount = payload.items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );

  validateDiscountInput({
    subtotal: roundCurrencyAmount(subtotalBeforeDiscount),
    discountValue,
    discountType,
  });

  const latest = await prisma.invoice.findFirst({
    where: { user_id: userId },
    orderBy: { createdAt: "desc" },
    select: { invoice_number: true },
  });

  const invoiceNumber = generateInvoiceNumber(latest?.invoice_number);
  const totals = calculateTotals(
    payload.items,
    discountValue,
    discountType,
    taxMode,
  );

  const syncSales =
    payload.sync_sales === true &&
    payload.status !== INVOICE_STATUS.DRAFT &&
    payload.status !== INVOICE_STATUS.VOID;
  const paymentState = resolveInvoicePaymentState({
    total: totals.total,
    status: payload.status,
    payment_status: payload.payment_status,
    amount_paid: payload.amount_paid,
    payment_date: payload.payment_date,
    payment_method: payload.payment_method,
  });

  const syncedSalePaymentStatus =
    paymentState.paymentStatus === "PAID"
      ? PAYMENT_STATUS.PAID
      : paymentState.paymentStatus === "PARTIALLY_PAID"
        ? PAYMENT_STATUS.PARTIALLY_PAID
        : PAYMENT_STATUS.UNPAID;

  const result = await prisma.$transaction(async (tx) => {
    const schemaSupport = syncSales
      ? await getBillingInventorySchemaSupport(tx)
      : {
          allowNegativeStockPreference: false,
          invoiceItemNonInventoryFlag: false,
          saleItemNonInventoryFlag: false,
        };
    const warehouse = syncSales
      ? await resolveBillingWarehouse(tx, userId, payload.warehouse_id)
      : null;
    const resolvedItems = syncSales
      ? await resolveBillingProducts(tx, userId, totals.items)
      : totals.items.map((item) => ({
          product_id: item.product_id as number,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          nonInventoryItem: false,
          tax_rate: item.tax_rate ?? undefined,
          gst_type: item.gst_type,
        }));

    const itemPayload = resolvedItems.map((item, index) => ({
      product_id: syncSales ? item.product_id : totals.items[index]?.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      ...(schemaSupport.invoiceItemNonInventoryFlag
        ? { nonInventoryItem: item.nonInventoryItem }
        : {}),
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      total: totals.items[index]?.total ?? item.quantity * item.price,
    }));

    const itemMetadata = resolvedItems.map((item, index) => ({
      gstType: totals.items[index]?.gst_type ?? item.gst_type ?? taxMode,
      baseAmount: totals.items[index]?.baseAmount ?? item.quantity * item.price,
      gstAmount: totals.items[index]?.lineTax ?? 0,
      cgstAmount: totals.items[index]?.cgst ?? 0,
      sgstAmount: totals.items[index]?.sgst ?? 0,
      igstAmount: totals.items[index]?.igst ?? 0,
    }));

    if (syncSales) {
      if (!warehouse) {
        throw createInvoiceValidationError("Warehouse resolution failed.", {
          warehouse_id: ["Unable to determine a warehouse for this invoice."],
        });
      }
    }

    const invoiceCreateData = {
      user_id: userId,
      customer_id: payload.customer_id,
      invoice_number: invoiceNumber,
      warehouse_id: warehouse?.id ?? payload.warehouse_id ?? undefined,
      stock_applied: syncSales,
      date: payload.date ?? undefined,
      due_date: payload.due_date ?? undefined,
      status: paymentState.invoiceStatus,
      subtotal: totals.subtotal,
      tax: totals.tax,
      tax_mode: taxMode,
      discount: totals.discount,
      discount_type: discountType,
      discount_value: discountValue,
      discount_calculated: totals.discount,
      total: totals.total,
      notes: payload.notes ?? undefined,
      template_snapshot: payload.template_snapshot
        ? (payload.template_snapshot as Prisma.InputJsonValue)
        : undefined,
      items: { create: itemPayload },
    };

    let invoice;
    try {
      invoice = await tx.invoice.create({
        data: invoiceCreateData,
        include: {
          items: true,
          payments: {
            select: invoicePaymentSelect,
          },
        },
      });
    } catch (error) {
      const shouldRetryWithoutInvoiceInventoryFields =
        hasUnknownPrismaArgument(error, "warehouse_id") ||
        hasUnknownPrismaArgument(error, "stock_applied");
      const shouldRetryWithoutItemInventoryFlag = hasUnknownPrismaArgument(
        error,
        "nonInventoryItem",
      );

      if (
        !shouldRetryWithoutInvoiceInventoryFields &&
        !shouldRetryWithoutItemInventoryFlag
      ) {
        throw error;
      }

      const fallbackItemPayload = itemPayload.map((item) => {
        const { nonInventoryItem, ...rest } = item as typeof item & {
          nonInventoryItem?: boolean;
        };
        return rest;
      });

      const {
        warehouse_id: _warehouseId,
        stock_applied: _stockApplied,
        ...fallbackInvoiceCreateData
      } = invoiceCreateData;

      invoice = await tx.invoice.create({
        data: {
          ...fallbackInvoiceCreateData,
          items: { create: fallbackItemPayload },
        },
        include: {
          items: true,
          payments: {
            select: invoicePaymentSelect,
          },
        },
      });
    }

    await tx.$executeRaw(Prisma.sql`
      UPDATE "invoices"
      SET
        "total_base" = ${totals.totalBase},
        "total_cgst" = ${totals.cgst},
        "total_sgst" = ${totals.sgst},
        "total_igst" = ${totals.igst},
        "grand_total" = ${totals.total}
      WHERE "id" = ${invoice.id}
    `);

    if (warehouse?.id || syncSales) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "invoices"
        SET
          "warehouse_id" = ${warehouse?.id ?? payload.warehouse_id ?? null},
          "stock_applied" = ${syncSales}
        WHERE "id" = ${invoice.id}
      `);
    }

    const persistedItems = await tx.invoiceItem.findMany({
      where: { invoice_id: invoice.id },
      orderBy: { id: "asc" },
      select: { id: true },
    });

    await Promise.all(
      persistedItems.map((item, index) =>
        tx.$executeRaw(Prisma.sql`
          UPDATE "invoice_items"
          SET
            "non_inventory_item" = ${resolvedItems[index]?.nonInventoryItem ?? false},
            "gst_type" = ${itemMetadata[index]?.gstType ?? "NONE"},
            "base_amount" = ${itemMetadata[index]?.baseAmount ?? 0},
            "gst_amount" = ${itemMetadata[index]?.gstAmount ?? 0},
            "cgst_amount" = ${itemMetadata[index]?.cgstAmount ?? 0},
            "sgst_amount" = ${itemMetadata[index]?.sgstAmount ?? 0},
            "igst_amount" = ${itemMetadata[index]?.igstAmount ?? 0}
          WHERE "id" = ${item.id}
        `),
      ),
    );

    if (paymentState.paidAmount > 0 && paymentState.paymentMethod) {
      await tx.payment.create({
        data: {
          user_id: userId,
          invoice_id: invoice.id,
          amount: paymentState.paidAmount,
          method: paymentState.paymentMethod,
          paid_at: paymentState.paymentDate ?? new Date(),
        },
        select: invoicePaymentSelect,
      });
    }

    let negativeInventoryProducts: Array<{
      productId: number;
      warehouseId: number;
      stockOnHand: number;
      inventoryQuantity: number | null;
      issueDetected: boolean;
    }> = [];

    if (syncSales) {
      const saleItems = resolvedItems.map((item, index) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        ...(schemaSupport.saleItemNonInventoryFlag
          ? { nonInventoryItem: item.nonInventoryItem }
          : {}),
        unit_price: item.price,
        tax_rate: item.tax_rate ?? undefined,
        line_total: totals.items[index]?.total ?? item.quantity * item.price,
      }));

      try {
        await tx.sale.create({
          data: {
            user_id: userId,
            customer_id: payload.customer_id,
            sale_date: payload.date ?? undefined,
            status: SALE_STATUS.COMPLETED,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            totalAmount: totals.total,
            paidAmount: paymentState.paidAmount,
            pendingAmount: paymentState.remainingAmount,
            paymentStatus: syncedSalePaymentStatus,
            paymentDate: paymentState.paymentDate ?? undefined,
            paymentMethod: paymentState.paymentMethod ?? undefined,
            notes: buildSyncedSaleNote(invoiceNumber, warehouse?.id, payload.notes),
            items: { create: saleItems },
          },
        });
      } catch (error) {
        if (!hasUnknownPrismaArgument(error, "nonInventoryItem")) {
          throw error;
        }

        await tx.sale.create({
          data: {
            user_id: userId,
            customer_id: payload.customer_id,
            sale_date: payload.date ?? undefined,
            status: SALE_STATUS.COMPLETED,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            totalAmount: totals.total,
            paidAmount: paymentState.paidAmount,
            pendingAmount: paymentState.remainingAmount,
            paymentStatus: syncedSalePaymentStatus,
            paymentDate: paymentState.paymentDate ?? undefined,
            paymentMethod: paymentState.paymentMethod ?? undefined,
            notes: buildSyncedSaleNote(invoiceNumber, warehouse?.id, payload.notes),
            items: {
              create: saleItems.map((item) => {
                const { nonInventoryItem, ...rest } = item as typeof item & {
                  nonInventoryItem?: boolean;
                };
                return rest;
              }),
            },
          },
        });
      }

      negativeInventoryProducts = await applyBillingSaleInventoryAdjustments({
        tx,
        warehouseId: warehouse?.id as number,
        items: resolvedItems,
        allowNegativeStock: true,
        referenceId: invoice.id,
        referenceType: "invoice",
      });
    }

    return {
      invoice,
      negativeInventoryProducts,
    };
  });

  const uniqueNegativeProducts = Array.from(
    new Map(
      result.negativeInventoryProducts
        .filter((item) => item.issueDetected)
        .map((item) => [`${item.productId}:${item.warehouseId}`, item]),
    ).values(),
  );

  await Promise.all(
    uniqueNegativeProducts.map(async (item) => {
      const queueResult = await enqueueInventorySanitization({
        productId: item.productId,
        warehouseId: item.warehouseId,
        triggeredBy: "invoice",
        referenceId: result.invoice.id,
      });

      if (!queueResult.queued) {
        console.warn("[inventory] reconciliation queue unavailable after invoice", {
          invoiceId: result.invoice.id,
          productId: item.productId,
          warehouseId: item.warehouseId,
          reason: queueResult.reason,
        });
      }
    }),
  );

  return result.invoice;
};

export const getInvoice = async (userId: number, id: number) => {
  await syncOverdueInvoices(userId);

  const invoice = await prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: invoiceInclude,
  });

  return attachInvoiceGstMetadata(invoice);
};

export const getPublicInvoice = async (reference: string) => {
  const trimmedReference = reference.trim();
  if (!trimmedReference) {
    return null;
  }

  const idMatch = trimmedReference.match(/^(\d+)(?:[-_].+)?$/);

  let invoice: PublicInvoiceRecord | null = null;

  if (idMatch) {
    invoice = await prisma.invoice.findFirst({
      where: { id: Number(idMatch[1]) },
      include: publicInvoiceInclude,
    });
  } else {
    const matches = await prisma.invoice.findMany({
      where: { invoice_number: trimmedReference },
      include: publicInvoiceInclude,
      take: 2,
      orderBy: { createdAt: "desc" },
    });

    if (matches.length > 1) {
      const error = new Error(
        "Invoice reference is ambiguous. Use the full public invoice link.",
      ) as Error & { status?: number };
      error.status = 409;
      throw error;
    }

    invoice = matches[0] ?? null;
  }

  if (!invoice) {
    return null;
  }

  await markPublicInvoiceOverdueIfNeeded(invoice);

  const customerProfile = await fetchCustomerInvoiceProfile(
    invoice.user_id,
    invoice.customer_id,
  );

  return mapPublicInvoice(invoice, customerProfile);
};

export const getInvoiceForNotification = async (userId: number, id: number) => {
  await syncOverdueInvoices(userId);

  return prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: {
      customer: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          name: true,
          quantity: true,
          price: true,
          total: true,
        },
      },
      user: {
        select: {
          business_profile: {
            select: {
              business_name: true,
              email: true,
              phone: true,
            },
          },
        },
      },
    },
  });
};

export const markInvoiceAsSent = async (userId: number, id: number) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, user_id: userId },
    select: { id: true, status: true },
  });

  if (!invoice) {
    const error = new Error("Invoice not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  if (
    invoice.status === INVOICE_STATUS.PAID ||
    invoice.status === INVOICE_STATUS.PARTIALLY_PAID ||
    invoice.status === INVOICE_STATUS.OVERDUE ||
    invoice.status === INVOICE_STATUS.VOID ||
    invoice.status === INVOICE_STATUS.SENT
  ) {
    return invoice;
  }

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: INVOICE_STATUS.SENT },
    select: { id: true, status: true },
  });
};

export const updateInvoice = async (
  userId: number,
  id: number,
  payload: {
    status?: InvoiceStatus;
    due_date?: Date | string | null;
    notes?: string | null;
  },
) => {
  const currentInvoice = await prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: { items: true },
  });

  if (!currentInvoice) {
    return { count: 0 };
  }

  if (
    currentInvoice.status === INVOICE_STATUS.VOID &&
    payload.status &&
    payload.status !== INVOICE_STATUS.VOID
  ) {
    throw createInvoiceValidationError(
      "Cancelled invoices cannot be reopened from this workflow.",
      {
        status: ["Create a duplicate invoice instead of reopening a cancelled invoice."],
      },
    );
  }

  const shouldRestoreInventory =
    payload.status === INVOICE_STATUS.VOID &&
    currentInvoice.status !== INVOICE_STATUS.VOID &&
    currentInvoice.stock_applied &&
    Number.isInteger(currentInvoice.warehouse_id) &&
    (currentInvoice.warehouse_id ?? 0) > 0;

  if (!shouldRestoreInventory) {
    return prisma.invoice.updateMany({
      where: { id, user_id: userId },
      data: {
        status: payload.status,
        due_date: payload.due_date ?? undefined,
        notes: payload.notes,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    await restoreBillingSaleInventoryAdjustments({
      tx,
      warehouseId: currentInvoice.warehouse_id as number,
      items: currentInvoice.items.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price),
        nonInventoryItem: item.nonInventoryItem,
        tax_rate: item.tax_rate == null ? undefined : Number(item.tax_rate),
        gst_type:
          item.gst_type === "CGST_SGST" ||
          item.gst_type === "IGST" ||
          item.gst_type === "NONE"
            ? item.gst_type
            : undefined,
      })),
      referenceId: currentInvoice.id,
      referenceType: "invoice",
    });

    await tx.sale.deleteMany({
      where: findSyncedSalesWhereClause(userId, currentInvoice.invoice_number),
    });

    return tx.invoice.updateMany({
      where: { id, user_id: userId },
      data: {
        status: payload.status,
        due_date: payload.due_date ?? undefined,
        notes: payload.notes,
        stock_applied: false,
      },
    });
  });
};

export const duplicateInvoice = async (userId: number, id: number) => {
  return prisma.$transaction(async (tx) => {
    const source = await tx.invoice.findFirst({
      where: { id, user_id: userId },
      include: { items: true },
    });

    if (!source) {
      const error = new Error("Invoice not found") as Error & {
        status?: number;
      };
      error.status = 404;
      throw error;
    }

    const latest = await tx.invoice.findFirst({
      where: { user_id: userId },
      orderBy: { createdAt: "desc" },
      select: { invoice_number: true },
    });

    const invoiceNumber = generateInvoiceNumber(latest?.invoice_number);
    const sourceTemplateSnapshot = (
      source as typeof source & {
        template_snapshot?: Prisma.JsonValue | null;
      }
    ).template_snapshot;

    const duplicated = await tx.invoice.create({
      data: {
        user_id: userId,
        customer_id: source.customer_id,
        invoice_number: invoiceNumber,
        status: INVOICE_STATUS.DRAFT,
        date: source.date,
        due_date: source.due_date,
        subtotal: source.subtotal,
        tax: source.tax,
        tax_mode: source.tax_mode,
        discount: source.discount,
        discount_type: source.discount_type,
        discount_value: source.discount_value,
        discount_calculated: source.discount_calculated,
        total: source.total,
        notes: source.notes,
        ...(sourceTemplateSnapshot
          ? {
              template_snapshot:
                sourceTemplateSnapshot as Prisma.InputJsonValue,
            }
          : {}),
        items: {
          create: source.items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            tax_rate: item.tax_rate,
            total: item.total,
          })),
        },
      },
      include: invoiceInclude,
    });

    return duplicated;
  });
};

export const generateInvoicePdf = async (userId: number, id: number) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: {
      customer: true,
      items: true,
      payments: {
        select: invoicePaymentSelect,
      },
    },
  });

  if (!invoice) {
    const error = new Error("Invoice not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const company = await prisma.businessProfile.findUnique({
    where: { user_id: userId },
    select: {
      business_name: true,
      address: true,
      address_line1: true,
      city: true,
      state: true,
      pincode: true,
      phone: true,
      email: true,
      website: true,
      logo_url: true,
      tax_id: true,
      currency: true,
      show_logo_on_invoice: true,
      show_tax_number: true,
      show_payment_qr: true,
    },
  });

  const customerProfile = await fetchCustomerInvoiceProfile(
    userId,
    invoice.customer_id,
  );

  const previewPayload = buildInvoicePdfPreviewPayload({
    invoice,
    company,
    customerProfile,
  });

  if (previewPayload) {
    const buffer = await renderInvoicePreviewPdfBuffer(previewPayload);

    return {
      invoiceNumber: invoice.invoice_number,
      buffer,
    };
  }

  const html = buildInvoicePdfHtml(invoice, company, customerProfile);
  const buffer = await renderInvoicePdfBuffer(html);

  return {
    invoiceNumber: invoice.invoice_number,
    buffer,
  };
};

const renderInvoicePdfBuffer = async (html: string) => {
  const browser = await launchPuppeteerBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "16px",
        right: "16px",
        bottom: "16px",
        left: "16px",
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
};

export const generatePublicInvoicePdf = async (reference: string) => {
  const invoice = await getPublicInvoice(reference);

  if (!invoice) {
    const error = new Error("Invoice not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const html = renderPublicInvoiceHtml(invoice);
  const buffer = await renderInvoicePdfBuffer(html);

  return {
    invoiceNumber: invoice.invoice_id,
    buffer,
  };
};

export const deleteInvoice = async (userId: number, id: number) => {
  const existingInvoice = await prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: { items: true },
  });

  if (!existingInvoice) {
    return { count: 0 };
  }

  return prisma.$transaction(async (tx) => {
    if (
      existingInvoice.stock_applied &&
      Number.isInteger(existingInvoice.warehouse_id) &&
      (existingInvoice.warehouse_id ?? 0) > 0
    ) {
      await restoreBillingSaleInventoryAdjustments({
        tx,
        warehouseId: existingInvoice.warehouse_id as number,
        items: existingInvoice.items.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price),
          nonInventoryItem: item.nonInventoryItem,
          tax_rate: item.tax_rate == null ? undefined : Number(item.tax_rate),
          gst_type:
            item.gst_type === "CGST_SGST" ||
            item.gst_type === "IGST" ||
            item.gst_type === "NONE"
              ? item.gst_type
              : undefined,
        })),
        referenceId: existingInvoice.id,
        referenceType: "invoice",
      });

      await tx.sale.deleteMany({
        where: findSyncedSalesWhereClause(userId, existingInvoice.invoice_number),
      });
    }

    return tx.invoice.deleteMany({ where: { id, user_id: userId } });
  });
};
