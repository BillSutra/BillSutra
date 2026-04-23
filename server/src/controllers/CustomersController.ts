import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { getTotalPages, parsePagination } from "../utils/pagination.js";
import type { z } from "zod";
import {
  customerCreateSchema,
  customerUpdateSchema,
} from "../validations/apiValidations.js";
import {
  formatBusinessAddress,
  normalizeBusinessAddressDraft,
  parseLegacyBusinessAddress,
} from "../lib/indianAddress.js";
import { normalizeGstin } from "../lib/gstin.js";
import { launchPuppeteerBrowser } from "../lib/launchPuppeteerBrowser.js";
import { createNotification } from "../services/notification.service.js";

type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

type CustomerType = "individual" | "business";

type CustomerPaymentTerms = "DUE_ON_RECEIPT" | "NET_7" | "NET_15" | "NET_30";

type CustomerExtendedFields = {
  id: number;
  customer_type: string | null;
  business_name: string | null;
  gstin: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  credit_limit: unknown;
  payment_terms: string | null;
  opening_balance: unknown;
};

type CustomerBaseRecord = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
};

type CustomerInvoiceRecord = {
  id: number;
  invoice_number: string;
  date: Date;
  due_date: Date | null;
  status: string;
  total: unknown;
  payments: Array<{
    id: number;
    amount: unknown;
    method?: string;
    reference?: string | null;
    paid_at: Date;
  }>;
};

const customerBaseSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.CustomerSelect;

const toNumber = (value: unknown) => Number(value ?? 0);

const roundAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeCustomerType = (value: unknown): CustomerType =>
  value === "business" ? "business" : "individual";

const normalizePaymentTerms = (value: unknown): CustomerPaymentTerms | null => {
  if (
    value === "DUE_ON_RECEIPT" ||
    value === "NET_7" ||
    value === "NET_15" ||
    value === "NET_30"
  ) {
    return value;
  }

  return null;
};

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const toNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const relevantInvoiceStatuses = new Set([
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
]);

const isCustomerSchemaMismatchError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const errorCode = (error.meta as { code?: string } | undefined)?.code;
      return errorCode === "42703" || errorCode === "42P01";
    }
  }

  if (error instanceof Error) {
    return (
      /address_line1/i.test(error.message) ||
      /customer_type/i.test(error.message) ||
      /opening_balance/i.test(error.message)
    );
  }

  return false;
};

const loadExtendedCustomerFields = async (
  userId: number,
  customerIds: number[],
) => {
  if (!customerIds.length) {
    return new Map<number, CustomerExtendedFields>();
  }

  try {
    const rows = await prisma.$queryRaw<CustomerExtendedFields[]>(Prisma.sql`
      SELECT
        id,
        customer_type,
        business_name,
        gstin,
        address_line1,
        city,
        state,
        pincode,
        notes,
        credit_limit,
        payment_terms,
        opening_balance
      FROM "customers"
      WHERE "user_id" = ${userId}
        AND "id" IN (${Prisma.join(customerIds)})
    `);

    return new Map(rows.map((row) => [row.id, row]));
  } catch (error) {
    if (isCustomerSchemaMismatchError(error)) {
      return new Map<number, CustomerExtendedFields>();
    }

    throw error;
  }
};

