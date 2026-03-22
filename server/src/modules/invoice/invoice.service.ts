import prisma from "../../config/db.config.js";
import { InvoiceStatus, SaleStatus, StockReason } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import puppeteer from "puppeteer";
import { calculateTotals } from "../../utils/calculateTotals.js";
import type { InvoiceCalcItem } from "../../utils/calculateTotals.js";
import { generateInvoiceNumber } from "../../utils/generateInvoiceNumber.js";
import {
  buildPublicInvoiceReference,
  buildPublicInvoiceUrl,
} from "../../lib/appUrls.js";

type ListInvoiceFilters = {
  status?: InvoiceStatus;
  clientId?: number;
  from?: Date;
  to?: Date;
};

export type PublicInvoiceViewData = {
  id: number;
  public_id: string;
  invoice_id: string;
  amount: number;
  subtotal: number;
  tax: number;
  discount: number;
  currency: string;
  status: InvoiceStatus;
  date: string;
  due_date: string | null;
  notes: string | null;
  customer_name: string;
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

const toNumber = (value: unknown) => Number(value ?? 0);

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
  },
  company: {
    business_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_id: string | null;
    currency: string;
  } | null,
) => {
  const currency = company?.currency ?? "INR";

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
            <div class="muted">Status: ${escapeHtml(invoice.status)}</div>
          </div>
          <div>
            <h2>Company Details</h2>
            <div>${escapeHtml(company?.business_name ?? "Your Business")}</div>
            <div class="muted">${escapeHtml(company?.address ?? "")}</div>
            <div class="muted">${escapeHtml(company?.phone ?? "")}</div>
            <div class="muted">${escapeHtml(company?.email ?? "")}</div>
            <div class="muted">Tax ID: ${escapeHtml(company?.tax_id ?? "-")}</div>
          </div>
        </div>

        <div class="row" style="margin-top: 24px;">
          <div>
            <h2>Bill To</h2>
            <div>${escapeHtml(invoice.customer.name)}</div>
            <div class="muted">${escapeHtml(invoice.customer.email ?? "")}</div>
            <div class="muted">${escapeHtml(invoice.customer.phone ?? "")}</div>
            <div class="muted">${escapeHtml(invoice.customer.address ?? "")}</div>
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
              <td>Discount</td>
              <td>${formatCurrency(invoice.discount, currency)}</td>
            </tr>
            <tr class="final">
              <td>Grand Total</td>
              <td>${formatCurrency(invoice.total, currency)}</td>
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

const mapPublicInvoice = (invoice: {
  id: number;
  invoice_number: string;
  status: InvoiceStatus;
  date: Date;
  due_date: Date | null;
  notes: string | null;
  subtotal: unknown;
  tax: unknown;
  discount: unknown;
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
      phone: string | null;
      email: string | null;
      currency: string;
    } | null;
  };
}): PublicInvoiceViewData => {
  const currency = invoice.user.business_profile?.currency ?? "INR";

  return {
    id: invoice.id,
    public_id: buildPublicInvoiceReference(invoice.id, invoice.invoice_number),
    invoice_id: invoice.invoice_number,
    amount: toNumber(invoice.total),
    subtotal: toNumber(invoice.subtotal),
    tax: toNumber(invoice.tax),
    discount: toNumber(invoice.discount),
    currency,
    status: invoice.status,
    date: invoice.date.toISOString(),
    due_date: invoice.due_date?.toISOString() ?? null,
    notes: invoice.notes,
    customer_name: invoice.customer.name,
    email: invoice.customer.email,
    customer_phone: invoice.customer.phone,
    customer_address: invoice.customer.address,
    business_name: invoice.user.business_profile?.business_name ?? "BillSutra",
    business_email: invoice.user.business_profile?.email ?? null,
    business_phone: invoice.user.business_profile?.phone ?? null,
    business_address: invoice.user.business_profile?.address ?? null,
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

export const createInvoice = async (
  userId: number,
  payload: {
    customer_id: number;
    date?: Date | string | null;
    due_date?: Date | string | null;
    discount?: number | null;
    discount_type?: "PERCENTAGE" | "FIXED" | null;
    status?: InvoiceStatus;
    notes?: string | null;
    sync_sales?: boolean;
    warehouse_id?: number | null;
    items: InvoiceCalcItem[];
  },
) => {
  const latest = await prisma.invoice.findFirst({
    where: { user_id: userId },
    orderBy: { createdAt: "desc" },
    select: { invoice_number: true },
  });

  const invoiceNumber = generateInvoiceNumber(latest?.invoice_number);
  const totals = calculateTotals(
    payload.items,
    payload.discount ?? 0,
    payload.discount_type ?? "FIXED",
  );

  const itemPayload = totals.items.map((item) => ({
    product_id: item.product_id ?? undefined,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    tax_rate: item.tax_rate ?? undefined,
    total: item.total,
  }));

  const syncSales = payload.sync_sales !== false;

  return prisma.$transaction(async (tx) => {
    if (syncSales) {
      const missingProduct = totals.items.some((item) => !item.product_id);
      if (missingProduct) {
        const error = new Error(
          "All items must have products to sync sales and inventory.",
        ) as Error & { status?: number };
        error.status = 400;
        throw error;
      }

      if (!payload.warehouse_id) {
        const error = new Error(
          "Select a warehouse to sync inventory.",
        ) as Error & { status?: number };
        error.status = 400;
        throw error;
      }

      const productIds = totals.items.map((item) => item.product_id as number);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, user_id: userId },
      });

      if (products.length !== productIds.length) {
        const error = new Error("Product not found.") as Error & {
          status?: number;
        };
        error.status = 404;
        throw error;
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const warehouse = await tx.warehouse.findFirst({
        where: { id: payload.warehouse_id, user_id: userId },
      });

      if (!warehouse) {
        const error = new Error("Warehouse not found.") as Error & {
          status?: number;
        };
        error.status = 404;
        throw error;
      }

      const inventories = await tx.inventory.findMany({
        where: {
          warehouse_id: payload.warehouse_id,
          product_id: { in: productIds },
        },
      });

      const inventoryMap = new Map(
        inventories.map((inventory) => [inventory.product_id, inventory]),
      );

      for (const item of totals.items) {
        const product = productMap.get(item.product_id as number);
        if (!product || product.stock_on_hand < item.quantity) {
          const error = new Error("Insufficient stock.") as Error & {
            status?: number;
            errors?: Record<string, unknown>;
          };
          error.status = 409;
          error.errors = { product_id: item.product_id };
          throw error;
        }

        const inventory = inventoryMap.get(item.product_id as number);
        if (!inventory || inventory.quantity < item.quantity) {
          const error = new Error("Insufficient warehouse stock.") as Error & {
            status?: number;
            errors?: Record<string, unknown>;
          };
          error.status = 409;
          error.errors = { product_id: item.product_id };
          throw error;
        }
      }
    }

    const invoice = await tx.invoice.create({
      data: {
        user_id: userId,
        customer_id: payload.customer_id,
        invoice_number: invoiceNumber,
        date: payload.date ?? undefined,
        due_date: payload.due_date ?? undefined,
        status: payload.status ?? InvoiceStatus.SENT,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        notes: payload.notes ?? undefined,
        items: { create: itemPayload },
      },
      include: { items: true },
    });

    if (syncSales) {
      const saleItems = totals.items.map((item) => ({
        product_id: item.product_id ?? undefined,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        tax_rate: item.tax_rate ?? undefined,
        line_total: item.total,
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
          notes: payload.notes
            ? `${payload.notes} (Synced from invoice ${invoiceNumber})`
            : `Synced from invoice ${invoiceNumber}`,
          items: { create: saleItems },
        },
      });

      for (const item of totals.items) {
        await tx.product.update({
          where: { id: item.product_id as number },
          data: { stock_on_hand: { decrement: item.quantity } },
        });

        await tx.inventory.update({
          where: {
            warehouse_id_product_id: {
              warehouse_id: payload.warehouse_id as number,
              product_id: item.product_id as number,
            },
          },
          data: { quantity: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id as number,
            change: -item.quantity,
            reason: StockReason.SALE,
            note: `Invoice ${invoiceNumber} (Warehouse ${payload.warehouse_id})`,
          },
        });
      }
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

  return mapPublicInvoice(invoice);
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

  if (invoice.status === InvoiceStatus.PAID) {
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
      phone: true,
      email: true,
      tax_id: true,
      currency: true,
    },
  });

  const html = buildInvoicePdfHtml(invoice, company);

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
