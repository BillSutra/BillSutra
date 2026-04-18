import { InvoiceStatus, Prisma, SaleStatus } from "@prisma/client";
import prisma from "../config/db.config.js";
import { getExtraEntryStats } from "./extraEntry.service.js";

type RevenuePoint = { date: Date; total: Prisma.Decimal | number };
type CostPoint = { date: Date; total: Prisma.Decimal | number };
type ExpensePoint = { month: Date; amount: number };

type NotificationInput = {
  lowStock: string[];
  pendingSales: Array<{ customer: string; pendingAmount: number }>;
  supplierPayables: Array<{ supplier: string; pendingAmount: number }>;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

let expenseTableExistsCache: boolean | null = null;

const hasExpensesTable = async () => {
  if (expenseTableExistsCache !== null) {
    return expenseTableExistsCache;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'expenses'
          AND n.nspname = 'public'
      ) AS "exists"
    `;
    expenseTableExistsCache = rows[0]?.exists ?? false;
  } catch {
    expenseTableExistsCache = false;
  }

  return expenseTableExistsCache;
};

export const buildMonthSeries = (months: number, fromDate = new Date()) => {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(
      Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth() - (months - 1 - index),
        1,
      ),
    );
    return {
      key: toMonthKey(date),
      label: monthLabel(date),
      date,
    };
  });
};

export const buildMonthlyProfitSeries = (params: {
  months: number;
  sales: RevenuePoint[];
  purchases: CostPoint[];
  expenses: ExpensePoint[];
  fromDate?: Date;
}) => {
  const { months, sales, purchases, expenses, fromDate } = params;
  const series = buildMonthSeries(months, fromDate);

  const salesMap = new Map<string, number>();
  sales.forEach((sale) => {
    const key = toMonthKey(sale.date);
    salesMap.set(key, (salesMap.get(key) ?? 0) + toNumber(sale.total));
  });

  const purchaseMap = new Map<string, number>();
  purchases.forEach((purchase) => {
    const key = toMonthKey(purchase.date);
    purchaseMap.set(
      key,
      (purchaseMap.get(key) ?? 0) + toNumber(purchase.total),
    );
  });

  const expenseMap = new Map<string, number>();
  expenses.forEach((expense) => {
    const key = toMonthKey(expense.month);
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + toNumber(expense.amount));
  });

  return series.map((month) => {
    const revenue = salesMap.get(month.key) ?? 0;
    const purchaseCost = purchaseMap.get(month.key) ?? 0;
    const expenseCost = expenseMap.get(month.key) ?? 0;
    const totalCost = purchaseCost + expenseCost;
    const profit = revenue - totalCost;

    return {
      key: month.key,
      month: month.label,
      revenue,
      purchaseCost,
      expenses: expenseCost,
      totalCost,
      profit,
    };
  });
};

export const buildSalesForecast = (
  historical: Array<{ month: string; value: number }>,
) => {
  const sourceValues = historical.map((item) => item.value);

  const movingAverage = (values: number[]) => {
    if (values.length === 0) return 0;
    const size = Math.min(3, values.length);
    const recent = values.slice(-size);
    return recent.reduce((sum, value) => sum + value, 0) / size;
  };

  const forecasts: Array<{ month: string; value: number }> = [];
  const now = new Date();
  const generated = [...sourceValues];

  for (let i = 1; i <= 3; i += 1) {
    const forecastDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1),
    );
    const forecastValue = movingAverage(generated);
    generated.push(forecastValue);
    forecasts.push({
      month: monthLabel(forecastDate),
      value: Number(forecastValue.toFixed(2)),
    });
  }

  return forecasts;
};

export const getExpenseTotals = async (params: {
  userId: number;
  from?: Date;
  to?: Date;
}) => {
  const { userId, from, to } = params;

  if (!(await hasExpensesTable())) {
    return 0;
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ total: Prisma.Decimal | number | null }>
    >`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE user_id = ${userId}
      ${from ? Prisma.sql`AND created_at >= ${from}` : Prisma.empty}
      ${to ? Prisma.sql`AND created_at < ${to}` : Prisma.empty}
    `;

    return toNumber(rows[0]?.total ?? 0);
  } catch {
    return 0;
  }
};

export const getMonthlyExpenses = async (params: {
  userId: number;
  from: Date;
}) => {
  const { userId, from } = params;

  if (!(await hasExpensesTable())) {
    return [] as ExpensePoint[];
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ month: Date; amount: Prisma.Decimal | number }>
    >`
      SELECT date_trunc('month', created_at)::date AS month, COALESCE(SUM(amount), 0) AS amount
      FROM expenses
      WHERE user_id = ${userId}
      AND created_at >= ${from}
      GROUP BY date_trunc('month', created_at)
      ORDER BY month ASC
    `;

    return rows.map((row) => ({
      month: new Date(row.month),
      amount: toNumber(row.amount),
    }));
  } catch {
    return [] as ExpensePoint[];
  }
};

export const getDailyExpenses = async (params: {
  userId: number;
  from: Date;
}) => {
  const { userId, from } = params;

  if (!(await hasExpensesTable())) {
    return [] as Array<{ day: Date; amount: number }>;
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ day: Date; amount: Prisma.Decimal | number }>
    >`
      SELECT date_trunc('day', created_at)::date AS day, COALESCE(SUM(amount), 0) AS amount
      FROM expenses
      WHERE user_id = ${userId}
      AND created_at >= ${from}
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `;

    return rows.map((row) => ({
      day: new Date(row.day),
      amount: toNumber(row.amount),
    }));
  } catch {
    return [] as Array<{ day: Date; amount: number }>;
  }
};

export const buildNotifications = ({
  lowStock,
  pendingSales,
  supplierPayables,
}: Omit<NotificationInput, 'overdueInvoices'>) => {
  const nowIso = new Date().toISOString();

  const lowStockNotifications = lowStock.map((item, index) => ({
    id: `low-stock-${index}`,
    type: "LOW_STOCK",
    title: "Low stock alert",
    message: item,
    redirectUrl: "/inventory",
    createdAt: nowIso,
    read: false,
  }));

  const salesPendingNotifications = pendingSales
    .slice(0, 4)
    .map((item, index) => ({
      id: `sales-payable-${index}`,
      type: "PENDING_INVOICE",
      title: "Pending invoice payment",
      message: `${item.customer}: Rs ${item.pendingAmount.toLocaleString("en-IN")}`,
      redirectUrl: "/sales",
      createdAt: nowIso,
      read: false,
    }));

  const supplierNotifications = supplierPayables
    .slice(0, 4)
    .map((item, index) => ({
      id: `supplier-payable-${index}`,
      type: "SUPPLIER_PAYABLE",
      title: "Supplier payable",
      message: `${item.supplier}: Rs ${item.pendingAmount.toLocaleString("en-IN")}`,
      redirectUrl: "/purchases",
      createdAt: nowIso,
      read: false,
    }));

  return [
    ...lowStockNotifications,
    ...salesPendingNotifications,
    ...supplierNotifications,
  ];
};

type DashboardRangePreset = "7d" | "30d" | "90d" | "ytd" | "custom";
type DashboardGranularity = "day" | "week" | "month";

export type DashboardFilterInput = {
  range?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  granularity?: unknown;
};

type PaymentMethodKey =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "UPI"
  | "CHEQUE"
  | "OTHER";

type SaleSnapshot = {
  id: number;
  sale_date: Date;
  total: Prisma.Decimal | number;
  totalAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  pendingAmount: Prisma.Decimal | number;
  paymentStatus: string;
  paymentMethod: PaymentMethodKey | null;
  customer: { name: string | null } | null;
};

type PurchaseSnapshot = {
  id: number;
  purchase_date: Date;
  total: Prisma.Decimal | number;
  totalAmount: Prisma.Decimal | number;
  paidAmount: Prisma.Decimal | number;
  pendingAmount: Prisma.Decimal | number;
  paymentStatus: string;
  paymentMethod: PaymentMethodKey | null;
  supplier: { name: string | null } | null;
};

type ExpenseDailyPoint = {
  day: Date;
  amount: number;
};

type DashboardBucket = {
  key: string;
  start: Date;
  end: Date;
  label: string;
};

type DashboardSummaryTotals = {
  bookedRevenue: number;
  collectedRevenue: number;
  bookedPurchases: number;
  cashOutflow: number;
  receivables: number;
  payables: number;
  expenses: number;
  bookedProfit: number;
  margin: number;
  extraIncome: number;
  extraExpense: number;
  extraLoss: number;
  extraInvestment: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const roundMetric = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const startOfDayUtc = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfWeekUtc = (date: Date) => {
  const normalized = startOfDayUtc(date);
  const offset = (normalized.getUTCDay() + 6) % 7;
  return addDaysUtc(normalized, -offset);
};

const startOfMonthUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const endOfDayLabel = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

type TotalsSnapshot = {
  bookedSales: number;
  totalSales: number;
  bookedPurchases: number;
  pendingSales: number;
  pendingPurchases: number;
  expenses: number;
  extraIncome: number;
  extraExpense: number;
  extraLoss: number;
  extraInvestment: number;
};

type SalesMetricSnapshot = {
  totalSales: number;
  pendingSales: number;
};

type CashInflowEntrySource =
  | "sale_receipt"
  | "invoice_payment"
  | "legacy_invoice_settlement";

type CashInflowEntry = {
  source: CashInflowEntrySource;
  amount: number;
  date: Date;
  saleId?: number;
  invoiceId?: number;
  paymentId?: number;
};

type CashInflowSnapshot = {
  total: number;
  entries: CashInflowEntry[];
  breakdown: {
    directSalesReceipts: number;
    invoicePayments: number;
    legacyInvoiceSettlements: number;
  };
};

const SYNCED_INVOICE_NOTE_PATTERN = /Synced from invoice\s+/i;
const DASHBOARD_SALES_DEBUG = process.env.DASHBOARD_DEBUG_SALES === "true";

const isSyncedInvoiceSale = (notes: string | null | undefined) =>
  SYNCED_INVOICE_NOTE_PATTERN.test(notes ?? "");

const logCashInflowSnapshot = (
  label: string,
  params: {
    userId: number;
    start: Date;
    endExclusive: Date;
    snapshot: CashInflowSnapshot;
  },
) => {
  if (!DASHBOARD_SALES_DEBUG) return;

  const { userId, start, endExclusive, snapshot } = params;
  const summarizeEntries = (source: CashInflowEntrySource) =>
    snapshot.entries
      .filter((entry) => entry.source === source)
      .map((entry) => ({
        amount: entry.amount,
        date: toDateKey(entry.date),
        saleId: entry.saleId,
        invoiceId: entry.invoiceId,
        paymentId: entry.paymentId,
      }));

  console.info(
    `[dashboard:sales] ${label}`,
    JSON.stringify({
      userId,
      range: {
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
      },
      totals: snapshot.breakdown,
      totalSales: snapshot.total,
      counts: {
        directSalesReceipts: summarizeEntries("sale_receipt").length,
        invoicePayments: summarizeEntries("invoice_payment").length,
        legacyInvoiceSettlements: summarizeEntries("legacy_invoice_settlement").length,
      },
      entries: {
        directSalesReceipts: summarizeEntries("sale_receipt"),
        invoicePayments: summarizeEntries("invoice_payment"),
        legacyInvoiceSettlements: summarizeEntries("legacy_invoice_settlement"),
      },
    }),
  );
};

const resolveInvoicePaidAmount = (invoice: {
  total: unknown;
  status: InvoiceStatus | string;
  payments: Array<{ amount: unknown }>;
}) => {
  const total = toNumber(invoice.total);
  const paidFromPayments = invoice.payments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const normalizedPaid = Math.max(0, Math.min(paidFromPayments, total));

  if (normalizedPaid > 0) {
    return normalizedPaid;
  }

  return invoice.status === InvoiceStatus.PAID ? total : 0;
};

const resolveInvoicePendingAmount = (invoice: {
  total: unknown;
  status: InvoiceStatus | string;
  payments: Array<{ amount: unknown }>;
}) => {
  if (invoice.status === InvoiceStatus.VOID || invoice.status === InvoiceStatus.DRAFT) {
    return 0;
  }

  const total = toNumber(invoice.total);
  const paid = resolveInvoicePaidAmount(invoice);
  return Math.max(0, total - paid);
};

export const fetchCashInflowSnapshot = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
  debugLabel?: string;
}) => {
  const { userId, start, endExclusive, debugLabel } = params;

  const [salesReceipts, invoicePayments, legacyPaidInvoices] = await Promise.all([
    prisma.sale.findMany({
      where: {
        user_id: userId,
        status: SaleStatus.COMPLETED,
        paidAmount: { gt: 0 },
        OR: [
          { paymentDate: { gte: start, lt: endExclusive } },
          { paymentDate: null, sale_date: { gte: start, lt: endExclusive } },
        ],
      },
      select: {
        id: true,
        sale_date: true,
        paymentDate: true,
        paidAmount: true,
        notes: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        user_id: userId,
        paid_at: { gte: start, lt: endExclusive },
      },
      select: {
        id: true,
        invoice_id: true,
        amount: true,
        paid_at: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        user_id: userId,
        date: { gte: start, lt: endExclusive },
        status: InvoiceStatus.PAID,
        payments: { none: {} },
      },
      select: {
        id: true,
        date: true,
        total: true,
      },
    }),
  ]);

  const directSalesEntries: CashInflowEntry[] = salesReceipts
    .filter((sale) => !isSyncedInvoiceSale(sale.notes))
    .map((sale) => ({
      source: "sale_receipt" as const,
      amount: roundMetric(toNumber(sale.paidAmount)),
      date: sale.paymentDate ?? sale.sale_date,
      saleId: sale.id,
    }))
    .filter((entry) => entry.amount > 0);

  const invoicePaymentEntries: CashInflowEntry[] = invoicePayments
    .map((payment) => ({
      source: "invoice_payment" as const,
      amount: roundMetric(toNumber(payment.amount)),
      date: payment.paid_at,
      invoiceId: payment.invoice_id,
      paymentId: payment.id,
    }))
    .filter((entry) => entry.amount > 0);

  const legacyInvoiceEntries: CashInflowEntry[] = legacyPaidInvoices
    .map((invoice) => ({
      source: "legacy_invoice_settlement" as const,
      amount: roundMetric(toNumber(invoice.total)),
      date: invoice.date,
      invoiceId: invoice.id,
    }))
    .filter((entry) => entry.amount > 0);

  const snapshot = {
    total: roundMetric(
      [...directSalesEntries, ...invoicePaymentEntries, ...legacyInvoiceEntries].reduce(
        (sum, entry) => sum + entry.amount,
        0,
      ),
    ),
    entries: [...directSalesEntries, ...invoicePaymentEntries, ...legacyInvoiceEntries],
    breakdown: {
      directSalesReceipts: roundMetric(
        directSalesEntries.reduce((sum, entry) => sum + entry.amount, 0),
      ),
      invoicePayments: roundMetric(
        invoicePaymentEntries.reduce((sum, entry) => sum + entry.amount, 0),
      ),
      legacyInvoiceSettlements: roundMetric(
        legacyInvoiceEntries.reduce((sum, entry) => sum + entry.amount, 0),
      ),
    },
  } satisfies CashInflowSnapshot;

  logCashInflowSnapshot(debugLabel ?? "cash inflow snapshot", {
    userId,
    start,
    endExclusive,
    snapshot,
  });

  return snapshot;
};

const fetchSalesMetricSnapshot = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const { userId, start, endExclusive } = params;

  const [cashInflowSnapshot, sales, invoices] = await Promise.all([
    fetchCashInflowSnapshot({
      userId,
      start,
      endExclusive,
      debugLabel: "dashboard sales metrics",
    }),
    prisma.sale.findMany({
      where: {
        user_id: userId,
        status: SaleStatus.COMPLETED,
        sale_date: { gte: start, lt: endExclusive },
      },
      select: {
        pendingAmount: true,
        notes: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        user_id: userId,
        date: { gte: start, lt: endExclusive },
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.PAID,
            InvoiceStatus.OVERDUE,
          ],
        },
      },
      select: {
        total: true,
        status: true,
        payments: {
          select: {
            amount: true,
          },
        },
      },
    }),
  ]);

  const directSales = sales.filter((sale) => !isSyncedInvoiceSale(sale.notes));

  const directSalesPending = directSales.reduce(
    (sum, sale) =>
      sum +
      Math.max(0, toNumber(sale.pendingAmount)),
    0,
  );

  const invoicePending = invoices.reduce(
    (sum, invoice) => sum + resolveInvoicePendingAmount(invoice),
    0,
  );

  return {
    totalSales: cashInflowSnapshot.total,
    pendingSales: roundMetric(directSalesPending + invoicePending),
  } satisfies SalesMetricSnapshot;
};

const sumSalesPurchases = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const { userId, start, endExclusive } = params;

  const [salesRows, purchaseRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ booked: Prisma.Decimal | number | null; pending: Prisma.Decimal | number | null }>
    >`
      SELECT COALESCE(SUM(COALESCE(total_amount, total)), 0) AS booked,
             COALESCE(SUM(pending_amount), 0) AS pending
      FROM sales
      WHERE user_id = ${userId}
        AND sale_date >= ${start}
        AND sale_date < ${endExclusive}
    `,
    prisma.$queryRaw<
      Array<{ booked: Prisma.Decimal | number | null; pending: Prisma.Decimal | number | null }>
    >`
      SELECT COALESCE(SUM(COALESCE(total_amount, total)), 0) AS booked,
             COALESCE(SUM(pending_amount), 0) AS pending
      FROM purchases
      WHERE user_id = ${userId}
        AND purchase_date >= ${start}
        AND purchase_date < ${endExclusive}
    `,
  ]);

  return {
    salesBooked: toNumber(salesRows[0]?.booked ?? 0),
    salesPending: toNumber(salesRows[0]?.pending ?? 0),
    purchasesBooked: toNumber(purchaseRows[0]?.booked ?? 0),
    purchasesPending: toNumber(purchaseRows[0]?.pending ?? 0),
  };
};

const fetchTotalsSnapshot = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const { userId, start, endExclusive } = params;
  const totals = await sumSalesPurchases({ userId, start, endExclusive });
  const salesMetrics = await fetchSalesMetricSnapshot({
    userId,
    start,
    endExclusive,
  });
  const expenses = await getExpenseTotals({ userId, from: start, to: endExclusive });
  const extraEntryStats = await getExtraEntryStats({ userId, from: start, to: endExclusive });

  return {
    bookedSales: roundMetric(totals.salesBooked),
    totalSales: roundMetric(salesMetrics.totalSales + extraEntryStats.income),
    bookedPurchases: roundMetric(totals.purchasesBooked),
    pendingSales: salesMetrics.pendingSales,
    pendingPurchases: roundMetric(totals.purchasesPending),
    expenses: roundMetric(expenses),
    extraIncome: roundMetric(extraEntryStats.income),
    extraExpense: roundMetric(extraEntryStats.expense),
    extraLoss: roundMetric(extraEntryStats.loss),
    extraInvestment: roundMetric(extraEntryStats.investment),
  } satisfies TotalsSnapshot;
};

const parseDateInput = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const safePercentChange = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    if (current === 0) return 0;
    return current > previous ? 100 : -100;
  }
  return roundMetric(((current - previous) / Math.abs(previous)) * 100, 1);
};

const resolveGranularity = (
  raw: unknown,
  daySpan: number,
): DashboardGranularity => {
  if (raw === "day" || raw === "week" || raw === "month") {
    return raw;
  }
  if (daySpan <= 31) return "day";
  if (daySpan <= 120) return "week";
  return "month";
};

export const resolveDashboardFilters = (
  input: DashboardFilterInput,
  now = new Date(),
) => {
  const today = startOfDayUtc(now);
  const range = (
    typeof input.range === "string" ? input.range.toLowerCase().trim() : "30d"
  ) as DashboardRangePreset;

  let resolvedRange: DashboardRangePreset = "30d";
  let start = addDaysUtc(today, -29);
  let endInclusive = today;

  if (range === "7d") {
    resolvedRange = "7d";
    start = addDaysUtc(today, -6);
  } else if (range === "90d") {
    resolvedRange = "90d";
    start = addDaysUtc(today, -89);
  } else if (range === "ytd") {
    resolvedRange = "ytd";
    start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  } else if (range === "custom") {
    const parsedStart = parseDateInput(input.startDate);
    const parsedEnd = parseDateInput(input.endDate);
    if (parsedStart && parsedEnd) {
      resolvedRange = "custom";
      start =
        parsedStart.getTime() <= parsedEnd.getTime() ? parsedStart : parsedEnd;
      endInclusive =
        parsedStart.getTime() <= parsedEnd.getTime() ? parsedEnd : parsedStart;
    }
  }

  const endExclusive = addDaysUtc(endInclusive, 1);
  const daySpan = Math.max(
    1,
    Math.round((endExclusive.getTime() - start.getTime()) / MS_PER_DAY),
  );
  const previousStart = addDaysUtc(start, -daySpan);
  const previousEndExclusive = start;
  const granularity = resolveGranularity(input.granularity, daySpan);

  const label =
    resolvedRange === "7d"
      ? "Last 7 days"
      : resolvedRange === "30d"
        ? "Last 30 days"
        : resolvedRange === "90d"
          ? "Last 90 days"
          : resolvedRange === "ytd"
            ? "Year to date"
            : `${endOfDayLabel(start)} - ${endOfDayLabel(endInclusive)}`;

  return {
    range: resolvedRange,
    start,
    endInclusive,
    endExclusive,
    previousStart,
    previousEndExclusive,
    granularity,
    daySpan,
    label,
  };
};

const formatBucketLabel = (
  start: Date,
  endExclusive: Date,
  granularity: DashboardGranularity,
) => {
  if (granularity === "month") {
    return monthLabel(start);
  }

  if (granularity === "week") {
    const end = addDaysUtc(endExclusive, -1);
    return `${endOfDayLabel(start)} - ${endOfDayLabel(end)}`;
  }

  return endOfDayLabel(start);
};

const buildDashboardBuckets = (
  start: Date,
  endExclusive: Date,
  granularity: DashboardGranularity,
) => {
  const buckets: DashboardBucket[] = [];

  if (granularity === "day") {
    for (let cursor = startOfDayUtc(start); cursor < endExclusive; cursor = addDaysUtc(cursor, 1)) {
      buckets.push({
        key: toDateKey(cursor),
        start: cursor,
        end: addDaysUtc(cursor, 1),
        label: formatBucketLabel(cursor, addDaysUtc(cursor, 1), "day"),
      });
    }
    return buckets;
  }

  if (granularity === "week") {
    for (let cursor = startOfWeekUtc(start); cursor < endExclusive; cursor = addDaysUtc(cursor, 7)) {
      const bucketStart = new Date(
        Math.max(cursor.getTime(), start.getTime()),
      );
      const bucketEnd = new Date(
        Math.min(addDaysUtc(cursor, 7).getTime(), endExclusive.getTime()),
      );

      if (bucketStart < bucketEnd) {
        buckets.push({
          key: toDateKey(cursor),
          start: bucketStart,
          end: bucketEnd,
          label: formatBucketLabel(bucketStart, bucketEnd, "week"),
        });
      }
    }
    return buckets;
  }

  for (
    let cursor = startOfMonthUtc(start);
    cursor < endExclusive;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  ) {
    const nextMonth = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
    const bucketStart = new Date(Math.max(cursor.getTime(), start.getTime()));
    const bucketEnd = new Date(Math.min(nextMonth.getTime(), endExclusive.getTime()));

    if (bucketStart < bucketEnd) {
      buckets.push({
        key: toMonthKey(cursor),
        start: bucketStart,
        end: bucketEnd,
        label: formatBucketLabel(cursor, nextMonth, "month"),
      });
    }
  }

  return buckets;
};

const resolveBucketKey = (
  date: Date,
  granularity: DashboardGranularity,
) => {
  if (granularity === "day") return toDateKey(date);
  if (granularity === "week") return toDateKey(startOfWeekUtc(date));
  return toMonthKey(date);
};

const resolveRecordedTotal = (totalAmount: unknown, total: unknown) => {
  const preferred = toNumber(totalAmount);
  if (preferred > 0) return preferred;
  return toNumber(total);
};

const resolveRealizedAmount = (
  paymentStatus: string,
  totalAmount: unknown,
  paidAmount: unknown,
  fallbackTotal?: unknown,
) => {
  const total = resolveRecordedTotal(totalAmount, fallbackTotal);
  const paid = Math.max(0, Math.min(toNumber(paidAmount), total));

  if (paymentStatus === "PAID") return total;
  if (paymentStatus === "PARTIALLY_PAID") return paid;
  return 0;
};

const computeDashboardTotals = (params: {
  sales: Array<Pick<SaleSnapshot, "total" | "totalAmount" | "paidAmount" | "pendingAmount" | "paymentStatus">>;
  purchases: Array<Pick<PurchaseSnapshot, "total" | "totalAmount" | "paidAmount" | "pendingAmount" | "paymentStatus">>;
  expenses: number;
  extraIncome?: number;
  extraExpense?: number;
  extraLoss?: number;
  extraInvestment?: number;
}) => {
  const { sales, purchases, expenses, extraIncome = 0, extraExpense = 0, extraLoss = 0, extraInvestment = 0 } = params;

  const bookedRevenue = sales.reduce(
    (sum, sale) => sum + resolveRecordedTotal(sale.totalAmount, sale.total),
    0,
  );
  const collectedRevenue = sales.reduce(
    (sum, sale) =>
      sum +
      resolveRealizedAmount(
        sale.paymentStatus,
        sale.totalAmount,
        sale.paidAmount,
        sale.total,
      ),
    0,
  );
  const receivables = sales.reduce(
    (sum, sale) => sum + Math.max(0, toNumber(sale.pendingAmount)),
    0,
  );
  const bookedPurchases = purchases.reduce(
    (sum, purchase) =>
      sum + resolveRecordedTotal(purchase.totalAmount, purchase.total),
    0,
  );
  const cashOutflow = purchases.reduce(
    (sum, purchase) =>
      sum +
      resolveRealizedAmount(
        purchase.paymentStatus,
        purchase.totalAmount,
        purchase.paidAmount,
        purchase.total,
      ),
    0,
  );
  const payables = purchases.reduce(
    (sum, purchase) => sum + Math.max(0, toNumber(purchase.pendingAmount)),
    0,
  );
  const bookedProfit = bookedRevenue - bookedPurchases - expenses + extraIncome - extraExpense - extraLoss - extraInvestment;
  const margin = bookedRevenue === 0 ? 0 : (bookedProfit / bookedRevenue) * 100;

  return {
    bookedRevenue: roundMetric(bookedRevenue),
    collectedRevenue: roundMetric(collectedRevenue),
    bookedPurchases: roundMetric(bookedPurchases),
    cashOutflow: roundMetric(cashOutflow + expenses),
    receivables: roundMetric(receivables),
    payables: roundMetric(payables),
    expenses: roundMetric(expenses),
    bookedProfit: roundMetric(bookedProfit),
    margin: roundMetric(margin, 1),
    extraIncome: roundMetric(extraIncome),
    extraExpense: roundMetric(extraExpense),
    extraLoss: roundMetric(extraLoss),
    extraInvestment: roundMetric(extraInvestment),
  } satisfies DashboardSummaryTotals;
};

const fetchProfitSnapshot = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const { userId, start, endExclusive } = params;

  const [cashInflowSnapshot, purchases, expenses, extraEntryStats] = await Promise.all([
    fetchCashInflowSnapshot({
      userId,
      start,
      endExclusive,
      debugLabel: "dashboard profit snapshot",
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        purchase_date: { gte: start, lt: endExclusive },
      },
      select: {
        total: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
      },
    }),
    getExpenseTotals({ userId, from: start, to: endExclusive }),
    getExtraEntryStats({ userId, from: start, to: endExclusive }),
  ]);

  const bookedPurchases = purchases.reduce(
    (sum, purchase) =>
      sum + resolveRecordedTotal(purchase.totalAmount, purchase.total),
    0,
  );
  const cashOutflow = purchases.reduce(
    (sum, purchase) =>
      sum +
      resolveRealizedAmount(
        purchase.paymentStatus,
        purchase.totalAmount,
        purchase.paidAmount,
        purchase.total,
      ),
    0,
  );
  const payables = purchases.reduce(
    (sum, purchase) => sum + Math.max(0, toNumber(purchase.pendingAmount)),
    0,
  );
  const realizedRevenue = roundMetric(cashInflowSnapshot.total);
  const realizedProfit = realizedRevenue - bookedPurchases - expenses + extraEntryStats.net;
  const realizedMargin =
    realizedRevenue === 0 ? 0 : (realizedProfit / realizedRevenue) * 100;

  return {
    bookedRevenue: realizedRevenue,
    collectedRevenue: realizedRevenue,
    bookedPurchases: roundMetric(bookedPurchases),
    cashOutflow: roundMetric(cashOutflow + expenses),
    receivables: 0,
    payables: roundMetric(payables),
    expenses: roundMetric(expenses),
    bookedProfit: roundMetric(realizedProfit),
    margin: roundMetric(realizedMargin, 1),
    extraIncome: roundMetric(extraEntryStats.income),
    extraExpense: roundMetric(extraEntryStats.expense),
    extraLoss: roundMetric(extraEntryStats.loss),
    extraInvestment: roundMetric(extraEntryStats.investment),
  } satisfies DashboardSummaryTotals;
};

const daysInMonthUtc = (year: number, monthIndex: number) =>
  new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

const buildPaymentMethodBreakdown = <
  T extends {
    paymentMethod: PaymentMethodKey | null;
    paymentStatus: string;
    totalAmount: unknown;
    total?: unknown;
    paidAmount: unknown;
  },
>(
  rows: T[],
) => {
  const methodMap = new Map<
    PaymentMethodKey,
    { method: PaymentMethodKey; count: number; amount: number }
  >();

  rows.forEach((row) => {
    if (!row.paymentMethod) return;
    const realized = resolveRealizedAmount(
      row.paymentStatus,
      row.totalAmount,
      row.paidAmount,
      row.total,
    );
    if (realized <= 0) return;

    const current = methodMap.get(row.paymentMethod) ?? {
      method: row.paymentMethod,
      count: 0,
      amount: 0,
    };

    current.count += 1;
    current.amount += realized;
    methodMap.set(row.paymentMethod, current);
  });

  return Array.from(methodMap.values())
    .map((item) => ({
      method: item.method,
      count: item.count,
      amount: roundMetric(item.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
};

export const buildDashboardOverview = async (params: {
  userId: number;
  filters: DashboardFilterInput;
}) => {
  const { userId, filters } = params;
  const resolved = resolveDashboardFilters(filters);
  const buckets = buildDashboardBuckets(
    resolved.start,
    resolved.endExclusive,
    resolved.granularity,
  );

  const [
    currentSales,
    previousSales,
    currentPurchases,
    previousPurchases,
    saleItems,
    products,
    totalCustomers,
    totalSuppliers,
    dailyExpenses,
    previousExpensesTotal,
    currentExtraEntryStats,
    previousExtraEntryStats,
    currentSalesMetrics,
    previousSalesMetrics,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        user_id: userId,
        sale_date: { gte: resolved.start, lt: resolved.endExclusive },
      },
      select: {
        id: true,
        sale_date: true,
        total: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        customer: { select: { name: true } },
      },
      orderBy: { sale_date: "desc" },
    }),
    prisma.sale.findMany({
      where: {
        user_id: userId,
        sale_date: {
          gte: resolved.previousStart,
          lt: resolved.previousEndExclusive,
        },
      },
      select: {
        total: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
      },
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        purchase_date: { gte: resolved.start, lt: resolved.endExclusive },
      },
      select: {
        id: true,
        purchase_date: true,
        total: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
        paymentMethod: true,
        supplier: { select: { name: true } },
      },
      orderBy: { purchase_date: "desc" },
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        purchase_date: {
          gte: resolved.previousStart,
          lt: resolved.previousEndExclusive,
        },
      },
      select: {
        total: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
      },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          user_id: userId,
          sale_date: { gte: resolved.start, lt: resolved.endExclusive },
        },
      },
      select: {
        name: true,
        quantity: true,
        line_total: true,
        product: { select: { category: { select: { name: true } } } },
      },
    }),
    prisma.product.findMany({
      where: { user_id: userId },
      select: {
        name: true,
        stock_on_hand: true,
        reorder_level: true,
        price: true,
        cost: true,
      },
    }),
    prisma.customer.count({ where: { user_id: userId } }),
    prisma.supplier.count({ where: { user_id: userId } }),
    getDailyExpenses({ userId, from: resolved.start }),
    getExpenseTotals({
      userId,
      from: resolved.previousStart,
      to: resolved.previousEndExclusive,
    }),
    getExtraEntryStats({
      userId,
      from: resolved.start,
      to: resolved.endExclusive,
    }),
    getExtraEntryStats({
      userId,
      from: resolved.previousStart,
      to: resolved.previousEndExclusive,
    }),
    fetchSalesMetricSnapshot({
      userId,
      start: resolved.start,
      endExclusive: resolved.endExclusive,
    }),
    fetchSalesMetricSnapshot({
      userId,
      start: resolved.previousStart,
      endExclusive: resolved.previousEndExclusive,
    }),
  ]);

  const filteredDailyExpenses = dailyExpenses.filter(
    (expense) => expense.day >= resolved.start && expense.day < resolved.endExclusive,
  );
  const expenseTotal = filteredDailyExpenses.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const currentTotals = computeDashboardTotals({
    sales: currentSales,
    purchases: currentPurchases,
    expenses: expenseTotal,
    extraIncome: currentExtraEntryStats.income,
    extraExpense: currentExtraEntryStats.expense,
    extraLoss: currentExtraEntryStats.loss,
    extraInvestment: currentExtraEntryStats.investment,
  });
  const previousTotals = computeDashboardTotals({
    sales: previousSales,
    purchases: previousPurchases,
    expenses: previousExpensesTotal,
    extraIncome: previousExtraEntryStats.income,
    extraExpense: previousExtraEntryStats.expense,
    extraLoss: previousExtraEntryStats.loss,
    extraInvestment: previousExtraEntryStats.investment,
  });

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const todayEnd = addDaysUtc(todayStart, 1);
  const weekStart = addDaysUtc(todayStart, -6);
  const monthStart = startOfMonthUtc(now);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const monthSpanDays = Math.max(
    1,
    Math.round((todayEnd.getTime() - monthStart.getTime()) / MS_PER_DAY),
  );
  const prevMonthStart = startOfMonthUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  );
  const prevMonthEnd = addDaysUtc(
    prevMonthStart,
    Math.min(
      monthSpanDays,
      daysInMonthUtc(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth()),
    ),
  );

  const yearSpanDays = Math.max(
    1,
    Math.round((todayEnd.getTime() - yearStart.getTime()) / MS_PER_DAY),
  );
  const prevYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const prevYearEnd = addDaysUtc(prevYearStart, yearSpanDays);

  const [
    todaySnapshot,
    yesterdaySnapshot,
    weekSnapshot,
    prevWeekSnapshot,
    monthSnapshot,
    prevMonthSnapshot,
    yearSnapshot,
    prevYearSnapshot,
  ] = await Promise.all([
    fetchProfitSnapshot({ userId, start: todayStart, endExclusive: todayEnd }),
    fetchProfitSnapshot({
      userId,
      start: addDaysUtc(todayStart, -1),
      endExclusive: todayStart,
    }),
    fetchProfitSnapshot({ userId, start: weekStart, endExclusive: todayEnd }),
    fetchProfitSnapshot({
      userId,
      start: addDaysUtc(weekStart, -7),
      endExclusive: weekStart,
    }),
    fetchProfitSnapshot({ userId, start: monthStart, endExclusive: todayEnd }),
    fetchProfitSnapshot({
      userId,
      start: prevMonthStart,
      endExclusive: prevMonthEnd,
    }),
    fetchProfitSnapshot({ userId, start: yearStart, endExclusive: todayEnd }),
    fetchProfitSnapshot({
      userId,
      start: prevYearStart,
      endExclusive: prevYearEnd,
    }),
  ]);

  const performanceMap = new Map(
    buckets.map((bucket) => [
      bucket.key,
      {
        key: bucket.key,
        label: bucket.label,
        revenue: 0,
        collected: 0,
        purchases: 0,
        cashOut: 0,
        receivables: 0,
        expenses: 0,
        profit: 0,
        orders: 0,
      },
    ]),
  );

  currentSales.forEach((sale) => {
    const key = resolveBucketKey(sale.sale_date, resolved.granularity);
    const bucket = performanceMap.get(key);
    if (!bucket) return;

    bucket.revenue += resolveRecordedTotal(sale.totalAmount, sale.total);
    bucket.collected += resolveRealizedAmount(
      sale.paymentStatus,
      sale.totalAmount,
      sale.paidAmount,
      sale.total,
    );
    bucket.receivables += Math.max(0, toNumber(sale.pendingAmount));
    bucket.orders += 1;
  });

  currentPurchases.forEach((purchase) => {
    const key = resolveBucketKey(purchase.purchase_date, resolved.granularity);
    const bucket = performanceMap.get(key);
    if (!bucket) return;

    bucket.purchases += resolveRecordedTotal(
      purchase.totalAmount,
      purchase.total,
    );
    bucket.cashOut += resolveRealizedAmount(
      purchase.paymentStatus,
      purchase.totalAmount,
      purchase.paidAmount,
      purchase.total,
    );
  });

  filteredDailyExpenses.forEach((expense) => {
    const key = resolveBucketKey(expense.day, resolved.granularity);
    const bucket = performanceMap.get(key);
    if (!bucket) return;
    bucket.expenses += expense.amount;
  });

  const performance = Array.from(performanceMap.values()).map((bucket) => {
    const profit = bucket.revenue - bucket.purchases - bucket.expenses;

    return {
      key: bucket.key,
      label: bucket.label,
      revenue: roundMetric(bucket.revenue),
      collected: roundMetric(bucket.collected),
      purchases: roundMetric(bucket.purchases),
      cashOut: roundMetric(bucket.cashOut + bucket.expenses),
      receivables: roundMetric(bucket.receivables),
      expenses: roundMetric(bucket.expenses),
      profit: roundMetric(profit),
      orders: bucket.orders,
      margin:
        bucket.revenue === 0 ? 0 : roundMetric((profit / bucket.revenue) * 100, 1),
    };
  });

  const categoryMap = new Map<string, number>();
  saleItems.forEach((item) => {
    const category = item.product?.category?.name ?? "Uncategorized";
    categoryMap.set(
      category,
      (categoryMap.get(category) ?? 0) + toNumber(item.line_total),
    );
  });

  const categoryMix = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value: roundMetric(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const customerMap = new Map<
    string,
    { customer: string; revenue: number; receivables: number; orders: number }
  >();
  currentSales.forEach((sale) => {
    const customer = sale.customer?.name ?? "Walk-in";
    const current = customerMap.get(customer) ?? {
      customer,
      revenue: 0,
      receivables: 0,
      orders: 0,
    };

    current.revenue += resolveRecordedTotal(sale.totalAmount, sale.total);
    current.receivables += Math.max(0, toNumber(sale.pendingAmount));
    current.orders += 1;
    customerMap.set(customer, current);
  });

  const customerHighlights = {
    totalCustomers,
    activeCustomers: customerMap.size,
    repeatRate:
      customerMap.size === 0
        ? 0
        : roundMetric(
            (Array.from(customerMap.values()).filter((item) => item.orders > 1)
              .length /
              customerMap.size) *
              100,
            1,
          ),
    topCustomers: Array.from(customerMap.values())
      .map((customer) => ({
        ...customer,
        revenue: roundMetric(customer.revenue),
        receivables: roundMetric(customer.receivables),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4),
  };

  const supplierMap = new Map<
    string,
    { supplier: string; spend: number; payables: number; orders: number }
  >();
  currentPurchases.forEach((purchase) => {
    const supplier = purchase.supplier?.name ?? "Unknown supplier";
    const current = supplierMap.get(supplier) ?? {
      supplier,
      spend: 0,
      payables: 0,
      orders: 0,
    };

    current.spend += resolveRecordedTotal(purchase.totalAmount, purchase.total);
    current.payables += Math.max(0, toNumber(purchase.pendingAmount));
    current.orders += 1;
    supplierMap.set(supplier, current);
  });

  const supplierHighlights = {
    totalSuppliers,
    payableTotal: currentTotals.payables,
    topSuppliers: Array.from(supplierMap.values())
      .map((supplier) => ({
        ...supplier,
        spend: roundMetric(supplier.spend),
        payables: roundMetric(supplier.payables),
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 4),
  };

  const lowStockItems = products
    .filter((product) => product.stock_on_hand <= product.reorder_level)
    .sort((a, b) => a.stock_on_hand - b.stock_on_hand)
    .slice(0, 6)
    .map((product) => ({
      name: product.name,
      stock: product.stock_on_hand,
      reorder: product.reorder_level,
      inventoryValue: roundMetric(
        resolveRecordedTotal(product.cost, product.price) *
          Math.max(product.stock_on_hand, 0),
      ),
    }));

  const inventoryValue = products.reduce((sum, product) => {
    const unitValue = resolveRecordedTotal(product.cost, product.price);
    return sum + unitValue * Math.max(product.stock_on_hand, 0);
  }, 0);

  const notifications = buildNotifications({
    lowStock: lowStockItems.map((item) => `${item.name} stock is ${item.stock}`),
    pendingSales: currentSales
      .filter((sale) => toNumber(sale.pendingAmount) > 0)
      .slice(0, 5)
      .map((sale) => ({
        customer: sale.customer?.name ?? "Walk-in",
        pendingAmount: roundMetric(toNumber(sale.pendingAmount)),
      })),
    supplierPayables: currentPurchases
      .filter((purchase) => toNumber(purchase.pendingAmount) > 0)
      .slice(0, 5)
      .map((purchase) => ({
        supplier: purchase.supplier?.name ?? "Supplier",
        pendingAmount: roundMetric(toNumber(purchase.pendingAmount)),
      })),
  });

  const recentTransactions = currentSales
    .slice(0, 50)
    .map((sale) => ({
      id: sale.id,
      date: sale.sale_date.toISOString(),
      invoiceNumber: `SI-${sale.id}`,
      customer: sale.customer?.name ?? "Walk-in",
      amount: roundMetric(resolveRecordedTotal(sale.totalAmount, sale.total)),
      paidAmount: roundMetric(toNumber(sale.paidAmount)),
      pendingAmount: roundMetric(toNumber(sale.pendingAmount)),
      paymentStatus:
        sale.paymentStatus === "PAID"
          ? "PAID"
          : sale.paymentStatus === "PARTIALLY_PAID"
            ? "PARTIAL"
            : "PENDING",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const activity = [
    ...currentSales.slice(0, 4).map((sale) => ({
      time: sale.sale_date,
      label: `Sale #${sale.id} recorded`,
    })),
    ...currentPurchases.slice(0, 4).map((purchase) => ({
      time: purchase.purchase_date,
      label: `Purchase #${purchase.id} added`,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 6)
    .map((item) => ({
      time: item.time.toISOString(),
      label: item.label,
    }));

  return {
    filters: {
      range: resolved.range,
      label: resolved.label,
      granularity: resolved.granularity,
      startDate: toDateKey(resolved.start),
      endDate: toDateKey(addDaysUtc(resolved.endExclusive, -1)),
    },
    summary: {
      revenue: {
        label: "Booked revenue",
        description: "All sales booked in the selected range.",
        value: currentTotals.bookedRevenue,
        previousValue: previousTotals.bookedRevenue,
        change: safePercentChange(
          currentTotals.bookedRevenue,
          previousTotals.bookedRevenue,
        ),
        format: "currency",
      },
      collected: {
        label: "Cash collected",
        description: "Paid sales value realized in the selected range.",
        value: currentTotals.collectedRevenue,
        previousValue: previousTotals.collectedRevenue,
        change: safePercentChange(
          currentTotals.collectedRevenue,
          previousTotals.collectedRevenue,
        ),
        format: "currency",
      },
      profit: {
        label: "Booked profit",
        description: "Revenue minus purchases and recorded expenses.",
        value: currentTotals.bookedProfit,
        previousValue: previousTotals.bookedProfit,
        change: safePercentChange(
          currentTotals.bookedProfit,
          previousTotals.bookedProfit,
        ),
        format: "currency",
      },
      receivables: {
        label: "Outstanding receivables",
        description: "Customer balances still pending collection.",
        value: currentTotals.receivables,
        previousValue: previousTotals.receivables,
        change: safePercentChange(
          currentTotals.receivables,
          previousTotals.receivables,
        ),
        format: "currency",
      },
      margin: {
        label: "Net margin",
        description: "Booked profit as a percentage of booked revenue.",
        value: currentTotals.margin,
        previousValue: previousTotals.margin,
        change: safePercentChange(currentTotals.margin, previousTotals.margin),
        format: "percent",
      },
    },
    performance,
    categoryMix,
    paymentMethods: {
      sales: buildPaymentMethodBreakdown(currentSales),
      purchases: buildPaymentMethodBreakdown(currentPurchases),
    },
    recentTransactions,
    customerHighlights,
    supplierHighlights,
    inventory: {
      totalProducts: products.length,
      lowStock: lowStockItems.length,
      outOfStock: products.filter((product) => product.stock_on_hand <= 0).length,
      inventoryValue: roundMetric(inventoryValue),
      lowStockItems,
    },
    notifications,
    activity,
    alerts: {
      lowStock: lowStockItems.map((item) => `${item.name} (${item.stock})`),
      supplierPayables: supplierHighlights.topSuppliers.map(
        (item) => `${item.supplier}: Rs ${item.payables.toLocaleString("en-IN")}`,
      ),
    },
    pendingPayments: recentTransactions
      .filter((item) => item.pendingAmount > 0)
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        invoiceNumber: item.invoiceNumber,
        customer: item.customer,
        totalAmount: item.amount,
        paidAmount: item.paidAmount,
        pendingAmount: item.pendingAmount,
        paymentStatus: item.paymentStatus,
        date: item.date,
      })),
    invoiceStats: {
      total: currentSales.length,
      paid: currentSales.filter((sale) => sale.paymentStatus === "PAID").length,
      pending: currentSales.filter((sale) => sale.paymentStatus !== "PAID").length,
      overdue: 0,
    },
    metrics: {
      totalRevenue: currentTotals.bookedRevenue,
      totalSales: currentSalesMetrics.totalSales,
      totalPurchases: currentTotals.bookedPurchases,
      expenses: currentTotals.expenses,
      receivables: currentTotals.receivables,
      payables: currentTotals.payables,
      pendingPayments: currentSalesMetrics.pendingSales,
      inventoryValue: roundMetric(inventoryValue),
      profits: {
        today: todaySnapshot.bookedProfit,
        weekly: weekSnapshot.bookedProfit,
        monthly: monthSnapshot.bookedProfit,
        yearly: yearSnapshot.bookedProfit,
      },
      changes: {
        totalRevenue: safePercentChange(
          currentTotals.bookedRevenue,
          previousTotals.bookedRevenue,
        ),
        totalSales: safePercentChange(
          currentSalesMetrics.totalSales,
          previousSalesMetrics.totalSales,
        ),
        totalPurchases: safePercentChange(
          currentTotals.bookedPurchases,
          previousTotals.bookedPurchases,
        ),
        expenses: safePercentChange(currentTotals.expenses, previousTotals.expenses),
        receivables: safePercentChange(
          currentTotals.receivables,
          previousTotals.receivables,
        ),
        payables: safePercentChange(currentTotals.payables, previousTotals.payables),
        todayProfit: safePercentChange(
          todaySnapshot.bookedProfit,
          yesterdaySnapshot.bookedProfit,
        ),
        weeklyProfit: safePercentChange(
          weekSnapshot.bookedProfit,
          prevWeekSnapshot.bookedProfit,
        ),
        monthlyProfit: safePercentChange(
          monthSnapshot.bookedProfit,
          prevMonthSnapshot.bookedProfit,
        ),
        yearlyProfit: safePercentChange(
          yearSnapshot.bookedProfit,
          prevYearSnapshot.bookedProfit,
        ),
        pendingPayments: safePercentChange(
          currentSalesMetrics.pendingSales,
          previousSalesMetrics.pendingSales,
        ),
        inventoryValue: 0,
      },
    },
  };
};