const persistExtendedCustomerFields = async (
  userId: number,
  customerId: number,
  payload: {
    customer_type: CustomerType;
    business_name: string | null;
    gstin: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    notes: string | null;
    credit_limit: number | null;
    payment_terms: CustomerPaymentTerms | null;
    opening_balance: number;
  },
) => {
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "customers"
      SET
        customer_type = ${payload.customer_type},
        business_name = ${payload.business_name},
        gstin = ${payload.gstin},
        address_line1 = ${payload.address_line1},
        city = ${payload.city},
        state = ${payload.state},
        pincode = ${payload.pincode},
        notes = ${payload.notes},
        credit_limit = ${payload.credit_limit},
        payment_terms = ${payload.payment_terms},
        opening_balance = ${payload.opening_balance}
      WHERE id = ${customerId}
        AND user_id = ${userId}
    `);
  } catch (error) {
    if (isCustomerSchemaMismatchError(error)) {
      return;
    }

    throw error;
  }
};

const resolveCustomerAddress = (
  input: Partial<CustomerCreateInput & CustomerUpdateInput>,
  fallback?: {
    address?: string | null;
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  },
) => {
  const nestedAddress = normalizeBusinessAddressDraft(input.customerAddress);
  const topLevelAddress = normalizeBusinessAddressDraft({
    addressLine1: input.address_line1,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  });
  const legacyInputAddress = parseLegacyBusinessAddress(input.address);
  const fallbackStructuredAddress = normalizeBusinessAddressDraft({
    addressLine1: fallback?.address_line1 ?? undefined,
    city: fallback?.city ?? undefined,
    state: fallback?.state ?? undefined,
    pincode: fallback?.pincode ?? undefined,
  });
  const fallbackLegacyAddress = parseLegacyBusinessAddress(fallback?.address);

  return normalizeBusinessAddressDraft({
    addressLine1:
      nestedAddress.addressLine1 ??
      topLevelAddress.addressLine1 ??
      legacyInputAddress.addressLine1 ??
      fallbackStructuredAddress.addressLine1 ??
      fallbackLegacyAddress.addressLine1,
    city:
      nestedAddress.city ??
      topLevelAddress.city ??
      legacyInputAddress.city ??
      fallbackStructuredAddress.city ??
      fallbackLegacyAddress.city,
    state:
      nestedAddress.state ??
      topLevelAddress.state ??
      legacyInputAddress.state ??
      fallbackStructuredAddress.state ??
      fallbackLegacyAddress.state,
    pincode:
      nestedAddress.pincode ??
      topLevelAddress.pincode ??
      legacyInputAddress.pincode ??
      fallbackStructuredAddress.pincode ??
      fallbackLegacyAddress.pincode,
  });
};

const serializeCustomer = (
  customer: CustomerBaseRecord,
  extended?: CustomerExtendedFields,
) => {
  const legacyAddress = parseLegacyBusinessAddress(customer.address);
  const normalizedAddress = normalizeBusinessAddressDraft({
    addressLine1: extended?.address_line1 ?? legacyAddress.addressLine1,
    city: extended?.city ?? legacyAddress.city,
    state: extended?.state ?? legacyAddress.state,
    pincode: extended?.pincode ?? legacyAddress.pincode,
  });

  const customerType = normalizeCustomerType(extended?.customer_type);
  const businessName = toNullableString(extended?.business_name);
  const gstin = toNullableString(extended?.gstin);
  const openingBalance = roundAmount(
    Math.max(toNumber(extended?.opening_balance ?? 0), 0),
  );

  return {
    id: customer.id,
    name: customer.name,
    display_name:
      customerType === "business"
        ? (businessName ?? customer.name)
        : customer.name,
    email: customer.email,
    phone: customer.phone,
    type: customerType,
    customer_type: customerType,
    businessName,
    business_name: businessName,
    gstin,
    address: formatBusinessAddress(normalizedAddress, customer.address),
    address_line1: normalizedAddress.addressLine1 ?? null,
    city: normalizedAddress.city ?? null,
    state: normalizedAddress.state ?? null,
    pincode: normalizedAddress.pincode ?? null,
    customerAddress: {
      addressLine1: normalizedAddress.addressLine1 ?? "",
      city: normalizedAddress.city ?? "",
      state: normalizedAddress.state ?? "",
      pincode: normalizedAddress.pincode ?? "",
    },
    notes: toNullableString(extended?.notes),
    creditLimit: toNullableNumber(extended?.credit_limit),
    credit_limit: toNullableNumber(extended?.credit_limit),
    paymentTerms: normalizePaymentTerms(extended?.payment_terms),
    payment_terms: normalizePaymentTerms(extended?.payment_terms),
    openingBalance,
    opening_balance: openingBalance,
    created_at: customer.created_at,
    updated_at: customer.updated_at,
  };
};

const buildCustomerSummary = (
  customer: {
    created_at: Date;
    invoices: CustomerInvoiceRecord[];
  },
  extended?: CustomerExtendedFields,
) => {
  const invoices = customer.invoices.filter((invoice) =>
    relevantInvoiceStatuses.has(invoice.status),
  );
  const openingBalance = roundAmount(
    Math.max(toNumber(extended?.opening_balance ?? 0), 0),
  );

  const invoicedTotal = roundAmount(
    invoices.reduce((sum, invoice) => sum + toNumber(invoice.total), 0),
  );
  const totalBilled = roundAmount(openingBalance + invoicedTotal);
  const totalPaid = roundAmount(
    invoices.reduce(
      (sum, invoice) =>
        sum +
        invoice.payments.reduce(
          (paymentSum, payment) => paymentSum + toNumber(payment.amount),
          0,
        ),
      0,
    ),
  );
  const outstandingBalance = roundAmount(Math.max(totalBilled - totalPaid, 0));

  const openInvoices = invoices
    .map((invoice) => {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum + toNumber(payment.amount),
        0,
      );
      const remaining = roundAmount(
        Math.max(toNumber(invoice.total) - paid, 0),
      );

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        issueDate: invoice.date,
        dueDate: invoice.due_date,
        status: invoice.status,
        total: roundAmount(toNumber(invoice.total)),
        paid: roundAmount(paid),
        remaining,
      };
    })
    .filter((invoice) => invoice.remaining > 0)
    .sort(
      (left, right) => left.issueDate.getTime() - right.issueDate.getTime(),
    );

  const paymentDates = invoices.flatMap((invoice) =>
    invoice.payments.map((payment) => payment.paid_at),
  );
  const activityDates = [
    customer.created_at,
    ...invoices.map((invoice) => invoice.date),
    ...paymentDates,
  ];
  const lastPaymentDate =
    paymentDates.length > 0
      ? new Date(Math.max(...paymentDates.map((value) => value.getTime())))
      : null;
  const lastActivityDate = new Date(
    Math.max(...activityDates.map((value) => value.getTime())),
  );

  return {
    openingBalance,
    totalBilled,
    totalPaid,
    outstandingBalance,
    openInvoiceCount: openInvoices.length,
    settled: outstandingBalance <= 0,
    lastPaymentDate,
    lastActivityDate,
    openInvoices,
  };
};

const buildCustomerLedger = (
  customer: CustomerBaseRecord & { invoices: CustomerInvoiceRecord[] },
  extended?: CustomerExtendedFields,
) => {
  const summary = buildCustomerSummary(customer, extended);
  const rows = customer.invoices
    .filter((invoice) => relevantInvoiceStatuses.has(invoice.status))
    .flatMap((invoice) => {
      const invoiceEntry = {
        id: `invoice-${invoice.id}`,
        sortDate: invoice.date,
        sortWeight: 0,
        type: "invoice" as const,
        invoiceId: invoice.id,
        paymentId: null,
        date: invoice.date,
        description: `Invoice ${invoice.invoice_number}`,
        note:
          invoice.status === "OVERDUE"
            ? "Overdue invoice"
            : invoice.due_date
              ? `Due ${invoice.due_date.toISOString().slice(0, 10)}`
              : "Invoice issued",
        debit: roundAmount(toNumber(invoice.total)),
        credit: 0,
      };

      const paymentEntries = invoice.payments.map((payment) => ({
        id: `payment-${payment.id}`,
        sortDate: payment.paid_at,
        sortWeight: 1,
        type: "payment" as const,
        invoiceId: invoice.id,
        paymentId: payment.id,
        date: payment.paid_at,
        description: `Payment received for ${invoice.invoice_number}`,
        note: payment.reference || payment.method || "Payment recorded",
        debit: 0,
        credit: roundAmount(toNumber(payment.amount)),
      }));

      return [invoiceEntry, ...paymentEntries];
    });

  if (summary.openingBalance > 0) {
    rows.unshift({
      id: `opening-balance-${customer.id}`,
      sortDate: customer.created_at,
      sortWeight: -1,
      type: "invoice" as const,
      invoiceId: 0,
      paymentId: null,
      date: customer.created_at,
      description: "Opening balance",
      note: "Brought forward when customer was added",
      debit: summary.openingBalance,
      credit: 0,
    });
  }

  rows.sort((left, right) => {
    const dateDiff = left.sortDate.getTime() - right.sortDate.getTime();
    if (dateDiff !== 0) return dateDiff;
    if (left.sortWeight !== right.sortWeight) {
      return left.sortWeight - right.sortWeight;
    }
    return left.id.localeCompare(right.id);
  });

  let runningBalance = 0;
  const entries = rows.map((entry) => {
    runningBalance = roundAmount(runningBalance + entry.debit - entry.credit);

    return {
      id: entry.id,
      type: entry.type,
      invoiceId: entry.invoiceId,
      paymentId: entry.paymentId,
      date: entry.date,
      description: entry.description,
      note: entry.note,
      debit: entry.debit,
      credit: entry.credit,
      balance: runningBalance,
    };
  });

  return {
    customer: serializeCustomer(customer, extended),
    summary,
    entries,
  };
};

const formatLedgerDate = (value: Date | string | null | undefined) => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return typeof value === "string" ? value : "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const formatLedgerCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

const escapeLedgerHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const buildLedgerPdfHtml = (
  ledger: ReturnType<typeof buildCustomerLedger>,
  businessName: string | null,
) => {
  const customerName =
    ledger.customer.display_name ||
    ledger.customer.businessName ||
    ledger.customer.business_name ||
    ledger.customer.name;
  const customerAddress =
    formatBusinessAddress(
      normalizeBusinessAddressDraft({
        addressLine1: ledger.customer.address_line1 ?? undefined,
        city: ledger.customer.city ?? undefined,
        state: ledger.customer.state ?? undefined,
        pincode: ledger.customer.pincode ?? undefined,
      }),
      ledger.customer.address,
    ) || "No address";

  const generatedOn = formatLedgerDate(new Date());
  const rows =
    ledger.entries.length > 0
      ? ledger.entries
          .map(
            (entry) => `
              <tr>
                <td>${escapeLedgerHtml(formatLedgerDate(entry.date))}</td>
                <td>${escapeLedgerHtml(entry.description)}</td>
                <td>${escapeLedgerHtml(entry.note ?? "-")}</td>
                <td class="amount">${escapeLedgerHtml(formatLedgerCurrency(entry.debit))}</td>
                <td class="amount">${escapeLedgerHtml(formatLedgerCurrency(entry.credit))}</td>
                <td class="amount">${escapeLedgerHtml(formatLedgerCurrency(entry.balance))}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="6" class="empty-state">No transactions found</td>
          </tr>
        `;

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeLedgerHtml(customerName)} ledger statement</title>
        <style>
          @import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");

          @page {
            size: A4;
            margin: 20mm 15mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #111827;
            font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.5;
          }

          .page {
            width: 100%;
          }

          .header {
            margin-bottom: 20px;
          }

          .eyebrow {
            margin: 0 0 6px;
            color: #8a6d56;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .title {
            margin: 0;
            font-size: 24px;
            line-height: 1.2;
            font-weight: 700;
            color: #111827;
          }

          .subtitle {
            margin: 8px 0 0;
            color: #4b5563;
            font-size: 12px;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .meta-card {
            border: 1px solid #e5ded3;
            border-radius: 12px;
            padding: 14px 16px;
            background: #fffdfa;
          }

          .meta-label {
            margin: 0 0 6px;
            color: #8a6d56;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .meta-value {
            margin: 0;
            color: #111827;
            font-size: 13px;
            font-weight: 500;
            word-break: break-word;
          }

          .summary {
            display: table;
            width: 100%;
            table-layout: fixed;
            border-spacing: 10px 0;
            margin: 0 -10px 20px;
          }

          .summary-card {
            display: table-cell;
            width: 33.333%;
            border: 1px solid #e7ded1;
            border-radius: 14px;
            background: #fcfaf6;
            padding: 14px 16px;
            vertical-align: top;
          }

          .summary-label {
            margin: 0;
            color: #8a6d56;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .summary-value {
            margin: 10px 0 0;
            font-size: 24px;
            line-height: 1.2;
            font-weight: 700;
            color: #172033;
          }

          .table-wrap {
            border: 1px solid #eadfce;
            border-radius: 14px;
            overflow: hidden;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 12px;
          }

          thead {
            display: table-header-group;
          }

          tr {
            page-break-inside: avoid;
          }

          th, td {
            border-bottom: 1px solid #ece4d8;
            padding: 10px 12px;
            vertical-align: top;
            word-break: break-word;
          }

          th {
            background: #f8f2e8;
            color: #6b5442;
            font-size: 11px;
            font-weight: 700;
            text-align: left;
          }

          tbody tr:nth-child(even) {
            background: #fffdfa;
          }

          tbody tr:last-child td {
            border-bottom: none;
          }

          .amount {
            text-align: right;
            white-space: nowrap;
            font-variant-numeric: tabular-nums;
          }

          .empty-state {
            padding: 20px 12px;
            text-align: center;
            color: #6b7280;
          }

          .footer {
            margin-top: 18px;
            text-align: center;
            color: #9ca3af;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="header">
            <p class="eyebrow">Customer Ledger Statement</p>
            <h1 class="title">${escapeLedgerHtml(customerName)}</h1>
            <p class="subtitle">${escapeLedgerHtml(
              businessName
                ? `Prepared by ${businessName}`
                : "Prepared for account review",
            )}</p>
          </section>

          <section class="meta-grid">
            <div class="meta-card">
              <p class="meta-label">Customer Contact</p>
              <p class="meta-value">${escapeLedgerHtml(
                ledger.customer.phone || "No phone",
              )}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Generated On</p>
              <p class="meta-value">${escapeLedgerHtml(generatedOn)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Address</p>
              <p class="meta-value">${escapeLedgerHtml(customerAddress)}</p>
            </div>
            <div class="meta-card">
              <p class="meta-label">Status</p>
              <p class="meta-value">${escapeLedgerHtml(
                ledger.summary.settled
                  ? "Settled"
                  : `${ledger.summary.openInvoiceCount} open invoice(s)`,
              )}</p>
            </div>
          </section>

          <section class="summary" aria-label="Ledger summary">
            <div class="summary-card">
              <p class="summary-label">Total Due</p>
              <p class="summary-value">${escapeLedgerHtml(
                formatLedgerCurrency(ledger.summary.outstandingBalance),
              )}</p>
            </div>
            <div class="summary-card">
              <p class="summary-label">Total Billed</p>
              <p class="summary-value">${escapeLedgerHtml(
                formatLedgerCurrency(ledger.summary.totalBilled),
              )}</p>
            </div>
            <div class="summary-card">
              <p class="summary-label">Total Paid</p>
              <p class="summary-value">${escapeLedgerHtml(
                formatLedgerCurrency(ledger.summary.totalPaid),
              )}</p>
            </div>
          </section>

          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 16%;">Date</th>
                  <th style="width: 28%;">Description</th>
                  <th style="width: 22%;">Note</th>
                  <th style="width: 11%;">Debit</th>
                  <th style="width: 11%;">Credit</th>
                  <th style="width: 12%;">Balance</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>

          <p class="footer">Customer ledger statement</p>
        </main>
      </body>
    </html>
  `;
};

