import { Prisma } from "@prisma/client";
import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import {
  buildDashboardOverview,
  buildDashboardCardMetrics,
  buildNotifications,
  resolveDashboardFilters,
} from "../services/dashboardAnalyticsService.js";
import { buildDashboardForecast } from "../services/dashboardForecastService.js";
import { buildDashboardQuickInsights } from "../services/dashboardQuickInsights.service.js";
import { onDashboardUpdate } from "../services/dashboardRealtime.js";
import {
  getAnalyticsDailyStatsRange,
  type AnalyticsDailyStatsRecord,
} from "../services/analyticsDailyStats.service.js";
import {
  getCachedMetrics,
  setCachedMetrics,
} from "../services/dashboardMetricsCache.js";
import {
  getCachedDashboardOverview,
  setCachedDashboardOverview,
} from "../services/dashboardOverviewCache.js";
import {
  buildDashboardCachePrefix,
  buildDashboardEndpointRedisKey,
  buildDashboardMetricsRedisKey,
  buildDashboardOverviewRedisKey,
} from "../redis/cacheKeys.js";
import { getCache, setCache } from "../redis/cache.js";

const toNumber = (value: unknown) => Number(value ?? 0);
const resolveRecordedTotal = (totalAmount: unknown, total: unknown) => {
  const preferred = toNumber(totalAmount);
  if (preferred > 0) return preferred;
  return toNumber(total);
};

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const toMonthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const startOfDayUtc = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const buildDateSeries = (start: Date, days: number) => {
  const series: string[] = [];
  for (let i = 0; i < days; i += 1) {
    series.push(toDateKey(addDays(start, i)));
  }
  return series;
};

const dayOfWeekKey = (date: Date) => date.getUTCDay();

const percentChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
};

const formatPaymentMethodDistribution = <
  T extends {
    paymentMethod: string | null;
    _count: { _all: number };
    _sum: { paidAmount: unknown | null };
  },
>(
  rows: T[],
) =>
  rows
    .filter((row) => row.paymentMethod)
    .map((row) => ({
      method: row.paymentMethod as string,
      count: row._count._all,
      amount: toNumber(row._sum.paidAmount),
    }))
    .sort((a, b) => b.amount - a.amount);

type PaymentMethodPeriod = "week" | "month" | "year";
type ProductSalesPeriod = PaymentMethodPeriod | "lifetime";

const resolvePaymentMethodPeriod = (value: unknown): PaymentMethodPeriod => {
  if (typeof value !== "string") return "month";
  const normalized = value.trim().toLowerCase();
  if (normalized === "week") return "week";
  if (normalized === "year") return "year";
  return "month";
};

const resolveProductSalesPeriod = (value: unknown): ProductSalesPeriod => {
  if (typeof value !== "string") return "lifetime";
  const normalized = value.trim().toLowerCase();
  if (normalized === "week") return "week";
  if (normalized === "month") return "month";
  if (normalized === "year") return "year";
  return "lifetime";
};

const getPeriodStart = (period: PaymentMethodPeriod, now: Date) => {
  if (period === "week") {
    return startOfDayUtc(addDays(now, -6));
  }

  if (period === "year") {
    return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  }

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const getPaymentMethodDistribution = async (params: {
  userId: number;
  from?: Date;
}) => {
  const { userId, from } = params;

  const salesWhere = {
    user_id: userId,
    paymentMethod: { not: null },
    paidAmount: { gt: 0 },
    ...(from ? { paymentDate: { gte: from } } : {}),
  };

  const purchasesWhere = {
    user_id: userId,
    paymentMethod: { not: null },
    paidAmount: { gt: 0 },
    ...(from ? { paymentDate: { gte: from } } : {}),
  };

  const [sales, purchases] = await Promise.all([
    prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: salesWhere,
      _count: { _all: true },
      _sum: { paidAmount: true },
    }),
    prisma.purchase.groupBy({
      by: ["paymentMethod"],
      where: purchasesWhere,
      _count: { _all: true },
      _sum: { paidAmount: true },
    }),
  ]);

  return {
    sales: formatPaymentMethodDistribution(sales),
    purchases: formatPaymentMethodDistribution(purchases),
  };
};

type CashInflowMode = "sales" | "payments" | "hybrid";

const resolveCashInflowMode = (value: unknown): CashInflowMode => {
  // Hybrid is the safest default because direct sale receipts live on the
  // sale row while invoice collections are stored in the payments table.
  if (typeof value !== "string") return "hybrid";
  const normalized = value.trim().toLowerCase();
  if (normalized === "payments") return "payments";
  if (normalized === "hybrid") return "hybrid";
  return "sales";
};

const resolveSequentially = async <
  T extends Record<string, () => Promise<unknown>>,
