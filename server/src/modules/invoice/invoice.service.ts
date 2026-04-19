import prisma from "../../config/db.config.js";
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleStatus,
  StockReason,
} from "@prisma/client";
import puppeteer from "puppeteer";
import {
  calculateTotals,
  getDiscountAmount,
} from "../../utils/calculateTotals.js";
import type { InvoiceCalcItem } from "../../utils/calculateTotals.js";
import { generateInvoiceNumber } from "../../utils/generateInvoiceNumber.js";
import {
  buildPublicInvoiceReference,
  buildPublicInvoiceUrl,
} from "../../lib/appUrls.js";
import {
  buildBusinessAddressLines,
  normalizeBusinessAddressDraft,
} from "../../lib/indianAddress.js";
import {
  applyBillingSaleInventoryAdjustments,
  resolveBillingProducts,
  resolveBillingWarehouse,
} from "../../services/billingInventorySync.service.js";

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
  discount: number;
  discount_type: "PERCENTAGE" | "FIXED";
  discount_value: number;
  discount_calculated: number;
  currency: string;
  status: InvoiceStatus;
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

const toNumber = (value: unknown) => Number(value ?? 0);

const roundCurrencyAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeDiscountType = (value: unknown): "PERCENTAGE" | "FIXED" =>
  value === "PERCENTAGE" ? "PERCENTAGE" : "FIXED";

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
      "Discount cannot exceed total amount.",
      {
        discount: ["Discount cannot exceed total amount."],
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

  if (status === InvoiceStatus.PAID) {
    return "PAID";
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
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
    if (params.status === InvoiceStatus.PAID) {
      throw createInvoiceValidationError(
        "Status conflicts with payment status.",
        {
          status: ["Status PAID requires a paid payment status."],
        },
      );
    }

    if (params.status === InvoiceStatus.PARTIALLY_PAID) {
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
      params.status === InvoiceStatus.DRAFT ||
      params.status === InvoiceStatus.VOID ||
      params.status === InvoiceStatus.SENT ||
      params.status === InvoiceStatus.OVERDUE
        ? params.status
        : InvoiceStatus.SENT;

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
      invoiceStatus: InvoiceStatus.PAID,
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
    invoiceStatus: InvoiceStatus.PARTIALLY_PAID,
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

const buildInvoicePdfHtml = (
  invoice: {
    invoice_number: string;
    date: Date;
    due_date: Date | null;
    status: InvoiceStatus;
    notes: string | null;
    subtotal: unknown;
    tax: unknown;
    discount: unknown;
    discount_type: unknown;
    discount_value: unknown;
    total: unknown;
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
    payments: Array<{
      amount: unknown;
      method: PaymentMethod;
      paid_at: Date;
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
    tax_id: string | null;
    currency: string;
  } | null,
  customerProfile?: CustomerInvoiceProfile | null,
) => {
  const currency = company?.currency ?? "INR";
  const totalAmount = toNumber(invoice.total);
  const discountType = normalizeDiscountType(invoice.discount_type);
  const discountValue = toNumber(invoice.discount_value);
  const discountLabel = buildDiscountLabel({
    discountType,
    discountValue,
    currency,
  });
  const paidFromPayments = invoice.payments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const paidAmount =
    paidFromPayments > 0
      ? Math.max(0, Math.min(paidFromPayments, totalAmount))
      : invoice.status === InvoiceStatus.PAID
        ? totalAmount
        : 0;
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
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
        </style>
      </head>
      <body>
        <div class="row">
          <div>
            <h1>Invoice</h1>
            <div class="muted">#${escapeHtml(invoice.invoice_number)}</div>
            <div class="muted">Issue Date: ${formatDate(invoice.date)}</div>
            <div class="muted">Due Date: ${formatDate(invoice.due_date)}</div>
            <div class="muted">Status: ${escapeHtml(normalizeStatusLabel(invoice.status))}</div>
            <div class="muted">Paid: ${formatCurrency(paidAmount, currency)} | Balance: ${formatCurrency(remainingAmount, currency)}</div>
            ${latestPayment ? `<div class="muted">Last payment: ${formatDate(latestPayment.paid_at)} (${escapeHtml(normalizeStatusLabel(latestPayment.method))})</div>` : ""}
          </div>
          <div>
            <h2>Company Details</h2>
            <div>${escapeHtml(company?.business_name ?? "Your Business")}</div>
            ${companyAddressLines
              .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
              .join("")}
            <div class="muted">${escapeHtml(company?.phone ?? "")}</div>
            <div class="muted">${escapeHtml(company?.email ?? "")}</div>
            <div class="muted">Tax ID: ${escapeHtml(company?.tax_id ?? "-")}</div>
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
      status: { not: InvoiceStatus.PAID },
    },
    data: {
      status: InvoiceStatus.OVERDUE,
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
    invoice.status !== InvoiceStatus.PAID &&
    invoice.status !== InvoiceStatus.OVERDUE
  ) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.OVERDUE },
    });

    invoice.status = InvoiceStatus.OVERDUE;
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
    discount: unknown;
    discount_type: unknown;
    discount_value: unknown;
    discount_calculated: unknown;
    total: unknown;
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
    amount: toNumber(invoice.total),
    subtotal: toNumber(invoice.subtotal),
    tax: toNumber(invoice.tax),
    discount: toNumber(invoice.discount),
    discount_type: normalizeDiscountType(invoice.discount_type),
    discount_value: toNumber(invoice.discount_value),
    discount_calculated: toNumber(invoice.discount_calculated),
    currency,
    status: invoice.status,
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

  return prisma.invoice.findMany({
    where,
    include: { customer: true, items: true, payments: true },
    orderBy: { createdAt: "desc" },
  });
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
    status?: InvoiceStatus;
    payment_status?: InvoicePaymentStatusInput;
    amount_paid?: number | null;
    payment_date?: Date | string | null;
    payment_method?: PaymentMethod | null;
    notes?: string | null;
    sync_sales?: boolean;
    warehouse_id?: number | null;
    items: InvoiceCalcItem[];
  },
) => {
  const discountType = normalizeDiscountType(payload.discount_type);
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
  );

  const syncSales =
    payload.status !== InvoiceStatus.DRAFT && payload.status !== InvoiceStatus.VOID;
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
      ? PaymentStatus.PAID
      : paymentState.paymentStatus === "PARTIALLY_PAID"
        ? PaymentStatus.PARTIALLY_PAID
        : PaymentStatus.UNPAID;

  return prisma.$transaction(async (tx) => {
    const warehouse = syncSales
      ? await resolveBillingWarehouse(tx, userId, payload.warehouse_id)
      : null;
    const resolvedItems = syncSales
      ? await resolveBillingProducts(tx, userId, totals.items, {
          autoCreateProducts: true,
        })
      : totals.items.map((item) => ({
          product_id: item.product_id as number,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          tax_rate: item.tax_rate ?? undefined,
        }));

    const itemPayload = resolvedItems.map((item, index) => ({
      product_id: syncSales ? item.product_id : totals.items[index]?.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      total: totals.items[index]?.total ?? item.quantity * item.price,
    }));

    if (syncSales) {
      if (!warehouse) {
        throw createInvoiceValidationError("Warehouse resolution failed.", {
          warehouse_id: ["Unable to determine a warehouse for this invoice."],
        });
      }
    }

    const invoice = await tx.invoice.create({
      data: {
        user_id: userId,
        customer_id: payload.customer_id,
        invoice_number: invoiceNumber,
        date: payload.date ?? undefined,
        due_date: payload.due_date ?? undefined,
        status: paymentState.invoiceStatus,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        discount_type: discountType,
        discount_value: discountValue,
        discount_calculated: totals.discount,
        total: totals.total,
        notes: payload.notes ?? undefined,
        items: { create: itemPayload },
      },
      include: { items: true, payments: true },
    });

    if (paymentState.paidAmount > 0 && paymentState.paymentMethod) {
      await tx.payment.create({
        data: {
          user_id: userId,
          invoice_id: invoice.id,
          amount: paymentState.paidAmount,
          method: paymentState.paymentMethod,
          paid_at: paymentState.paymentDate ?? new Date(),
        },
      });
    }

    if (syncSales) {
      const saleItems = resolvedItems.map((item, index) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        tax_rate: item.tax_rate ?? undefined,
        line_total: totals.items[index]?.total ?? item.quantity * item.price,
      }));

      await tx.sale.create({
        data: {
          user_id: userId,
          customer_id: payload.customer_id,
          sale_date: payload.date ?? undefined,
          status: SaleStatus.COMPLETED,
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          totalAmount: totals.total,
          paidAmount: paymentState.paidAmount,
          pendingAmount: paymentState.remainingAmount,
          paymentStatus: syncedSalePaymentStatus,
          paymentDate: paymentState.paymentDate ?? undefined,
          paymentMethod: paymentState.paymentMethod ?? undefined,
          notes: payload.notes
            ? `${payload.notes} (Synced from invoice ${invoiceNumber}, Warehouse ${warehouse?.id})`
            : `Synced from invoice ${invoiceNumber} (Warehouse ${warehouse?.id})`,
          items: { create: saleItems },
        },
      });

      await applyBillingSaleInventoryAdjustments({
        tx,
        warehouseId: warehouse?.id as number,
        items: resolvedItems,
        referenceId: invoice.id,
        referenceType: "invoice",
      });
    }

    return invoice;
  });
};

