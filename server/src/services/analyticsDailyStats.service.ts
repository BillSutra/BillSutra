import { Prisma, type AnalyticsDailyStat } from "@prisma/client";
import prisma from "../config/db.config.js";
import {
  ensureAnalyticsDailyStatsTable,
  ensureExtraEntriesTable,
} from "../lib/schemaCompatibility.js";
import {
  buildAnalyticsStatsDirtyRedisKey,
  buildAnalyticsStatsFallbackRedisKey,
} from "../redis/cacheKeys.js";
import { deleteCache, getCache, setCache } from "../redis/cache.js";

const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  VOID: "VOID",
} as const;

const SALE_STATUS = {
  COMPLETED: "COMPLETED",
} as const;

const SYNCED_INVOICE_NOTE_REGEX_SOURCE = "Synced from invoice\\s+";
const ANALYTICS_DIRTY_TTL_SECONDS = Math.max(
  Number(process.env.ANALYTICS_STATS_DIRTY_TTL_SECONDS ?? 24 * 60 * 60),
  60,
);
const ANALYTICS_SYNC_REFRESH_COOLDOWN_MS = Math.max(
  Number(process.env.ANALYTICS_STATS_SYNC_REFRESH_COOLDOWN_MS ?? 30_000),
  5_000,
);
const ANALYTICS_RECENT_REFRESH_DAYS = Math.max(
  Number(process.env.ANALYTICS_STATS_RECENT_REFRESH_DAYS ?? 400),
  30,
);
const ANALYTICS_FALLBACK_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.ANALYTICS_STATS_FALLBACK_CACHE_TTL_SECONDS ?? 30),
  5,
);

type DailyAmountRow = {
  day: Date;
  total: Prisma.Decimal | number | null;
};

type DailyCounterRow = {
  day: Date;
  total: bigint | number | null;
};

type InvoiceDailyRow = {
  day: Date;
  billed: Prisma.Decimal | number | null;
  pending: Prisma.Decimal | number | null;
  total: bigint | number | null;
};

type ExtraEntryDailyRow = {
  day: Date;
  type: "INCOME" | "EXPENSE" | "LOSS" | "INVESTMENT";
  total: Prisma.Decimal | number | null;
};

export type AnalyticsDailyStatsRecord = {
  date: Date;
  bookedSales: number;
  collectedSales: number;
  pendingSales: number;
  saleCount: number;
  invoiceBilled: number;
  invoiceCount: number;
  invoiceCollections: number;
  invoicePending: number;
  bookedPurchases: number;
  cashOutPurchases: number;
  pendingPurchases: number;
  purchaseCount: number;
  expenses: number;
  extraIncome: number;
  extraExpense: number;
  extraLoss: number;
  extraInvestment: number;
  customersCreated: number;
  suppliersCreated: number;
  updatedAt: Date;
};

type AnalyticsDailyStatsAccumulator = Omit<
  AnalyticsDailyStatsRecord,
  "updatedAt"
>;
type AnalyticsDailyNumericField = Exclude<
  keyof AnalyticsDailyStatsAccumulator,
  "date"
>;

type AnalyticsDailyStatsDirtyMarker = {
  markedAt: string;
  source?: string;
};

type AnalyticsDailyStatsSupportStatus = {
  mode: "preaggregated" | "fallback";
  fallbackReason: string | null;
};

const dirtyRefreshCooldown = new Map<number, number>();
let analyticsDailyStatsSupportMode: AnalyticsDailyStatsSupportStatus["mode"] =
  "preaggregated";
let analyticsDailyStatsFallbackReason: string | null = null;
let analyticsDailyStatsFallbackWarningLogged = false;

const toNumber = (value: unknown) => Number(value ?? 0);
const toCount = (value: bigint | number | null | undefined) =>
  Number(value ?? 0);