export const buildDashboardCardMetrics = async (params: {
  userId: number;
  filters: DashboardFilterInput;
}) => {
  const { userId, filters } = params;
  const resolved = resolveDashboardFilters(filters);

  const currentTotals = await fetchTotalsSnapshot({
    userId,
    start: resolved.start,
    endExclusive: resolved.endExclusive,
  });
  const previousTotals = await fetchTotalsSnapshot({
    userId,
    start: resolved.previousStart,
    endExclusive: resolved.previousEndExclusive,
  });

  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const todayEnd = addDaysUtc(todayStart, 1);
  const weekStart = addDaysUtc(todayStart, -6);
  const monthStart = startOfMonthUtc(now);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const monthSpanDays = Math.max(
    1,
    Math.round((todayEnd.getTime() - monthStart.getTime()) / MS_PER_DAY),
  );
  const prevMonthStart = startOfMonthUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  );
  const prevMonthEnd = addDaysUtc(
    prevMonthStart,
    Math.min(
      monthSpanDays,
      daysInMonthUtc(prevMonthStart.getUTCFullYear(), prevMonthStart.getUTCMonth()),
    ),
  );

  const yearSpanDays = Math.max(
    1,
    Math.round((todayEnd.getTime() - yearStart.getTime()) / MS_PER_DAY),
  );
  const prevYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
  const prevYearEnd = addDaysUtc(prevYearStart, yearSpanDays);

  const todaySnapshot = await fetchTotalsSnapshot({
    userId,
    start: todayStart,
    endExclusive: todayEnd,
  });
  const yesterdaySnapshot = await fetchTotalsSnapshot({
    userId,
    start: addDaysUtc(todayStart, -1),
    endExclusive: todayStart,
  });
  const weekSnapshot = await fetchTotalsSnapshot({
    userId,
    start: weekStart,
    endExclusive: todayEnd,
  });
  const prevWeekSnapshot = await fetchTotalsSnapshot({
    userId,
    start: addDaysUtc(weekStart, -7),
    endExclusive: weekStart,
  });
  const monthSnapshot = await fetchTotalsSnapshot({
    userId,
    start: monthStart,
    endExclusive: todayEnd,
  });
  const prevMonthSnapshot = await fetchTotalsSnapshot({
    userId,
    start: prevMonthStart,
    endExclusive: prevMonthEnd,
  });
  const yearSnapshot = await fetchTotalsSnapshot({
    userId,
    start: yearStart,
    endExclusive: todayEnd,
  });
  const prevYearSnapshot = await fetchTotalsSnapshot({
    userId,
    start: prevYearStart,
    endExclusive: prevYearEnd,
  });

  const calcProfit = (snapshot: TotalsSnapshot) =>
    roundMetric(snapshot.totalSales - snapshot.bookedPurchases - snapshot.expenses + snapshot.extraIncome - snapshot.extraExpense - snapshot.extraLoss - snapshot.extraInvestment);

  const profits = {
    today: calcProfit(todaySnapshot),
    weekly: calcProfit(weekSnapshot),
    monthly: calcProfit(monthSnapshot),
    yearly: calcProfit(yearSnapshot),
  };

  const prevProfits = {
    today: calcProfit(yesterdaySnapshot),
    weekly: calcProfit(prevWeekSnapshot),
    monthly: calcProfit(prevMonthSnapshot),
    yearly: calcProfit(prevYearSnapshot),
  };

  return {
    filters: {
      range: resolved.range,
      label: resolved.label,
      granularity: resolved.granularity,
      startDate: toDateKey(resolved.start),
      endDate: toDateKey(addDaysUtc(resolved.endExclusive, -1)),
    },
    metrics: {
      totalSales: currentTotals.totalSales,
      totalPurchases: currentTotals.bookedPurchases,
      pendingSalesPayments: currentTotals.pendingSales,
      pendingPurchasePayments: currentTotals.pendingPurchases,
      profits,
      changes: {
        totalSales: safePercentChange(
          currentTotals.totalSales,
          previousTotals.totalSales,
        ),
        totalPurchases: safePercentChange(
          currentTotals.bookedPurchases,
          previousTotals.bookedPurchases,
        ),
        pendingSalesPayments: safePercentChange(
          currentTotals.pendingSales,
          previousTotals.pendingSales,
        ),
        pendingPurchasePayments: safePercentChange(
          currentTotals.pendingPurchases,
          previousTotals.pendingPurchases,
        ),
        todayProfit: safePercentChange(profits.today, prevProfits.today),
        weeklyProfit: safePercentChange(profits.weekly, prevProfits.weekly),
        monthlyProfit: safePercentChange(profits.monthly, prevProfits.monthly),
        yearlyProfit: safePercentChange(profits.yearly, prevProfits.yearly),
      },
    },
  };
};