>(
  tasks: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> => {
  const result = {} as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
  for (const key of Object.keys(tasks) as Array<keyof T>) {
    result[key] = (await tasks[key]()) as Awaited<ReturnType<T[typeof key]>>;
  }
  return result;
};

const buildMetricsCacheKey = (userId: number, query: Request["query"]) => {
  const parts = [
    userId,
    query.range ?? "",
    query.startDate ?? "",
    query.endDate ?? "",
    query.granularity ?? "",
  ];
  return parts.join("|");
};

const DASHBOARD_METRICS_CACHE_TTL_SECONDS = Number(
  process.env.DASHBOARD_METRICS_CACHE_TTL_SECONDS ?? 30,
);
const DASHBOARD_ENDPOINT_CACHE_TTL_SECONDS = Number(
  process.env.DASHBOARD_ENDPOINT_CACHE_TTL_SECONDS ?? 30,
);
const DASHBOARD_FORECAST_CACHE_TTL_SECONDS = Number(
  process.env.DASHBOARD_FORECAST_CACHE_TTL_SECONDS ?? 300,
);

const dashboardEndpointCache = new Map<
  string,
  { expiresAt: number; data: unknown }
>();

const buildDashboardEndpointCacheKey = (
  endpoint: string,
  userId: number,
  query: Request["query"] = {},
) => buildDashboardEndpointRedisKey(userId, endpoint, query);

const getDashboardEndpointCache = async <T>(cacheKey: string) => {
  const cached = dashboardEndpointCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  if (cached) {
    dashboardEndpointCache.delete(cacheKey);
  }

  const redisCached = await getCache<T>(cacheKey);
  if (redisCached) {
    dashboardEndpointCache.set(cacheKey, {
      expiresAt: Date.now() + DASHBOARD_ENDPOINT_CACHE_TTL_SECONDS * 1000,
      data: redisCached,
    });
    return redisCached;
  }

  return null;
};

const setDashboardEndpointCache = async (cacheKey: string, data: unknown) => {
  const ownerMatch = cacheKey.match(/:owner:(\d+):dashboard:/);
  const invalidationPrefixes = ownerMatch
    ? [buildDashboardCachePrefix(Number(ownerMatch[1]))]
    : undefined;
  dashboardEndpointCache.set(cacheKey, {
    expiresAt: Date.now() + DASHBOARD_ENDPOINT_CACHE_TTL_SECONDS * 1000,
    data,
  });
  await setCache(cacheKey, data, DASHBOARD_ENDPOINT_CACHE_TTL_SECONDS, {
    invalidationPrefixes,
  });
};

type DashboardCategoryRow = {
  name: string | null;
  value: Prisma.Decimal | number | null;
};

type DashboardCustomerSummaryRow = {
  pendingPayments: Prisma.Decimal | number | null;
  dailyRegisteredCustomers: bigint | number | null;
  dailyWalkInCustomers: bigint | number | null;
  weeklyRegisteredCustomers: bigint | number | null;
  weeklyWalkInCustomers: bigint | number | null;
  monthlyRegisteredCustomers: bigint | number | null;
  monthlyWalkInCustomers: bigint | number | null;
};

type DashboardCustomerMetricRow = {
  customerId: number | null;
  customerName: string | null;
  bookedTotal: Prisma.Decimal | number | null;
  bookedOrders: bigint | number | null;
  paidRevenueTotal: Prisma.Decimal | number | null;
  paidOrderCount: bigint | number | null;
  firstPaidSaleDate: Date | null;
  lastPaidSaleDate: Date | null;
  paidOrdersLast30: bigint | number | null;
  paidOrdersPrev30: bigint | number | null;
};

type DashboardSupplierSummaryRow = {
  recentPurchases: bigint | number | null;
  outstandingPayables: Prisma.Decimal | number | null;
};

type DashboardSupplierMetricRow = {
  supplierId: number | null;
  supplierName: string | null;
  totalPurchaseAmount: Prisma.Decimal | number | null;
  totalOrders: bigint | number | null;
  firstPurchaseDate: Date | null;
  lastPurchaseDate: Date | null;
};

const toCount = (value: bigint | number | null | undefined) =>
  Number(value ?? 0);

class DashboardController {
  static async stream(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    res.write(
      `event: connected\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`,
    );

    const unsubscribe = onDashboardUpdate((payload) => {
      if (payload.userId !== userId) return;
      res.write(
        `event: dashboard:update\ndata: ${JSON.stringify({
          at: payload.at,
          source: payload.source ?? "unknown",
        })}\n\n`,
      );
    });

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${Date.now()}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  }
  static async overview(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }
      const cacheKey = `${userId}|${JSON.stringify(req.query ?? {})}`;
      const redisCacheKey = buildDashboardOverviewRedisKey(userId, req.query);
      const cached = getCachedDashboardOverview(cacheKey);
      if (cached) {
        return sendResponse(res, 200, { data: cached });
      }
      const redisCached = await getCache(redisCacheKey);
      if (redisCached) {
        setCachedDashboardOverview(cacheKey, redisCached);
        return sendResponse(res, 200, { data: redisCached });
      }
      const data = await buildDashboardOverview({
        userId,
        filters: {
          range: req.query.range,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          granularity: req.query.granularity,
        },
      });

      setCachedDashboardOverview(cacheKey, data);
      void setCache(redisCacheKey, data, 60, {
        invalidationPrefixes: [buildDashboardCachePrefix(userId)],
      });

      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Dashboard overview error:", error);
      return sendResponse(res, 500, {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async metrics(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      const cacheKey = buildMetricsCacheKey(userId, req.query);
      const redisCacheKey = buildDashboardMetricsRedisKey(userId, req.query);
      const cached = getCachedMetrics(cacheKey);
      if (cached) {
        return sendResponse(res, 200, { data: cached });
      }

      const redisCached = await getCache(redisCacheKey);
      if (redisCached) {
        setCachedMetrics(cacheKey, redisCached);
        return sendResponse(res, 200, { data: redisCached });
      }

      const data = await buildDashboardCardMetrics({
        userId,
        filters: {
          range: req.query.range,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          granularity: req.query.granularity,
        },
      });

      setCachedMetrics(cacheKey, data);
      void setCache(redisCacheKey, data, DASHBOARD_METRICS_CACHE_TTL_SECONDS, {
        invalidationPrefixes: [buildDashboardCachePrefix(userId)],
      });

      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
      return sendResponse(res, 500, {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async quickInsights(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      const language =
        typeof req.query.language === "string" ? req.query.language : "en";
      const cacheQuery = { ...req.query, mode: language };
      const cacheKey = buildDashboardEndpointCacheKey(
        "quick-insights",
        userId,
        cacheQuery,
      );
      const cached = await getDashboardEndpointCache(cacheKey);
      if (cached) {
        return sendResponse(res, 200, { data: cached });
      }

      const data = await buildDashboardQuickInsights({
        userId,
        language,
        filters: {
          range: req.query.range,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          granularity: req.query.granularity,
        },
      });

      void setDashboardEndpointCache(cacheKey, data);
      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Dashboard quick insights error:", error);
      return sendResponse(res, 500, {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async sales(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
    const cacheKey = buildDashboardEndpointCacheKey("sales", userId, req.query);
    const cached = await getDashboardEndpointCache<{
      last7Days: Array<{ date: string; sales: number; purchases: number }>;
      last30Days: Array<{ date: string; sales: number; purchases: number }>;
      monthly: Array<{ month: string; sales: number; purchases: number }>;
      categories: Array<{ name: string; value: number }>;
    }>(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const resolved = resolveDashboardFilters({
      range: req.query.range,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      granularity: req.query.granularity,
    });
    const anchor = addDays(resolved.endExclusive, -1);
    const now = anchor;
    const start30 = startOfDayUtc(addDays(anchor, -29));
    const start7 = startOfDayUtc(addDays(anchor, -6));
    const start6Months = new Date(
      Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 5, 1),
    );
    const endDate = resolved.endExclusive;

    const [analyticsRows, categoryRows]: [
      AnalyticsDailyStatsRecord[],
      DashboardCategoryRow[],
    ] = await Promise.all([
      getAnalyticsDailyStatsRange({
        userId,
        start: start6Months,
        endExclusive: endDate,
      }),
      prisma.$queryRaw<DashboardCategoryRow[]>(Prisma.sql`
        SELECT
          COALESCE(cat."name", 'Uncategorized') AS name,
          COALESCE(SUM(si."line_total"), 0) AS value
        FROM "sale_items" AS si
        INNER JOIN "sales" AS s
          ON s."id" = si."sale_id"
        LEFT JOIN "products" AS p
          ON p."id" = si."product_id"
        LEFT JOIN "categories" AS cat
          ON cat."id" = p."category_id"
        WHERE s."user_id" = ${userId}
          AND s."sale_date" >= ${start30}
          AND s."sale_date" < ${endDate}
        GROUP BY COALESCE(cat."name", 'Uncategorized')
        ORDER BY value DESC
        LIMIT 7
      `),
    ]);

    const dailySalesTotals = new Map(
      analyticsRows.map((row) => [toDateKey(row.date), row.bookedSales]),
    );
    const dailyPurchaseTotals = new Map(
      analyticsRows.map((row) => [toDateKey(row.date), row.bookedPurchases]),
    );

    const last30Days = buildDateSeries(start30, 30).map((key) => ({
      date: key,
      sales: dailySalesTotals.get(key) ?? 0,
      purchases: dailyPurchaseTotals.get(key) ?? 0,
    }));

    const last7Days = buildDateSeries(start7, 7).map((key) => ({
      date: key,
      sales: dailySalesTotals.get(key) ?? 0,
      purchases: dailyPurchaseTotals.get(key) ?? 0,
    }));

    const monthlyMap = new Map<
      string,
      { sales: number; purchases: number; labelDate: Date }
    >();
    for (let i = 0; i < 6; i += 1) {
      const date = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1),
      );
      monthlyMap.set(toMonthKey(date), {
        sales: 0,
        purchases: 0,
        labelDate: date,
      });
    }

    analyticsRows.forEach((row) => {
      const key = toMonthKey(row.date);
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.sales += row.bookedSales;
        entry.purchases += row.bookedPurchases;
      }
    });

    const monthly = Array.from(monthlyMap.values()).map((entry) => ({
      month: toMonthLabel(entry.labelDate),
      sales: entry.sales,
      purchases: entry.purchases,
    }));

    const categories = categoryRows.map((row) => ({
      name: row.name?.trim() || "Uncategorized",
      value: toNumber(row.value),
    }));

    const data = {
      last7Days,
      last30Days,
      monthly,
      categories,
    };

    await setDashboardEndpointCache(cacheKey, data);

    return sendResponse(res, 200, { data });
    } catch (error) {
      const statusCode =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
          ? 409
          : error instanceof Error &&
              "statusCode" in error &&
              typeof error.statusCode === "number"
            ? error.statusCode
            : error instanceof Error &&
                "status" in error &&
                typeof error.status === "number"
              ? error.status
              : null;

      if (statusCode === 409) {
        console.warn("[sales.dashboard.conflict]", {
          userId,
          ownerUserId: req.user?.ownerUserId ?? null,
          businessId: req.user?.businessId ?? null,
          range: req.query.range ?? null,
          granularity: req.query.granularity ?? null,
          reason:
            error instanceof Prisma.PrismaClientKnownRequestError
              ? error.code
              : error instanceof Error
                ? error.message
                : "unknown_conflict",
        });
      }

      throw error;
    }
  }

  static async paymentMethods(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      const period = resolvePaymentMethodPeriod(req.query.period);
      const now = new Date();
      const from = getPeriodStart(period, now);

      const distribution = await getPaymentMethodDistribution({ userId, from });

      return sendResponse(res, 200, {
        data: {
          period,
          ...distribution,
        },
      });
    } catch (error) {
      console.error("Dashboard payment methods error:", error);
      return sendResponse(res, 500, {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async inventory(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));

    const { totalProducts, products, saleItems } = await resolveSequentially({
      totalProducts: () => prisma.product.count({ where: { user_id: userId } }),
      products: () =>
        prisma.product.findMany({
          where: { user_id: userId },
          select: {
            name: true,
            stock_on_hand: true,
            reorder_level: true,
            cost: true,
            price: true,
          },
        }),
      saleItems: () =>
        prisma.saleItem.findMany({
          where: { sale: { user_id: userId, sale_date: { gte: start30 } } },
          select: { quantity: true, name: true },
        }),
    });

    const inventoryValue = products.reduce((sum, product) => {
      const unit = toNumber(product.cost ?? product.price);
      return sum + unit * product.stock_on_hand;
    }, 0);

    const lowStockProducts = products.filter(
      (product) => product.stock_on_hand < product.reorder_level,
    );
    const outOfStock = products.filter(
      (product) => product.stock_on_hand === 0,
    ).length;
    const lowStock = lowStockProducts.length;

    const salesMap = new Map<string, number>();
    saleItems.forEach((item) => {
      salesMap.set(item.name, (salesMap.get(item.name) ?? 0) + item.quantity);
    });

    const topSellingEntry = Array.from(salesMap.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    return sendResponse(res, 200, {
      data: {
        totalProducts,
        lowStock,
        outOfStock,
        inventoryValue,
        topSelling: topSellingEntry
          ? { name: topSellingEntry[0], units: topSellingEntry[1] }
          : null,
        lowStockItems: lowStockProducts
          .sort((a, b) => a.stock_on_hand - b.stock_on_hand)
          .slice(0, 6)
          .map((item) => ({
            name: item.name,
            stock: item.stock_on_hand,
            reorder: item.reorder_level,
          })),
      },
    });
  }

  static async transactions(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildDashboardEndpointCacheKey(
      "transactions",
      userId,
      req.query,
    );
    const cached = await getDashboardEndpointCache<{
      transactions: Array<{
        date: string;
        invoiceNumber: string;
        customer: string;
        amount: number;
        paymentStatus: "PAID" | "PARTIAL" | "PENDING";
      }>;
    }>(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const resolved = resolveDashboardFilters({
      range: req.query.range,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      granularity: req.query.granularity,
    });

    const sales = await prisma.sale.findMany({
      where: {
        user_id: userId,
        sale_date: { gte: resolved.start, lt: resolved.endExclusive },
      },
      select: {
        id: true,
        sale_date: true,
        total: true,
        totalAmount: true,
        paymentStatus: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { sale_date: "desc" },
      take: 10,
    });

    const transactions = sales.map((sale) => ({
      date: sale.sale_date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      invoiceNumber: `SI-${sale.id}`,
      customer: sale.customer?.name ?? "Walk-in",
      amount: resolveRecordedTotal(sale.totalAmount, sale.total),
      paymentStatus:
        sale.paymentStatus === "PAID"
          ? "PAID"
          : sale.paymentStatus === "PARTIALLY_PAID"
            ? "PARTIAL"
            : "PENDING",
    }));

    const data = { transactions };
    await setDashboardEndpointCache(cacheKey, data);

    return sendResponse(res, 200, { data });
  }

  static async customersOptimized(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildDashboardEndpointCacheKey("customers", userId);
    const cached = await getDashboardEndpointCache<{
      totalRegisteredCustomers: number;
      pendingPayments: number;
      customerVisits: {
        daily: {
          registeredCustomers: number;
          walkInCustomers: number;
          totalCustomers: number;
        };
        weekly: {
          registeredCustomers: number;
          walkInCustomers: number;
          totalCustomers: number;
        };
        monthly: {
          registeredCustomers: number;
          walkInCustomers: number;
          totalCustomers: number;
        };
      };
      topCustomers: Array<{
        name: string;
        totalPurchaseAmount: number;
        numberOfOrders: number;
      }>;
      clvAnalytics: {
        premiumCustomers: Array<{
          customerId: number | null;
          customerName: string;
          lifetimeValue: number;
          predicatedFutureValue: number;
          totalOrders: number;
          compositeScore: number;
          segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
        }>;
        regularCustomers: Array<{
          customerId: number | null;
          customerName: string;
          lifetimeValue: number;
          predicatedFutureValue: number;
          totalOrders: number;
          compositeScore: number;
          segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
        }>;
        newLowCustomers: Array<{
          customerId: number | null;
          customerName: string;
          lifetimeValue: number;
          predicatedFutureValue: number;
          totalOrders: number;
          compositeScore: number;
          segment: "PREMIUM" | "REGULAR" | "NEW_LOW";
        }>;
        premiumCount: number;
        regularCount: number;
        newLowCount: number;
      };
      churnAnalytics: {
        highRiskCount: number;
        mediumRiskCount: number;
        lowRiskCount: number;
        topAtRiskCustomers: Array<{
          customerId: number;
          customerName: string;
          lastPurchaseDate: string;
          daysSinceLastPurchase: number;
          churnProbability: number;
          riskLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK";
        }>;
      };
    }>(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const now = new Date();
    const dayStart = startOfDayUtc(now);
    const weekStart = startOfDayUtc(addDays(now, -6));
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const start30DaysAgo = startOfDayUtc(addDays(now, -30));
    const start60DaysAgo = startOfDayUtc(addDays(now, -60));

    const [totalRegisteredCustomers, summaryRows, customerMetricRows] =
      await Promise.all([
        prisma.customer.count({
          where: { user_id: userId },
        }),
        prisma.$queryRaw<DashboardCustomerSummaryRow[]>(Prisma.sql`
          SELECT
            COALESCE(SUM(
              CASE
                WHEN "payment_status" IN ('PARTIALLY_PAID'::"PaymentStatus", 'UNPAID'::"PaymentStatus")
                  THEN "pending_amount"
                ELSE 0
              END
            ), 0) AS "pendingPayments",
            COUNT(DISTINCT CASE WHEN "customer_id" IS NOT NULL AND "sale_date" >= ${dayStart} THEN "customer_id" END) AS "dailyRegisteredCustomers",
            COUNT(*) FILTER (WHERE "customer_id" IS NULL AND "sale_date" >= ${dayStart}) AS "dailyWalkInCustomers",
            COUNT(DISTINCT CASE WHEN "customer_id" IS NOT NULL AND "sale_date" >= ${weekStart} THEN "customer_id" END) AS "weeklyRegisteredCustomers",
            COUNT(*) FILTER (WHERE "customer_id" IS NULL AND "sale_date" >= ${weekStart}) AS "weeklyWalkInCustomers",
            COUNT(DISTINCT CASE WHEN "customer_id" IS NOT NULL AND "sale_date" >= ${monthStart} THEN "customer_id" END) AS "monthlyRegisteredCustomers",
            COUNT(*) FILTER (WHERE "customer_id" IS NULL AND "sale_date" >= ${monthStart}) AS "monthlyWalkInCustomers"
          FROM "sales"
          WHERE "user_id" = ${userId}
        `),
        prisma.$queryRaw<DashboardCustomerMetricRow[]>(Prisma.sql`
          SELECT
            s."customer_id" AS "customerId",
            c."name" AS "customerName",
            COALESCE(SUM(COALESCE(s."total_amount", s."total")), 0) AS "bookedTotal",
            COUNT(*) AS "bookedOrders",
            COALESCE(SUM(
              CASE
                WHEN s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
                  THEN COALESCE(s."total_amount", s."total")
                ELSE 0
              END
            ), 0) AS "paidRevenueTotal",
            COUNT(*) FILTER (
              WHERE s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
            ) AS "paidOrderCount",
            MIN(s."sale_date") FILTER (
              WHERE s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
            ) AS "firstPaidSaleDate",
            MAX(s."sale_date") FILTER (
              WHERE s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
            ) AS "lastPaidSaleDate",
            COUNT(*) FILTER (
              WHERE s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
                AND s."sale_date" >= ${start30DaysAgo}
            ) AS "paidOrdersLast30",
            COUNT(*) FILTER (
              WHERE s."payment_status" IN ('PAID'::"PaymentStatus", 'PARTIALLY_PAID'::"PaymentStatus")
                AND s."sale_date" >= ${start60DaysAgo}
                AND s."sale_date" < ${start30DaysAgo}
            ) AS "paidOrdersPrev30"
          FROM "sales" AS s
          LEFT JOIN "customers" AS c
            ON c."id" = s."customer_id"
          WHERE s."user_id" = ${userId}
            AND s."customer_id" IS NOT NULL
          GROUP BY s."customer_id", c."name"
        `),
      ]);

    const summary = summaryRows[0];
    const customerMetrics = customerMetricRows.map((row) => ({
      customerId: row.customerId,
      customerName: row.customerName?.trim() || "Customer",
      bookedTotal: toNumber(row.bookedTotal),
      bookedOrders: toCount(row.bookedOrders),
      paidRevenueTotal: toNumber(row.paidRevenueTotal),
      paidOrderCount: toCount(row.paidOrderCount),
      firstPaidSaleDate: row.firstPaidSaleDate,
      lastPaidSaleDate: row.lastPaidSaleDate,
      paidOrdersLast30: toCount(row.paidOrdersLast30),
      paidOrdersPrev30: toCount(row.paidOrdersPrev30),
    }));

    const clvMetrics = customerMetrics
      .filter((record) => record.paidOrderCount > 0 && record.lastPaidSaleDate)
      .map((record) => {
        const firstPurchase = record.firstPaidSaleDate ?? new Date();
        const lastPurchase = record.lastPaidSaleDate ?? new Date();
        const lifetimeDays = Math.max(
          1,
          Math.floor(
            (lastPurchase.getTime() - firstPurchase.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const avgOrderValue =
          record.paidOrderCount > 0
            ? record.paidRevenueTotal / record.paidOrderCount
            : 0;
        const purchaseFrequency =
          record.paidOrderCount / Math.max(1, lifetimeDays);
        const predicatedFutureValue = Math.round(
          avgOrderValue * purchaseFrequency * 180,
        );

        return {
          customerId: record.customerId,
          totalOrders: record.paidOrderCount,
          totalRevenue: record.paidRevenueTotal,
          avgOrderValue: Math.round(avgOrderValue),
          purchaseFrequency: Math.round(purchaseFrequency * 1000) / 1000,
          lastPurchaseDate: toDateKey(lastPurchase),
          lifetimeDays,
          lifeTimeValue: record.paidRevenueTotal,
          predicatedFutureValue,
        };
      })
      .sort((a, b) => b.lifeTimeValue - a.lifeTimeValue);

    const maxLtv = Math.max(1, ...clvMetrics.map((m) => m.lifeTimeValue), 1);
    const maxFreq = Math.max(
      0.001,
      ...clvMetrics.map((m) => m.purchaseFrequency),
      0.001,
    );
    const maxAov = Math.max(1, ...clvMetrics.map((m) => m.avgOrderValue), 1);

    const clvWithScores = clvMetrics.map((metric) => {
      const daysSinceLastPurchase = Math.max(
        1,
        (now.getTime() - new Date(metric.lastPurchaseDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      const normLtv = metric.lifeTimeValue / maxLtv;
      const normFreq = metric.purchaseFrequency / maxFreq;
      const normAov = metric.avgOrderValue / maxAov;
      const normRecency = Math.max(0, 1 - daysSinceLastPurchase / 365);
      const compositeScore =
        normLtv * 0.4 + normFreq * 0.25 + normAov * 0.2 + normRecency * 0.15;

      return { ...metric, compositeScore };
    });

    const sortedScores = [...clvWithScores].sort(
      (a, b) => b.compositeScore - a.compositeScore,
    );
    const premiumThresholdIndex = Math.floor(sortedScores.length * 0.3);
    const regularThresholdIndex = Math.floor(sortedScores.length * 0.7);
    const premiumScoreThreshold =
      sortedScores[Math.max(0, premiumThresholdIndex - 1)]?.compositeScore ?? 0;
    const regularScoreThreshold =
      sortedScores[Math.max(0, regularThresholdIndex - 1)]?.compositeScore ?? 0;

    const clvWithSegments = clvWithScores.map((metric) => {
      let segment: "PREMIUM" | "REGULAR" | "NEW_LOW" = "NEW_LOW";

      if (
        metric.compositeScore >= premiumScoreThreshold &&
        metric.compositeScore > 0
      ) {
        segment = "PREMIUM";
      } else if (
        metric.compositeScore >= regularScoreThreshold &&
        metric.compositeScore > 0
      ) {
        segment = "REGULAR";
      }

      return { ...metric, segment };
    });

    const customerNameMap = new Map(
      customerMetrics
        .filter((item) => item.customerId !== null)
        .map((item) => [item.customerId as number, item.customerName]),
    );

    const topCustomers = [...customerMetrics]
      .sort((left, right) => right.bookedTotal - left.bookedTotal)
      .slice(0, 5)
      .map((item) => ({
        name: item.customerName,
        totalPurchaseAmount: item.bookedTotal,
        numberOfOrders: item.bookedOrders,
      }));

    const premiumCustomers = clvWithSegments
      .filter(
        (metric): metric is typeof metric & { customerId: number } =>
          metric.customerId !== null,
      )
      .filter((metric) => metric.segment === "PREMIUM")
      .slice(0, 5)
      .map((metric) => ({
        customerId: metric.customerId,
        customerName: customerNameMap.get(metric.customerId) ?? "Customer",
        lifetimeValue: metric.lifeTimeValue,
        predicatedFutureValue: metric.predicatedFutureValue,
        totalOrders: metric.totalOrders,
        compositeScore: metric.compositeScore,
        segment: metric.segment,
      }));

    const regularCustomers = clvWithSegments
      .filter(
        (metric): metric is typeof metric & { customerId: number } =>
          metric.customerId !== null,
      )
      .filter((metric) => metric.segment === "REGULAR")
      .slice(0, 5)
      .map((metric) => ({
        customerId: metric.customerId,
        customerName: customerNameMap.get(metric.customerId) ?? "Customer",
        lifetimeValue: metric.lifeTimeValue,
        predicatedFutureValue: metric.predicatedFutureValue,
        totalOrders: metric.totalOrders,
        compositeScore: metric.compositeScore,
        segment: metric.segment,
      }));

    const newLowCustomers = clvWithSegments
      .filter(
        (metric): metric is typeof metric & { customerId: number } =>
          metric.customerId !== null,
      )
      .filter((metric) => metric.segment === "NEW_LOW")
      .slice(0, 5)
      .map((metric) => ({
        customerId: metric.customerId,
        customerName: customerNameMap.get(metric.customerId) ?? "Customer",
        lifetimeValue: metric.lifeTimeValue,
        predicatedFutureValue: metric.predicatedFutureValue,
        totalOrders: metric.totalOrders,
        compositeScore: metric.compositeScore,
        segment: metric.segment,
      }));

    const churnAnalyticsValues = clvWithSegments
      .filter(
        (metric): metric is typeof metric & { customerId: number } =>
          metric.customerId !== null,
      )
      .map((metric) => {
        const source = customerMetrics.find(
          (item) => item.customerId === metric.customerId,
        );
        const last30 = source?.paidOrdersLast30 ?? 0;
        const prev30 = source?.paidOrdersPrev30 ?? 0;
        const daysSinceLastPurchase = Math.max(
          1,
          Math.floor(
            (now.getTime() - new Date(metric.lastPurchaseDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        let orderTrendDrop = 0;
        if (prev30 > 0) {
          orderTrendDrop = Math.max(0, (prev30 - last30) / prev30);
        } else if (
          last30 === 0 &&
          metric.totalOrders > 0 &&
          daysSinceLastPurchase > 30
        ) {
          orderTrendDrop = 1;
        }

        const normDaysSinceLastPurchase = Math.min(
          1,
          daysSinceLastPurchase / 365,
        );
        const normPurchaseFreq = Math.min(1, metric.purchaseFrequency);

        let churnProbability =
          normDaysSinceLastPurchase * 0.4 +
          (1 - normPurchaseFreq) * 0.3 +
          orderTrendDrop * 0.3;
        churnProbability = Math.max(0, Math.min(1, churnProbability));

        let riskLevel: "HIGH_RISK" | "MEDIUM_RISK" | "LOW_RISK" = "LOW_RISK";
        if (churnProbability >= 0.7) {
          riskLevel = "HIGH_RISK";
        } else if (churnProbability >= 0.4) {
          riskLevel = "MEDIUM_RISK";
        }

        return {
          customerId: metric.customerId,
          customerName: customerNameMap.get(metric.customerId) ?? "Customer",
          lastPurchaseDate: metric.lastPurchaseDate,
          daysSinceLastPurchase,
          churnProbability,
          riskLevel,
        };
      });

    const toVisitBreakdown = (
      registeredCustomers: number,
      walkInCustomers: number,
    ) => ({
      registeredCustomers,
      walkInCustomers,
      totalCustomers: registeredCustomers + walkInCustomers,
    });

    const data = {
      totalRegisteredCustomers,
      pendingPayments: toNumber(summary?.pendingPayments),
      customerVisits: {
        daily: toVisitBreakdown(
          toCount(summary?.dailyRegisteredCustomers),
          toCount(summary?.dailyWalkInCustomers),
        ),
        weekly: toVisitBreakdown(
          toCount(summary?.weeklyRegisteredCustomers),
          toCount(summary?.weeklyWalkInCustomers),
        ),
        monthly: toVisitBreakdown(
          toCount(summary?.monthlyRegisteredCustomers),
          toCount(summary?.monthlyWalkInCustomers),
        ),
      },
      topCustomers,
      clvAnalytics: {
        premiumCustomers,
        regularCustomers,
        newLowCustomers,
        premiumCount: clvWithSegments.filter((metric) => metric.segment === "PREMIUM")
          .length,
        regularCount: clvWithSegments.filter((metric) => metric.segment === "REGULAR")
          .length,
        newLowCount: clvWithSegments.filter((metric) => metric.segment === "NEW_LOW")
          .length,
      },
      churnAnalytics: {
        highRiskCount: churnAnalyticsValues.filter(
          (metric) => metric.riskLevel === "HIGH_RISK",
        ).length,
        mediumRiskCount: churnAnalyticsValues.filter(
          (metric) => metric.riskLevel === "MEDIUM_RISK",
        ).length,
        lowRiskCount: churnAnalyticsValues.filter(
          (metric) => metric.riskLevel === "LOW_RISK",
        ).length,
        topAtRiskCustomers: [...churnAnalyticsValues]
          .sort((left, right) => right.churnProbability - left.churnProbability)
          .slice(0, 5),
      },
    };

    await setDashboardEndpointCache(cacheKey, data);

    return sendResponse(res, 200, { data });
  }

  static async suppliersOptimized(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildDashboardEndpointCacheKey("suppliers", userId);
    const cached = await getDashboardEndpointCache<{
      total: number;
      recentPurchases: number;
      outstandingPayables: number;
      topSuppliers: Array<{
        name: string;
        totalPurchaseAmount: number;
        numberOfOrders: number;
      }>;
      supplierAnalytics: {
        highValueCount: number;
        lowValueCount: number;
        highValueSuppliers: Array<{
          supplierId: number | null;
          supplierName: string;
          lifetimeValue: number;
          predictedFutureValue: number;
          totalOrders: number;
          segment: "HIGH_VALUE" | "LOW_VALUE";
        }>;
        lowValueSuppliers: Array<{
          supplierId: number | null;
          supplierName: string;
          lifetimeValue: number;
          predictedFutureValue: number;
          totalOrders: number;
          segment: "HIGH_VALUE" | "LOW_VALUE";
        }>;
      };
    }>(cacheKey);
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));

    const [total, summaryRows, supplierMetricRows] = await Promise.all([
      prisma.supplier.count({ where: { user_id: userId } }),
      prisma.$queryRaw<DashboardSupplierSummaryRow[]>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (WHERE "purchase_date" >= ${start30}) AS "recentPurchases",
          COALESCE(SUM(
            CASE
              WHEN "purchase_date" >= ${start30}
                THEN "pending_amount"
              ELSE 0
            END
          ), 0) AS "outstandingPayables"
        FROM "purchases"
        WHERE "user_id" = ${userId}
      `),
      prisma.$queryRaw<DashboardSupplierMetricRow[]>(Prisma.sql`
        SELECT
          p."supplier_id" AS "supplierId",
          s."name" AS "supplierName",
          COALESCE(SUM(COALESCE(p."total_amount", p."total")), 0) AS "totalPurchaseAmount",
          COUNT(*) AS "totalOrders",
          MIN(p."purchase_date") AS "firstPurchaseDate",
          MAX(p."purchase_date") AS "lastPurchaseDate"
        FROM "purchases" AS p
        LEFT JOIN "suppliers" AS s
          ON s."id" = p."supplier_id"
        WHERE p."user_id" = ${userId}
          AND p."supplier_id" IS NOT NULL
        GROUP BY p."supplier_id", s."name"
      `),
    ]);

    const summary = summaryRows[0];
    const supplierMetrics = supplierMetricRows.map((row) => ({
      supplierId: row.supplierId,
      supplierName: row.supplierName?.trim() || "Supplier",
      totalPurchaseAmount: toNumber(row.totalPurchaseAmount),
      totalOrders: toCount(row.totalOrders),
      firstPurchaseDate: row.firstPurchaseDate ?? new Date(),
      lastPurchaseDate: row.lastPurchaseDate ?? new Date(),
    }));

    const supplierLtvMetrics = supplierMetrics
      .map((record) => {
        const lifetimeDays = Math.max(
          1,
          Math.floor(
            (record.lastPurchaseDate.getTime() -
              record.firstPurchaseDate.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const avgOrderValue =
          record.totalOrders > 0
            ? record.totalPurchaseAmount / record.totalOrders
            : 0;
        const purchaseFrequency =
          record.totalOrders / Math.max(1, lifetimeDays);

        return {
          supplierId: record.supplierId,
          totalOrders: record.totalOrders,
          supplierLifetimeValue: record.totalPurchaseAmount,
          avgOrderValue: Math.round(avgOrderValue),
          purchaseFrequency: Math.round(purchaseFrequency * 1000) / 1000,
          lastPurchaseDate: toDateKey(record.lastPurchaseDate),
          lifetimeDays,
          predictedFutureValue: Math.round(
            avgOrderValue * purchaseFrequency * 180,
          ),
        };
      })
      .sort((left, right) => right.supplierLifetimeValue - left.supplierLifetimeValue);

    const highValueCount = Math.max(
      1,
      Math.ceil(supplierLtvMetrics.length * 0.35),
    );

    const supplierWithSegments = supplierLtvMetrics.map((metric, index) => ({
      ...metric,
      segment:
        index < highValueCount
          ? ("HIGH_VALUE" as const)
          : ("LOW_VALUE" as const),
    }));

    const supplierNameMap = new Map(
      supplierMetrics
        .filter((item) => item.supplierId !== null)
        .map((item) => [item.supplierId as number, item.supplierName]),
    );

    const highValueSuppliers = supplierWithSegments
      .filter(
        (metric): metric is typeof metric & { supplierId: number } =>
          metric.supplierId !== null,
      )
      .filter((metric) => metric.segment === "HIGH_VALUE")
      .slice(0, 5)
      .map((metric) => ({
        supplierId: metric.supplierId,
        supplierName: supplierNameMap.get(metric.supplierId) ?? "Supplier",
        lifetimeValue: metric.supplierLifetimeValue,
        predictedFutureValue: metric.predictedFutureValue,
        totalOrders: metric.totalOrders,
        segment: metric.segment,
      }));

    const lowValueSuppliers = supplierWithSegments
      .filter(
        (metric): metric is typeof metric & { supplierId: number } =>
          metric.supplierId !== null,
      )
      .filter((metric) => metric.segment === "LOW_VALUE")
      .slice(0, 5)
      .map((metric) => ({
        supplierId: metric.supplierId,
        supplierName: supplierNameMap.get(metric.supplierId) ?? "Supplier",
        lifetimeValue: metric.supplierLifetimeValue,
        predictedFutureValue: metric.predictedFutureValue,
        totalOrders: metric.totalOrders,
        segment: metric.segment,
      }));

    const data = {
      total,
      recentPurchases: toCount(summary?.recentPurchases),
      outstandingPayables: toNumber(summary?.outstandingPayables),
      topSuppliers: [...supplierMetrics]
        .sort((left, right) => right.totalPurchaseAmount - left.totalPurchaseAmount)
        .slice(0, 5)
        .map((metric) => ({
          name: metric.supplierName,
          totalPurchaseAmount: metric.totalPurchaseAmount,
          numberOfOrders: metric.totalOrders,
        })),
      supplierAnalytics: {
        highValueCount: supplierWithSegments.filter(
          (metric) => metric.segment === "HIGH_VALUE",
        ).length,
        lowValueCount: supplierWithSegments.filter(
          (metric) => metric.segment === "LOW_VALUE",
        ).length,
        highValueSuppliers,
        lowValueSuppliers,
      },
    };

    await setDashboardEndpointCache(cacheKey, data);

    return sendResponse(res, 200, { data });
  }

  static async customers(req: Request, res: Response) {
    return DashboardController.customersOptimized(req, res);
  }

  static async suppliers(req: Request, res: Response) {
    return DashboardController.suppliersOptimized(req, res);
  }

  static async cashflow(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const daysInMonth = now.getUTCDate();
    const inflowMode = resolveCashInflowMode(
      req.query.inflowMode ?? process.env.DASHBOARD_CASHFLOW_INFLOW_MODE,
    );

    const analyticsRows: AnalyticsDailyStatsRecord[] = await getAnalyticsDailyStatsRange({
      userId,
      start: startOfMonth,
      endExclusive: addDays(startOfMonth, daysInMonth),
    });

    const inflowMap = new Map<string, number>();
    const outflowMap = new Map<string, number>();
    analyticsRows.forEach((row) => {
      const key = toDateKey(row.date);
      const inflow =
        inflowMode === "sales"
          ? row.collectedSales
          : inflowMode === "payments"
            ? row.invoiceCollections
            : row.collectedSales + row.invoiceCollections;
      inflowMap.set(key, inflow);
      outflowMap.set(key, row.cashOutPurchases + row.expenses);
    });

    const series = buildDateSeries(startOfMonth, daysInMonth).map((key) => ({
      date: key,
      inflow: inflowMap.get(key) ?? 0,
      outflow: outflowMap.get(key) ?? 0,
    }));

    const inflow = series.reduce((sum, item) => sum + item.inflow, 0);
    const outflow = series.reduce((sum, item) => sum + item.outflow, 0);

    return sendResponse(res, 200, {
      data: {
        inflowSourceMode: inflowMode,
        inflow,
        outflow,
        netCashFlow: inflow - outflow,
        series,
      },
    });
  }

  static async productSales(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return sendResponse(res, 401, { message: "Unauthorized" });
      }

      const period = resolveProductSalesPeriod(req.query.period);

      const now = new Date();
      let startDate: Date | undefined;

      if (period === "week") {
        startDate = startOfDayUtc(addDays(now, -6));
      } else if (period === "month") {
        startDate = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );
      } else if (period === "year") {
        startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      }

      const whereClause: {
        sale: { user_id: number; sale_date?: { gte: Date } };
      } = {
        sale: { user_id: userId },
      };
      if (startDate) {
        whereClause.sale.sale_date = { gte: startDate };
      }

      const saleItems = await prisma.saleItem.findMany({
        where: whereClause,
        select: {
          name: true,
          quantity: true,
          line_total: true,
        },
      });

      const productMap = new Map<
        string,
        { quantity: number; revenue: number }
      >();

      for (const item of saleItems) {
        const existing = productMap.get(item.name) ?? {
          quantity: 0,
          revenue: 0,
        };
        productMap.set(item.name, {
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue + toNumber(item.line_total),
        });
      }

      const products = Array.from(productMap.entries())
        .map(([name, stats]) => ({
          name,
          quantity: stats.quantity,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 15);

      return sendResponse(res, 200, {
        data: {
          period,
          products,
        },
      });
    } catch (error) {
      console.error("Dashboard product sales error:", error);
      return sendResponse(res, 500, {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  static async forecast(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cacheKey = buildDashboardEndpointRedisKey(userId, "forecast", req.query);
    const cached = await getCache<Awaited<ReturnType<typeof buildDashboardForecast>>>(
      cacheKey,
    );
    if (cached) {
      return sendResponse(res, 200, { data: cached });
    }

    const data = await buildDashboardForecast({ userId });
    void setCache(cacheKey, data, DASHBOARD_FORECAST_CACHE_TTL_SECONDS, {
      invalidationPrefixes: [buildDashboardCachePrefix(userId)],
    });

    return sendResponse(res, 200, {
      data,
    });
  }
}

export default DashboardController;