class CustomersController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const { page, limit, skip } = parsePagination({
      page: req.query.page,
      limit: req.query.limit,
    });

    const where: Prisma.CustomerWhereInput = {
      user_id: userId,
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                phone: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                business_name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
        select: {
          ...customerBaseSelect,
          invoices: {
            select: {
              id: true,
              invoice_number: true,
              date: true,
              due_date: true,
              status: true,
              total: true,
              payments: {
                select: {
                  id: true,
                  amount: true,
                  paid_at: true,
                },
              },
            },
          },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const extendedMap = await loadExtendedCustomerFields(
      userId,
      items.map((item) => item.id),
    );

    const enrichedCustomers = items.map((customer) => ({
      ...serializeCustomer(customer, extendedMap.get(customer.id)),
      ...buildCustomerSummary(customer, extendedMap.get(customer.id)),
    }));

    return sendResponse(res, 200, {
      data: {
        items: enrichedCustomers,
        total,
        page,
        totalPages: getTotalPages(total, limit),
      },
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: CustomerCreateInput = req.body;
    const structuredAddress = resolveCustomerAddress(body);
    const legacyAddress = formatBusinessAddress(
      structuredAddress,
      body.address,
    );

    const customer = await prisma.customer.create({
      data: {
        user_id: userId,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: legacyAddress,
      },
      select: customerBaseSelect,
    });

    const customerType = normalizeCustomerType(body.type ?? body.customer_type);
    const businessName =
      customerType === "business"
        ? toNullableString(body.businessName ?? body.business_name)
        : null;

    await persistExtendedCustomerFields(userId, customer.id, {
      customer_type: customerType,
      business_name: businessName,
      gstin: toNullableString(body.gstin)
        ? normalizeGstin(body.gstin ?? undefined)
        : null,
      address_line1: structuredAddress.addressLine1 ?? null,
      city: structuredAddress.city ?? null,
      state: structuredAddress.state ?? null,
      pincode: structuredAddress.pincode ?? null,
      notes: toNullableString(body.notes),
      credit_limit: toNullableNumber(body.creditLimit ?? body.credit_limit),
      payment_terms:
        normalizePaymentTerms(body.paymentTerms ?? body.payment_terms) ??
        "DUE_ON_RECEIPT",
      opening_balance: roundAmount(
        Math.max(toNumber(body.openingBalance ?? body.opening_balance ?? 0), 0),
      ),
    });

    const extendedMap = await loadExtendedCustomerFields(userId, [customer.id]);

    if (businessId) {
      try {
        await createNotification({
          userId,
          businessId,
          type: "customer",
          message: `New customer ${customer.name} was added to your business.`,
          referenceKey: `customer-created:${customer.id}`,
        });
      } catch (error) {
        console.error(
          "[Customers] Notification creation failed, customer was still created",
          error,
        );
      }
    }

    return sendResponse(res, 201, {
      message: "Customer created",
      data: serializeCustomer(customer, extendedMap.get(customer.id)),
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      select: {
        ...customerBaseSelect,
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            date: true,
            due_date: true,
            status: true,
            total: true,
            payments: {
              select: {
                id: true,
                amount: true,
                method: true,
                reference: true,
                paid_at: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    const extendedMap = await loadExtendedCustomerFields(userId, [customer.id]);
    const extended = extendedMap.get(customer.id);

    return sendResponse(res, 200, {
      data: {
        ...serializeCustomer(customer, extended),
        ...buildCustomerSummary(customer, extended),
      },
    });
  }

  static async ledger(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      select: {
        ...customerBaseSelect,
        invoices: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            invoice_number: true,
            date: true,
            due_date: true,
            status: true,
            total: true,
            payments: {
              orderBy: { paid_at: "asc" },
              select: {
                id: true,
                amount: true,
                method: true,
                reference: true,
                paid_at: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    const extendedMap = await loadExtendedCustomerFields(userId, [customer.id]);

    return sendResponse(res, 200, {
      data: buildCustomerLedger(customer, extendedMap.get(customer.id)),
    });
  }

  static async ledgerPdf(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      select: {
        ...customerBaseSelect,
        invoices: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            invoice_number: true,
            date: true,
            due_date: true,
            status: true,
            total: true,
            payments: {
              orderBy: { paid_at: "asc" },
              select: {
                id: true,
                amount: true,
                method: true,
                reference: true,
                paid_at: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    const [extendedMap, businessProfile] = await Promise.all([
      loadExtendedCustomerFields(userId, [customer.id]),
      prisma.businessProfile.findUnique({
        where: { user_id: userId },
        select: { business_name: true },
      }),
    ]);

    const ledger = buildCustomerLedger(customer, extendedMap.get(customer.id));
    const html = buildLedgerPdfHtml(ledger, businessProfile?.business_name ?? null);

    try {
      const browser = await launchPuppeteerBrowser();
      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({
          format: "A4",
          printBackground: true,
          preferCSSPageSize: true,
          margin: {
            top: "20mm",
            right: "15mm",
            bottom: "20mm",
            left: "15mm",
          },
        });

        const fileName = `${customer.name || "customer"}-ledger-statement.pdf`
          .replace(/[^a-z0-9._-]+/gi, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
          .toLowerCase();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName || "customer-ledger-statement.pdf"}"`,
        );
        return res.status(200).send(Buffer.from(pdfBuffer));
      } finally {
        await browser.close();
      }
    } catch (error) {
      return sendResponse(res, 503, {
        message:
          error instanceof Error
            ? `PDF generator is unavailable: ${error.message}`
            : "PDF generator is unavailable.",
      });
    }
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: CustomerUpdateInput = req.body;

    const existingCustomer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!existingCustomer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    const existingExtendedMap = await loadExtendedCustomerFields(userId, [id]);
    const existingExtended = existingExtendedMap.get(id);

    const structuredAddress = resolveCustomerAddress(body, {
      address: existingCustomer.address,
      address_line1: existingExtended?.address_line1 ?? null,
      city: existingExtended?.city ?? null,
      state: existingExtended?.state ?? null,
      pincode: existingExtended?.pincode ?? null,
    });

    const legacyAddress = formatBusinessAddress(
      structuredAddress,
      body.address ?? existingCustomer.address,
    );

    const updated = await prisma.customer.updateMany({
      where: { id, user_id: userId },
      data: {
        name: body.name ?? existingCustomer.name,
        email: body.email ?? existingCustomer.email,
        phone: body.phone ?? existingCustomer.phone,
        address: legacyAddress,
      },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    const nextType = normalizeCustomerType(
      body.type ?? body.customer_type ?? existingExtended?.customer_type,
    );

    const nextBusinessName =
      nextType === "business"
        ? toNullableString(
            body.businessName ??
              body.business_name ??
              existingExtended?.business_name,
          )
        : null;

    const nextPaymentTerms =
      normalizePaymentTerms(
        body.paymentTerms ??
          body.payment_terms ??
          existingExtended?.payment_terms ??
          "DUE_ON_RECEIPT",
      ) ?? "DUE_ON_RECEIPT";

    await persistExtendedCustomerFields(userId, id, {
      customer_type: nextType,
      business_name: nextBusinessName,
      gstin: toNullableString(body.gstin ?? existingExtended?.gstin)
        ? normalizeGstin(body.gstin ?? existingExtended?.gstin)
        : null,
      address_line1: structuredAddress.addressLine1 ?? null,
      city: structuredAddress.city ?? null,
      state: structuredAddress.state ?? null,
      pincode: structuredAddress.pincode ?? null,
      notes: toNullableString(body.notes ?? existingExtended?.notes),
      credit_limit: toNullableNumber(
        body.creditLimit ?? body.credit_limit ?? existingExtended?.credit_limit,
      ),
      payment_terms: nextPaymentTerms,
      opening_balance: roundAmount(
        Math.max(
          toNumber(
            body.openingBalance ??
              body.opening_balance ??
              existingExtended?.opening_balance ??
              0,
          ),
          0,
        ),
      ),
    });

    return sendResponse(res, 200, { message: "Customer updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.customer.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { message: "Customer removed" });
  }
}

export default CustomersController;