const roundMetric = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const startOfDayUtc = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const getAnalyticsRecentRefreshWindowDays = () =>
  ANALYTICS_RECENT_REFRESH_DAYS;

export const buildDateKey = (date: Date) => date.toISOString().slice(0, 10);

const buildDateSeries = (start: Date, endExclusive: Date) => {
  const normalizedStart = startOfDayUtc(start);
  const normalizedEnd = startOfDayUtc(endExclusive);
  const dates: Date[] = [];

  for (
    let cursor = normalizedStart;
    cursor.getTime() < normalizedEnd.getTime();
    cursor = addDaysUtc(cursor, 1)
  ) {
    dates.push(cursor);
  }

  return dates;
};

const buildAccumulator = (date: Date): AnalyticsDailyStatsAccumulator => ({
  date,
  bookedSales: 0,
  collectedSales: 0,
  pendingSales: 0,
  saleCount: 0,
  invoiceBilled: 0,
  invoiceCount: 0,
  invoiceCollections: 0,
  invoicePending: 0,
  bookedPurchases: 0,
  cashOutPurchases: 0,
  pendingPurchases: 0,
  purchaseCount: 0,
  expenses: 0,
  extraIncome: 0,
  extraExpense: 0,
  extraLoss: 0,
  extraInvestment: 0,
  customersCreated: 0,
  suppliersCreated: 0,
});

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