export const getInvoice = async (userId: number, id: number) => {
  await syncOverdueInvoices(userId);

  return prisma.invoice.findFirst({
    where: { id, user_id: userId },
    include: { customer: true, items: true, payments: true },
  });
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
    invoice.status === InvoiceStatus.PAID ||
    invoice.status === InvoiceStatus.PARTIALLY_PAID ||
    invoice.status === InvoiceStatus.OVERDUE ||
    invoice.status === InvoiceStatus.VOID ||
    invoice.status === InvoiceStatus.SENT
  ) {
    return invoice;
  }

  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: InvoiceStatus.SENT },
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
  return prisma.invoice.updateMany({
    where: { id, user_id: userId },
    data: {
      status: payload.status,
      due_date: payload.due_date ?? undefined,
      notes: payload.notes,
    },
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

    const duplicated = await tx.invoice.create({
      data: {
        user_id: userId,
        customer_id: source.customer_id,
        invoice_number: invoiceNumber,
        status: InvoiceStatus.DRAFT,
        date: source.date,
        due_date: source.due_date,
        subtotal: source.subtotal,
        tax: source.tax,
        discount: source.discount,
        discount_type: source.discount_type,
        discount_value: source.discount_value,
        discount_calculated: source.discount_calculated,
        total: source.total,
        notes: source.notes,
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
      include: { customer: true, items: true, payments: true },
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
      payments: true,
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
      tax_id: true,
      currency: true,
    },
  });

  const customerProfile = await fetchCustomerInvoiceProfile(
    userId,
    invoice.customer_id,
  );

  const html = buildInvoicePdfHtml(invoice, company, customerProfile);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

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

    return {
      invoiceNumber: invoice.invoice_number,
      buffer: Buffer.from(pdfBuffer),
    };
  } finally {
    await browser.close();
  }
};

export const deleteInvoice = async (userId: number, id: number) => {
  return prisma.invoice.deleteMany({ where: { id, user_id: userId } });
};