const fetchExpenseDailyRows = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  if (!(await hasExpensesTable())) {
    return [] as DailyAmountRow[];
  }

  try {
    return await prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE user_id = ${params.userId}
        AND created_at >= ${params.start}
        AND created_at < ${params.endExclusive}
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `);
  } catch {
    return [] as DailyAmountRow[];
  }
};

export const fetchAnalyticsSourceBounds = async (userId: number) => {
  await ensureExtraEntriesTable();

  const expenseBoundsPromise = (async () => {
    if (!(await hasExpensesTable())) {
      return null;
    }

    try {
      const rows = await prisma.$queryRaw<Array<{ min_date: Date | null }>>`
        SELECT MIN(created_at)::date AS min_date
        FROM expenses
        WHERE user_id = ${userId}
      `;
      return rows[0]?.min_date ?? null;
    } catch {
      return null;
    }
  })();

  const [
    saleAgg,
    purchaseAgg,
    invoiceAgg,
    paymentAgg,
    customerAgg,
    supplierAgg,
    extraEntryAgg,
    expenseMinDate,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { user_id: userId },
      _min: { sale_date: true },
    }),
    prisma.purchase.aggregate({
      where: { user_id: userId },
      _min: { purchase_date: true },
    }),
    prisma.invoice.aggregate({
      where: { user_id: userId },
      _min: { date: true },
    }),
    prisma.payment.aggregate({
      where: { user_id: userId },
      _min: { paid_at: true },
    }),
    prisma.customer.aggregate({
      where: { user_id: userId },
      _min: { created_at: true },
    }),
    prisma.supplier.aggregate({
      where: { user_id: userId },
      _min: { created_at: true },
    }),
    prisma.extraEntry.aggregate({
      where: { userId },
      _min: { date: true },
    }),
    expenseBoundsPromise,
  ]);

  const candidates = [
    saleAgg._min.sale_date,
    purchaseAgg._min.purchase_date,
    invoiceAgg._min.date,
    paymentAgg._min.paid_at,
    customerAgg._min.created_at,
    supplierAgg._min.created_at,
    extraEntryAgg._min.date,
    expenseMinDate,
  ].filter((value): value is Date => value instanceof Date);

  if (candidates.length === 0) {
    return null;
  }

  const earliest = candidates.reduce((min, current) =>
    current.getTime() < min.getTime() ? current : min,
  );

  return {
    start: startOfDayUtc(earliest),
    endExclusive: addDaysUtc(startOfDayUtc(new Date()), 1),
  };
};

export const getAnalyticsStatsDirtyMarker = async (userId: number) =>
  getCache<AnalyticsDailyStatsDirtyMarker>(
    buildAnalyticsStatsDirtyRedisKey(userId),
  );

export const markAnalyticsStatsDirty = async (params: {
  userId: number;
  source?: string;
}) => {
  const marker: AnalyticsDailyStatsDirtyMarker = {
    markedAt: new Date().toISOString(),
    source: params.source,
  };

  await setCache(
    buildAnalyticsStatsDirtyRedisKey(params.userId),
    marker,
    ANALYTICS_DIRTY_TTL_SECONDS,
  );
};

export const clearAnalyticsStatsDirty = async (userId: number) => {
  await deleteCache(buildAnalyticsStatsDirtyRedisKey(userId));
};

const shouldSynchronouslyRefreshDirtyRange = (params: {
  userId: number;
  endExclusive: Date;
  dirtyMarker: AnalyticsDailyStatsDirtyMarker | null;
}) => {
  if (!params.dirtyMarker) {
    return false;
  }

  const dirtyAtMs = Date.parse(params.dirtyMarker.markedAt);
  if (!Number.isFinite(dirtyAtMs)) {
    return false;
  }

  const recentWindowStart = addDaysUtc(
    startOfDayUtc(new Date()),
    -ANALYTICS_RECENT_REFRESH_DAYS,
  );
  if (params.endExclusive.getTime() < recentWindowStart.getTime()) {
    return false;
  }

  const lastRefreshAt = dirtyRefreshCooldown.get(params.userId) ?? 0;
  return Date.now() - lastRefreshAt >= ANALYTICS_SYNC_REFRESH_COOLDOWN_MS;
};

const markLocalDirtyRefresh = (userId: number) => {
  dirtyRefreshCooldown.set(userId, Date.now());
};

const isAnalyticsDailyStatsMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

const isAnalyticsDailyStatsUniqueConflictError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002" &&
  /user_?id/i.test(String(error.meta?.target ?? "")) &&
  /date/i.test(String(error.meta?.target ?? ""));

const setAnalyticsDailyStatsFallbackMode = (
  reason: string,
  error?: unknown,
) => {
  analyticsDailyStatsSupportMode = "fallback";
  analyticsDailyStatsFallbackReason = reason;

  if (!analyticsDailyStatsFallbackWarningLogged) {
    analyticsDailyStatsFallbackWarningLogged = true;
    console.warn(
      "[analytics.daily-stats] pre-aggregated table unavailable; falling back to raw aggregation",
      {
        reason,
        message: error instanceof Error ? error.message : undefined,
      },
    );
  }
};

const setAnalyticsDailyStatsPreaggregatedMode = () => {
  analyticsDailyStatsSupportMode = "preaggregated";
  analyticsDailyStatsFallbackReason = null;
};

export const getAnalyticsDailyStatsSupportStatus =
  (): AnalyticsDailyStatsSupportStatus => ({
    mode: analyticsDailyStatsSupportMode,
    fallbackReason: analyticsDailyStatsFallbackReason,
  });

export const initializeAnalyticsDailyStatsSupport = async () => {
  try {
    await ensureAnalyticsDailyStatsTable();
    setAnalyticsDailyStatsPreaggregatedMode();
  } catch (error) {
    setAnalyticsDailyStatsFallbackMode("table_unavailable", error);
  }

  return getAnalyticsDailyStatsSupportStatus();
};

const hydrateAnalyticsDailyStatsRecord = (
  row: AnalyticsDailyStatsRecord,
): AnalyticsDailyStatsRecord => ({
  ...row,
  date: new Date(row.date),
  updatedAt: new Date(row.updatedAt),
});

const buildFallbackCacheKey = (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) =>
  buildAnalyticsStatsFallbackRedisKey({
    userId: params.userId,
    startDate: buildDateKey(params.start),
    endDate: buildDateKey(params.endExclusive),
  });

const toAnalyticsRecord = (
  row: AnalyticsDailyStat,
): AnalyticsDailyStatsRecord => ({
  date: row.date,
  bookedSales: toNumber(row.bookedSales),
  collectedSales: toNumber(row.collectedSales),
  pendingSales: toNumber(row.pendingSales),
  saleCount: row.saleCount,
  invoiceBilled: toNumber(row.invoiceBilled),
  invoiceCount: row.invoiceCount,
  invoiceCollections: toNumber(row.invoiceCollections),
  invoicePending: toNumber(row.invoicePending),
  bookedPurchases: toNumber(row.bookedPurchases),
  cashOutPurchases: toNumber(row.cashOutPurchases),
  pendingPurchases: toNumber(row.pendingPurchases),
  purchaseCount: row.purchaseCount,
  expenses: toNumber(row.expenses),
  extraIncome: toNumber(row.extraIncome),
  extraExpense: toNumber(row.extraExpense),
  extraLoss: toNumber(row.extraLoss),
  extraInvestment: toNumber(row.extraInvestment),
  customersCreated: row.customersCreated,
  suppliersCreated: row.suppliersCreated,
  updatedAt: row.updatedAt,
});

export const rebuildAnalyticsDailyStatsRange = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  if (analyticsDailyStatsSupportMode !== "fallback") {
    try {
      await ensureAnalyticsDailyStatsTable();
      setAnalyticsDailyStatsPreaggregatedMode();
    } catch (error) {
      setAnalyticsDailyStatsFallbackMode("table_unavailable", error);
    }
  }

  const start = startOfDayUtc(params.start);
  const endExclusive = startOfDayUtc(params.endExclusive);

  if (endExclusive.getTime() <= start.getTime()) {
    return [] as AnalyticsDailyStatsRecord[];
  }

  await ensureExtraEntriesTable();

  const [
    salesBookedRows,
    collectedSalesRows,
    invoiceDailyRows,
    invoiceCollectionRows,
    purchaseBookedRows,
    purchaseCashRows,
    expenseRows,
    extraEntryRows,
    customerRows,
    supplierRows,
  ] = await Promise.all([
    prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', sale_date)::date AS day,
        COALESCE(SUM(COALESCE(total_amount, total)), 0) AS total
      FROM sales
      WHERE user_id = ${params.userId}
        AND sale_date >= ${start}
        AND sale_date < ${endExclusive}
      GROUP BY date_trunc('day', sale_date)
      ORDER BY day ASC
    `),
    prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', COALESCE(payment_date, sale_date))::date AS day,
        COALESCE(SUM(paid_amount), 0) AS total
      FROM sales
      WHERE user_id = ${params.userId}
        AND status = ${SALE_STATUS.COMPLETED}::"SaleStatus"
        AND paid_amount > 0
        AND (
          (payment_date >= ${start} AND payment_date < ${endExclusive})
          OR (
            payment_date IS NULL
            AND sale_date >= ${start}
            AND sale_date < ${endExclusive}
          )
        )
        AND (notes IS NULL OR notes !~* ${SYNCED_INVOICE_NOTE_REGEX_SOURCE})
      GROUP BY date_trunc('day', COALESCE(payment_date, sale_date))
      ORDER BY day ASC
    `),
    prisma.$queryRaw<InvoiceDailyRow[]>(Prisma.sql`
      WITH invoice_scope AS (
        SELECT
          id,
          date_trunc('day', issue_date)::date AS day,
          total,
          status
        FROM invoices
        WHERE user_id = ${params.userId}
          AND issue_date >= ${start}
          AND issue_date < ${endExclusive}
      ),
      payment_totals AS (
        SELECT
          invoice_id,
          COALESCE(SUM(amount), 0) AS paid_total
        FROM payments
        WHERE invoice_id IN (SELECT id FROM invoice_scope)
        GROUP BY invoice_id
      )
      SELECT
        i.day AS day,
        COALESCE(
          SUM(
            CASE
              WHEN i.status IN (${INVOICE_STATUS.DRAFT}::"InvoiceStatus", ${INVOICE_STATUS.VOID}::"InvoiceStatus")
                THEN 0
              ELSE COALESCE(i.total, 0)
            END
          ),
          0
        ) AS billed,
        COALESCE(
          SUM(
            CASE
              WHEN i.status IN (${INVOICE_STATUS.DRAFT}::"InvoiceStatus", ${INVOICE_STATUS.VOID}::"InvoiceStatus")
                THEN 0
              ELSE GREATEST(
                COALESCE(i.total, 0) - LEAST(COALESCE(pt.paid_total, 0), COALESCE(i.total, 0)),
                0
              )
            END
          ),
          0
        ) AS pending,
        COUNT(*) FILTER (
          WHERE i.status NOT IN (${INVOICE_STATUS.DRAFT}::"InvoiceStatus", ${INVOICE_STATUS.VOID}::"InvoiceStatus")
        ) AS total
      FROM invoice_scope AS i
      LEFT JOIN payment_totals AS pt
        ON pt.invoice_id = i.id
      GROUP BY i.day
      ORDER BY i.day ASC
    `),
    prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', paid_at)::date AS day,
        COALESCE(SUM(amount), 0) AS total
      FROM payments
      WHERE user_id = ${params.userId}
        AND paid_at >= ${start}
        AND paid_at < ${endExclusive}
      GROUP BY date_trunc('day', paid_at)
      ORDER BY day ASC
    `),
    prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', purchase_date)::date AS day,
        COALESCE(SUM(COALESCE(total_amount, total)), 0) AS total
      FROM purchases
      WHERE user_id = ${params.userId}
        AND purchase_date >= ${start}
        AND purchase_date < ${endExclusive}
      GROUP BY date_trunc('day', purchase_date)
      ORDER BY day ASC
    `),
    prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', COALESCE(payment_date, purchase_date))::date AS day,
        COALESCE(SUM(paid_amount), 0) AS total
      FROM purchases
      WHERE user_id = ${params.userId}
        AND paid_amount > 0
        AND (
          (payment_date >= ${start} AND payment_date < ${endExclusive})
          OR (
            payment_date IS NULL
            AND purchase_date >= ${start}
            AND purchase_date < ${endExclusive}
          )
        )
      GROUP BY date_trunc('day', COALESCE(payment_date, purchase_date))
      ORDER BY day ASC
    `),
    fetchExpenseDailyRows({ userId: params.userId, start, endExclusive }),
    prisma.$queryRaw<ExtraEntryDailyRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', date)::date AS day,
        type,
        COALESCE(SUM(amount), 0) AS total
      FROM extra_entries
      WHERE user_id = ${params.userId}
        AND date >= ${start}
        AND date < ${endExclusive}
      GROUP BY date_trunc('day', date), type
      ORDER BY day ASC
    `),
    prisma.$queryRaw<DailyCounterRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) AS total
      FROM customers
      WHERE user_id = ${params.userId}
        AND created_at >= ${start}
        AND created_at < ${endExclusive}
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `),
    prisma.$queryRaw<DailyCounterRow[]>(Prisma.sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) AS total
      FROM suppliers
      WHERE user_id = ${params.userId}
        AND created_at >= ${start}
        AND created_at < ${endExclusive}
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `),
  ]);

  const dailyMap = new Map<string, AnalyticsDailyStatsAccumulator>();
  for (const date of buildDateSeries(start, endExclusive)) {
    dailyMap.set(buildDateKey(date), buildAccumulator(date));
  }

  const applyAmountRows = (
    rows: DailyAmountRow[],
    field: AnalyticsDailyNumericField,
  ) => {
    rows.forEach((row) => {
      const key = buildDateKey(new Date(row.day));
      const current = dailyMap.get(key);
      if (!current) return;
      current[field] = roundMetric(toNumber(row.total));
    });
  };

  const applyCounterRows = (
    rows: DailyCounterRow[],
    field: AnalyticsDailyNumericField,
  ) => {
    rows.forEach((row) => {
      const key = buildDateKey(new Date(row.day));
      const current = dailyMap.get(key);
      if (!current) return;
      current[field] = toCount(row.total);
    });
  };

  applyAmountRows(salesBookedRows, "bookedSales");
  applyAmountRows(collectedSalesRows, "collectedSales");
  applyAmountRows(invoiceCollectionRows, "invoiceCollections");
  applyAmountRows(purchaseBookedRows, "bookedPurchases");
  applyAmountRows(purchaseCashRows, "cashOutPurchases");
  applyAmountRows(expenseRows, "expenses");
  applyCounterRows(customerRows, "customersCreated");
  applyCounterRows(supplierRows, "suppliersCreated");

  invoiceDailyRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    current.invoiceBilled = roundMetric(toNumber(row.billed));
    current.invoicePending = roundMetric(toNumber(row.pending));
    current.invoiceCount = toCount(row.total);
    current.pendingSales = roundMetric(current.pendingSales + current.invoicePending);
  });

  const [salesPendingRows, purchasePendingRows, salesCountRows, purchaseCountRows] =
    await Promise.all([
      prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', sale_date)::date AS day,
          COALESCE(SUM(pending_amount), 0) AS total
        FROM sales
        WHERE user_id = ${params.userId}
          AND status = ${SALE_STATUS.COMPLETED}::"SaleStatus"
          AND sale_date >= ${start}
          AND sale_date < ${endExclusive}
          AND (notes IS NULL OR notes !~* ${SYNCED_INVOICE_NOTE_REGEX_SOURCE})
        GROUP BY date_trunc('day', sale_date)
        ORDER BY day ASC
      `),
      prisma.$queryRaw<DailyAmountRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', purchase_date)::date AS day,
          COALESCE(SUM(pending_amount), 0) AS total
        FROM purchases
        WHERE user_id = ${params.userId}
          AND purchase_date >= ${start}
          AND purchase_date < ${endExclusive}
        GROUP BY date_trunc('day', purchase_date)
        ORDER BY day ASC
      `),
      prisma.$queryRaw<DailyCounterRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', sale_date)::date AS day,
          COUNT(*) AS total
        FROM sales
        WHERE user_id = ${params.userId}
          AND sale_date >= ${start}
          AND sale_date < ${endExclusive}
        GROUP BY date_trunc('day', sale_date)
        ORDER BY day ASC
      `),
      prisma.$queryRaw<DailyCounterRow[]>(Prisma.sql`
        SELECT
          date_trunc('day', purchase_date)::date AS day,
          COUNT(*) AS total
        FROM purchases
        WHERE user_id = ${params.userId}
          AND purchase_date >= ${start}
          AND purchase_date < ${endExclusive}
        GROUP BY date_trunc('day', purchase_date)
        ORDER BY day ASC
      `),
    ]);

  salesPendingRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    current.pendingSales = roundMetric(current.pendingSales + toNumber(row.total));
  });

  purchasePendingRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    current.pendingPurchases = roundMetric(toNumber(row.total));
  });

  salesCountRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    current.saleCount = toCount(row.total);
  });

  purchaseCountRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    current.purchaseCount = toCount(row.total);
  });

  extraEntryRows.forEach((row) => {
    const key = buildDateKey(new Date(row.day));
    const current = dailyMap.get(key);
    if (!current) return;
    const amount = roundMetric(toNumber(row.total));
    switch (row.type) {
      case "INCOME":
        current.extraIncome = amount;
        break;
      case "EXPENSE":
        current.extraExpense = amount;
        break;
      case "LOSS":
        current.extraLoss = amount;
        break;
      case "INVESTMENT":
        current.extraInvestment = amount;
        break;
    }
  });

  const createData = Array.from(dailyMap.values()).map((item) => ({
    userId: params.userId,
    date: item.date,
    bookedSales: item.bookedSales,
    collectedSales: item.collectedSales,
    pendingSales: item.pendingSales,
    saleCount: item.saleCount,
    invoiceBilled: item.invoiceBilled,
    invoiceCount: item.invoiceCount,
    invoiceCollections: item.invoiceCollections,
    invoicePending: item.invoicePending,
    bookedPurchases: item.bookedPurchases,
    cashOutPurchases: item.cashOutPurchases,
    pendingPurchases: item.pendingPurchases,
    purchaseCount: item.purchaseCount,
    expenses: item.expenses,
    extraIncome: item.extraIncome,
    extraExpense: item.extraExpense,
    extraLoss: item.extraLoss,
    extraInvestment: item.extraInvestment,
    customersCreated: item.customersCreated,
    suppliersCreated: item.suppliersCreated,
  }));

  const computedRows: AnalyticsDailyStatsRecord[] = createData.map((item) => ({
    date: item.date,
    bookedSales: item.bookedSales,
    collectedSales: item.collectedSales,
    pendingSales: item.pendingSales,
    saleCount: item.saleCount,
    invoiceBilled: item.invoiceBilled,
    invoiceCount: item.invoiceCount,
    invoiceCollections: item.invoiceCollections,
    invoicePending: item.invoicePending,
    bookedPurchases: item.bookedPurchases,
    cashOutPurchases: item.cashOutPurchases,
    pendingPurchases: item.pendingPurchases,
    purchaseCount: item.purchaseCount,
    expenses: item.expenses,
    extraIncome: item.extraIncome,
    extraExpense: item.extraExpense,
    extraLoss: item.extraLoss,
    extraInvestment: item.extraInvestment,
    customersCreated: item.customersCreated,
    suppliersCreated: item.suppliersCreated,
    updatedAt: new Date(),
  }));

  if (analyticsDailyStatsSupportMode === "fallback") {
    return computedRows;
  }

  try {
    await prisma.$transaction([
      prisma.analyticsDailyStat.deleteMany({
        where: {
          userId: params.userId,
          date: {
            gte: start,
            lt: endExclusive,
          },
        },
      }),
      ...(createData.length > 0
        ? [
            prisma.analyticsDailyStat.createMany({
              data: createData,
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);

    const persistedRows = await prisma.analyticsDailyStat.findMany({
      where: {
        userId: params.userId,
        date: {
          gte: start,
          lt: endExclusive,
        },
      },
      orderBy: { date: "asc" },
    });

    return persistedRows.map(toAnalyticsRecord);
  } catch (error) {
    if (isAnalyticsDailyStatsUniqueConflictError(error)) {
      console.warn("[analytics.daily-stats] rebuild conflict ignored", {
        userId: params.userId,
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
        reason: "duplicate_user_date",
      });
      return computedRows;
    }

    if (!isAnalyticsDailyStatsMissingError(error)) {
      throw error;
    }

    setAnalyticsDailyStatsFallbackMode("table_missing_at_runtime", error);
    return computedRows;
  }
};

export const getAnalyticsDailyStatsRange = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
  refreshIfDirty?: boolean;
}) => {
  const start = startOfDayUtc(params.start);
  const endExclusive = startOfDayUtc(params.endExclusive);

  if (endExclusive.getTime() <= start.getTime()) {
    return [] as AnalyticsDailyStatsRecord[];
  }

  if (analyticsDailyStatsSupportMode !== "fallback") {
    try {
      await ensureAnalyticsDailyStatsTable();
      setAnalyticsDailyStatsPreaggregatedMode();
    } catch (error) {
      setAnalyticsDailyStatsFallbackMode("table_unavailable", error);
    }
  }

  const getFallbackRows = async () => {
    const cacheKey = buildFallbackCacheKey({
      userId: params.userId,
      start,
      endExclusive,
    });
    const cached = await getCache<AnalyticsDailyStatsRecord[]>(cacheKey);
    if (cached) {
      return cached.map(hydrateAnalyticsDailyStatsRecord);
    }

    const rebuiltRows = await rebuildAnalyticsDailyStatsRange({
      userId: params.userId,
      start,
      endExclusive,
    });
    await setCache(
      cacheKey,
      rebuiltRows,
      ANALYTICS_FALLBACK_CACHE_TTL_SECONDS,
    );
    return rebuiltRows;
  };

  if (analyticsDailyStatsSupportMode === "fallback") {
    return getFallbackRows();
  }

  const expectedDays = buildDateSeries(start, endExclusive).length;
  const dirtyMarker = params.refreshIfDirty === false
    ? null
    : await getAnalyticsStatsDirtyMarker(params.userId);

  let rows: AnalyticsDailyStat[];

  try {
    rows = await prisma.analyticsDailyStat.findMany({
      where: {
        userId: params.userId,
        date: {
          gte: start,
          lt: endExclusive,
        },
      },
      orderBy: { date: "asc" },
    });
  } catch (error) {
    if (!isAnalyticsDailyStatsMissingError(error)) {
      throw error;
    }

    setAnalyticsDailyStatsFallbackMode("table_missing_at_runtime", error);
    return getFallbackRows();
  }

  const hasMissingDays = (() => {
    if (rows.length !== expectedDays) {
      return true;
    }

    return rows.some((row, index) => {
      const expectedDate = addDaysUtc(start, index);
      return buildDateKey(row.date) !== buildDateKey(expectedDate);
    });
  })();

  if (
    hasMissingDays ||
    shouldSynchronouslyRefreshDirtyRange({
      userId: params.userId,
      endExclusive,
      dirtyMarker,
    })
  ) {
    markLocalDirtyRefresh(params.userId);
    return rebuildAnalyticsDailyStatsRange({
      userId: params.userId,
      start,
      endExclusive,
    });
  }

  return rows.map(toAnalyticsRecord);
};

export const sumAnalyticsDailyStatsRange = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
  refreshIfDirty?: boolean;
}) => {
  const rows = await getAnalyticsDailyStatsRange(params);

  return rows.reduce<AnalyticsDailyStatsAccumulator>((totals, row) => {
    totals.bookedSales += row.bookedSales;
    totals.collectedSales += row.collectedSales;
    totals.pendingSales += row.pendingSales;
    totals.saleCount += row.saleCount;
    totals.invoiceBilled += row.invoiceBilled;
    totals.invoiceCount += row.invoiceCount;
    totals.invoiceCollections += row.invoiceCollections;
    totals.invoicePending += row.invoicePending;
    totals.bookedPurchases += row.bookedPurchases;
    totals.cashOutPurchases += row.cashOutPurchases;
    totals.pendingPurchases += row.pendingPurchases;
    totals.purchaseCount += row.purchaseCount;
    totals.expenses += row.expenses;
    totals.extraIncome += row.extraIncome;
    totals.extraExpense += row.extraExpense;
    totals.extraLoss += row.extraLoss;
    totals.extraInvestment += row.extraInvestment;
    totals.customersCreated += row.customersCreated;
    totals.suppliersCreated += row.suppliersCreated;
    return totals;
  }, buildAccumulator(startOfDayUtc(params.start)));
};

export const ensureAnalyticsCoverage = async (params: { userId: number }) => {
  const bounds = await fetchAnalyticsSourceBounds(params.userId);
  if (!bounds) {
    return null;
  }

  await getAnalyticsDailyStatsRange({
    userId: params.userId,
    start: bounds.start,
    endExclusive: bounds.endExclusive,
    refreshIfDirty: false,
  });

  return bounds;
};
