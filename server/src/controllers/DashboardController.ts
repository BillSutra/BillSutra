import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import {
  buildDashboardOverview,
  buildDashboardCardMetrics,
  buildNotifications,
  fetchCashInflowSnapshot,
  getDailyExpenses,
  getExpenseTotals,
  resolveDashboardFilters,
} from "../services/dashboardAnalyticsService.js";
import { buildDashboardForecast } from "../services/dashboardForecastService.js";
import { onDashboardUpdate } from "../services/dashboardRealtime.js";
import {
  getCachedMetrics,
  setCachedMetrics,
} from "../services/dashboardMetricsCache.js";

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
      const data = await buildDashboardOverview({
        userId,
        filters: {
          range: req.query.range,
          startDate: req.query.startDate,
          endDate: req.query.endDate,
          granularity: req.query.granularity,
        },
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
      const cached = getCachedMetrics(cacheKey);
      if (cached) {
        return sendResponse(res, 200, { data: cached });
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

      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Dashboard metrics error:", error);
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

    const { sales, purchases, saleItems } = await resolveSequentially({
      sales: () =>
        prisma.sale.findMany({
          where: { user_id: userId, sale_date: { gte: start30, lt: endDate } },
          select: { sale_date: true, total: true, totalAmount: true },
        }),
      purchases: () =>
        prisma.purchase.findMany({
          where: {
            user_id: userId,
            purchase_date: { gte: start6Months, lt: endDate },
          },
          select: { purchase_date: true, total: true, totalAmount: true },
        }),
      saleItems: () =>
        prisma.saleItem.findMany({
          where: {
            sale: { user_id: userId, sale_date: { gte: start30, lt: endDate } },
          },
          select: {
            line_total: true,
            product: { select: { category: { select: { name: true } } } },
          },
        }),
    });

    const dailySalesTotals = new Map<string, number>();
    sales.forEach((sale) => {
      const key = toDateKey(sale.sale_date);
      dailySalesTotals.set(
        key,
        (dailySalesTotals.get(key) ?? 0) +
          resolveRecordedTotal(sale.totalAmount, sale.total),
      );
    });

    const dailyPurchaseTotals = new Map<string, number>();
    purchases.forEach((purchase) => {
      const key = toDateKey(purchase.purchase_date);
      dailyPurchaseTotals.set(
        key,
        (dailyPurchaseTotals.get(key) ?? 0) +
          resolveRecordedTotal(purchase.totalAmount, purchase.total),
      );
    });

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

    sales.forEach((sale) => {
      const key = toMonthKey(sale.sale_date);
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.sales += resolveRecordedTotal(sale.totalAmount, sale.total);
      }
    });

    purchases.forEach((purchase) => {
      const key = toMonthKey(purchase.purchase_date);
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.purchases += resolveRecordedTotal(purchase.totalAmount, purchase.total);
      }
    });

    const monthly = Array.from(monthlyMap.values()).map((entry) => ({
      month: toMonthLabel(entry.labelDate),
      sales: entry.sales,
      purchases: entry.purchases,
    }));

    const categoryMap = new Map<string, number>();
    saleItems.forEach((item) => {
      const name = item.product?.category?.name ?? "Uncategorized";
      categoryMap.set(
        name,
        (categoryMap.get(name) ?? 0) + toNumber(item.line_total),
      );
    });

    const categories = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    return sendResponse(res, 200, {
      data: {
        last7Days,
        last30Days,
        monthly,
        categories,
      },
    });
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
      include: { customer: true },
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

    return sendResponse(res, 200, { data: { transactions } });
  }

  static async customers(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const dayStart = startOfDayUtc(now);
    const weekStart = startOfDayUtc(addDays(now, -6));
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const start30DaysAgo = startOfDayUtc(addDays(now, -30));
    const start60DaysAgo = startOfDayUtc(addDays(now, -60));

    const {
      totalRegisteredCustomers,
      pendingPaymentAgg,
      topCustomerSales,
      dailyRegisteredGroups,
      dailyWalkIns,
      weeklyRegisteredGroups,
      weeklyWalkIns,
      monthlyRegisteredGroups,
      monthlyWalkIns,
      allCustomersData,
      last30DaysSales,
      prev30DaysSales,
    } = await resolveSequentially({
      totalRegisteredCustomers: () =>
        prisma.customer.count({
          where: { user_id: userId },
        }),
      pendingPaymentAgg: () =>
        prisma.sale.aggregate({
          where: {
            user_id: userId,
            paymentStatus: { in: ["PARTIALLY_PAID", "UNPAID"] },
          },
          _sum: { pendingAmount: true },
        }),
      topCustomerSales: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: { user_id: userId, customer_id: { not: null } },
          _sum: { total: true },
          _count: { _all: true },
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        }),
      dailyRegisteredGroups: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            sale_date: { gte: dayStart },
          },
          _count: { _all: true },
        }),
      dailyWalkIns: () =>
        prisma.sale.count({
          where: {
            user_id: userId,
            customer_id: null,
            sale_date: { gte: dayStart },
          },
        }),
      weeklyRegisteredGroups: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            sale_date: { gte: weekStart },
          },
          _count: { _all: true },
        }),
      weeklyWalkIns: () =>
        prisma.sale.count({
          where: {
            user_id: userId,
            customer_id: null,
            sale_date: { gte: weekStart },
          },
        }),
      monthlyRegisteredGroups: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            sale_date: { gte: monthStart },
          },
          _count: { _all: true },
        }),
      monthlyWalkIns: () =>
        prisma.sale.count({
          where: {
            user_id: userId,
            customer_id: null,
            sale_date: { gte: monthStart },
          },
        }),
      allCustomersData: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
          },
          _sum: { total: true },
          _count: { _all: true },
          _min: { sale_date: true },
          _max: { sale_date: true },
        }),
      last30DaysSales: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
            sale_date: { gte: start30DaysAgo },
          },
          _count: { _all: true },
        }),
      prev30DaysSales: () =>
        prisma.sale.groupBy({
          by: ["customer_id"],
          where: {
            user_id: userId,
            customer_id: { not: null },
            paymentStatus: { in: ["PAID", "PARTIALLY_PAID"] },
            sale_date: { gte: start60DaysAgo, lt: start30DaysAgo },
          },
          _count: { _all: true },
        }),
    });

    // Calculate CLV metrics for each customer
    const clvMetrics = allCustomersData
      .map((record) => {
        const customerId = record.customer_id;
        const totalOrders = record._count._all;
        const totalRevenue = toNumber(record._sum.total);
        const firstPurchase = record._min.sale_date
          ? new Date(record._min.sale_date)
          : new Date();
        const lastPurchase = record._max.sale_date
          ? new Date(record._max.sale_date)
          : new Date();

        // Calculate customer lifetime days
        const lifetimeDays = Math.max(
          1,
          Math.floor(
            (lastPurchase.getTime() - firstPurchase.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        // Calculate metrics
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const purchaseFrequency = totalOrders / Math.max(1, lifetimeDays);
        const predicatedFutureValue = Math.round(
          avgOrderValue * purchaseFrequency * 180,
        );

        return {
          customerId,
          totalOrders,
          totalRevenue,
          avgOrderValue: Math.round(avgOrderValue),
          purchaseFrequency: Math.round(purchaseFrequency * 1000) / 1000,
          lastPurchaseDate: toDateKey(lastPurchase),
          lifetimeDays,
          lifeTimeValue: totalRevenue,
          predicatedFutureValue,
        };
      })
      .sort((a, b) => b.lifeTimeValue - a.lifeTimeValue);

    // Calculate composite scores and segments for CLV
    // 1. Find max values to safely normalize
    const maxLtv = Math.max(1, ...clvMetrics.map((m) => m.lifeTimeValue));
    const maxFreq = Math.max(
      0.001,
      ...clvMetrics.map((m) => m.purchaseFrequency),
    );
    const maxAov = Math.max(1, ...clvMetrics.map((m) => m.avgOrderValue));

    const clvWithScores = clvMetrics.map((m) => {
      const daysSinceLastPurchase = Math.max(
        1,
        (now.getTime() - new Date(m.lastPurchaseDate).getTime()) /
          (1000 * 60 * 60 * 24),
      );

      // Normalize metrics 0-1
      const normLtv = m.lifeTimeValue / maxLtv;
      const normFreq = m.purchaseFrequency / maxFreq;
      const normAov = m.avgOrderValue / maxAov;
      const normRecency = Math.max(0, 1 - daysSinceLastPurchase / 365); // simple inverted recency up to 1 year

      // Weights: LTV (40%), Frequency (25%), AOV (20%), Recency (15%)
      const compositeScore =
        normLtv * 0.4 + normFreq * 0.25 + normAov * 0.2 + normRecency * 0.15;

      return { ...m, compositeScore };
    });

    // Determine segments based on percentiles to ensure identical scores get same segment
    // Sort descending by compositeScore
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

    const topCustomerIds = topCustomerSales
      .map((item) => item.customer_id)
      .filter((id): id is number => id !== null);
    const clvCustomerIds = clvWithSegments
      .map((m) => m.customerId)
      .filter((id): id is number => id !== null);
    const customerIds = Array.from(
      new Set([...topCustomerIds, ...clvCustomerIds]),
    );
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true },
        })
      : [];
    const customerMap = new Map(
      customers.map((customer) => [customer.id, customer.name]),
    );

    const topCustomers = topCustomerSales
      .filter(
        (item): item is typeof item & { customer_id: number } =>
          item.customer_id !== null,
      )
      .map((item) => ({
        name: customerMap.get(item.customer_id) ?? "Customer",
        totalPurchaseAmount: toNumber(item._sum.total),
        numberOfOrders: item._count._all,
      }));

    const clvCustomerMap = customerMap;

    const premiumCustomers = clvWithSegments
      .filter(
        (m): m is typeof m & { customerId: number } => m.customerId !== null,
      )
      .filter((m) => m.segment === "PREMIUM")
      .slice(0, 5)
      .map((m) => ({
        customerId: m.customerId,
        customerName: clvCustomerMap.get(m.customerId) ?? "Customer",
        lifetimeValue: m.lifeTimeValue,
        predicatedFutureValue: m.predicatedFutureValue,
        totalOrders: m.totalOrders,
        compositeScore: m.compositeScore,
        segment: m.segment,
      }));

    const regularCustomers = clvWithSegments
      .filter(
        (m): m is typeof m & { customerId: number } => m.customerId !== null,
      )
      .filter((m) => m.segment === "REGULAR")
      .slice(0, 5)
      .map((m) => ({
        customerId: m.customerId,
        customerName: clvCustomerMap.get(m.customerId) ?? "Customer",
        lifetimeValue: m.lifeTimeValue,
        predicatedFutureValue: m.predicatedFutureValue,
        totalOrders: m.totalOrders,
        compositeScore: m.compositeScore,
        segment: m.segment,
      }));

    const newLowCustomers = clvWithSegments
      .filter(
        (m): m is typeof m & { customerId: number } => m.customerId !== null,
      )
      .filter((m) => m.segment === "NEW_LOW")
      .slice(0, 5)
      .map((m) => ({
        customerId: m.customerId,
        customerName: clvCustomerMap.get(m.customerId) ?? "Customer",
        lifetimeValue: m.lifeTimeValue,
        predicatedFutureValue: m.predicatedFutureValue,
        totalOrders: m.totalOrders,
        compositeScore: m.compositeScore,
        segment: m.segment,
      }));

    const toVisitBreakdown = (
      registeredCustomers: number,
      walkInCustomers: number,
    ) => ({
      registeredCustomers,
      walkInCustomers,
      totalCustomers: registeredCustomers + walkInCustomers,
    });

    // Churn prediction calculation
    const churnAnalyticsValues = clvWithSegments
      .filter(
        (m): m is typeof m & { customerId: number } => m.customerId !== null,
      )
      .map((m) => {
        // Find last 30 and prev 30 purchases
        const last30 =
          last30DaysSales.find((s) => s.customer_id === m.customerId)?._count
            ._all || 0;
        const prev30 =
          prev30DaysSales.find((s) => s.customer_id === m.customerId)?._count
            ._all || 0;

        const daysSinceLastPurchase = Math.max(
          1,
          Math.floor(
            (now.getTime() - new Date(m.lastPurchaseDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        let orderTrendDrop = 0;
        if (prev30 > 0) {
          orderTrendDrop = Math.max(0, (prev30 - last30) / prev30);
        } else if (
          last30 === 0 &&
          m.totalOrders > 0 &&
          daysSinceLastPurchase > 30
        ) {
          orderTrendDrop = 1;
        }

        const normDaysSinceLastPurchase = Math.min(
          1,
          daysSinceLastPurchase / 365,
        );
        const normPurchaseFreq = Math.min(1, m.purchaseFrequency);

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
          customerId: m.customerId,
          customerName: clvCustomerMap.get(m.customerId) ?? "Customer",
          lastPurchaseDate: m.lastPurchaseDate,
          daysSinceLastPurchase,
          churnProbability,
          riskLevel,
        };
      });

    const highRiskCount = churnAnalyticsValues.filter(
      (c) => c.riskLevel === "HIGH_RISK",
    ).length;
    const mediumRiskCount = churnAnalyticsValues.filter(
      (c) => c.riskLevel === "MEDIUM_RISK",
    ).length;
    const lowRiskCount = churnAnalyticsValues.filter(
      (c) => c.riskLevel === "LOW_RISK",
    ).length;
    const topAtRiskCustomers = [...churnAnalyticsValues]
      .sort((a, b) => b.churnProbability - a.churnProbability)
      .slice(0, 5);

    return sendResponse(res, 200, {
      data: {
        totalRegisteredCustomers,
        pendingPayments: toNumber(pendingPaymentAgg._sum.pendingAmount),
        customerVisits: {
          daily: toVisitBreakdown(dailyRegisteredGroups.length, dailyWalkIns),
          weekly: toVisitBreakdown(
            weeklyRegisteredGroups.length,
            weeklyWalkIns,
          ),
          monthly: toVisitBreakdown(
            monthlyRegisteredGroups.length,
            monthlyWalkIns,
          ),
        },
        topCustomers,
        clvAnalytics: {
          premiumCustomers,
          regularCustomers,
          newLowCustomers,
          premiumCount: clvWithSegments.filter((m) => m.segment === "PREMIUM")
            .length,
          regularCount: clvWithSegments.filter((m) => m.segment === "REGULAR")
            .length,
          newLowCount: clvWithSegments.filter((m) => m.segment === "NEW_LOW")
            .length,
        },
        churnAnalytics: {
          highRiskCount,
          mediumRiskCount,
          lowRiskCount,
          topAtRiskCustomers,
        },
      },
    });
  }

  static async suppliers(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const now = new Date();
    const start30 = startOfDayUtc(addDays(now, -29));

    const {
      total,
      recentPurchases,
      purchaseTotals,
      topSupplierPurchases,
      allSuppliersData,
    } = await resolveSequentially({
      total: () => prisma.supplier.count({ where: { user_id: userId } }),
      recentPurchases: () =>
        prisma.purchase.count({
          where: { user_id: userId, purchase_date: { gte: start30 } },
        }),
      purchaseTotals: () =>
        prisma.purchase.aggregate({
          where: { user_id: userId, purchase_date: { gte: start30 } },
          _sum: { pendingAmount: true },
        }),
      topSupplierPurchases: () =>
        prisma.purchase.groupBy({
          by: ["supplier_id"],
          where: { user_id: userId, supplier_id: { not: null } },
          _sum: { total: true },
          _count: { _all: true },
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        }),
      allSuppliersData: () =>
        prisma.purchase.groupBy({
          by: ["supplier_id"],
          where: {
            user_id: userId,
            supplier_id: { not: null },
          },
          _sum: { total: true },
          _count: { _all: true },
          _min: { purchase_date: true },
          _max: { purchase_date: true },
        }),
    });

    // Get supplier names for top suppliers
    const topSupplierIds = topSupplierPurchases
      .map((item) => item.supplier_id)
      .filter((id): id is number => id !== null);

    // Calculate Supplier Lifetime Value (LTV) metrics for each supplier
    const supplierLtvMetrics = allSuppliersData
      .map((record) => {
        const supplierId = record.supplier_id;
        const totalOrders = record._count._all;
        const totalPurchaseValue = toNumber(record._sum.total);
        const firstPurchase = record._min.purchase_date
          ? new Date(record._min.purchase_date)
          : new Date();
        const lastPurchase = record._max.purchase_date
          ? new Date(record._max.purchase_date)
          : new Date();

        // Calculate supplier lifetime days
        const lifetimeDays = Math.max(
          1,
          Math.floor(
            (lastPurchase.getTime() - firstPurchase.getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );

        // Calculate metrics
        const avgOrderValue =
          totalOrders > 0 ? totalPurchaseValue / totalOrders : 0;
        const purchaseFrequency = totalOrders / Math.max(1, lifetimeDays);
        const predictedFutureValue = Math.round(
          avgOrderValue * purchaseFrequency * 180,
        );

        return {
          supplierId,
          totalOrders,
          totalPurchaseValue,
          avgOrderValue: Math.round(avgOrderValue),
          purchaseFrequency: Math.round(purchaseFrequency * 1000) / 1000,
          lastPurchaseDate: toDateKey(lastPurchase),
          lifetimeDays,
          supplierLifetimeValue: totalPurchaseValue,
          predictedFutureValue,
        };
      })
      .sort((a, b) => b.supplierLifetimeValue - a.supplierLifetimeValue);

    // Determine supplier segments
    // HIGH_VALUE: top 35% by supplier lifetime value to capture similar-value suppliers
    const supplierWithSegments = supplierLtvMetrics.map((metric, index) => {
      let segment: "HIGH_VALUE" | "LOW_VALUE" = "LOW_VALUE";

      const highValueCount = Math.max(
        1,
        Math.ceil(supplierLtvMetrics.length * 0.35),
      );
      if (index < highValueCount) {
        segment = "HIGH_VALUE";
      }

      return { ...metric, segment };
    });

    // Get supplier names once for both top-supplier and LTV sections.
    const supplierLtvIds = supplierWithSegments
      .map((m) => m.supplierId)
      .filter((id): id is number => id !== null);
    const supplierIds = Array.from(
      new Set([...topSupplierIds, ...supplierLtvIds]),
    );
    const supplierNames = supplierIds.length
      ? await prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, name: true },
        })
      : [];
    const supplierLtvMap = new Map(
      supplierNames.map((supplier) => [supplier.id, supplier.name]),
    );
    const supplierMap = supplierLtvMap;

    const topSuppliersList = topSupplierPurchases
      .filter(
        (item): item is typeof item & { supplier_id: number } =>
          item.supplier_id !== null,
      )
      .map((item) => ({
        name: supplierMap.get(item.supplier_id) ?? "Supplier",
        totalPurchaseAmount: toNumber(item._sum.total),
        numberOfOrders: item._count._all,
      }));

    const highValueSuppliers = supplierWithSegments
      .filter(
        (m): m is typeof m & { supplierId: number } => m.supplierId !== null,
      )
      .filter((m) => m.segment === "HIGH_VALUE")
      .slice(0, 5)
      .map((m) => ({
        supplierId: m.supplierId,
        supplierName: supplierLtvMap.get(m.supplierId) ?? "Supplier",
        lifetimeValue: m.supplierLifetimeValue,
        predictedFutureValue: m.predictedFutureValue,
        totalOrders: m.totalOrders,
        segment: m.segment,
      }));

    const lowValueSuppliers = supplierWithSegments
      .filter(
        (m): m is typeof m & { supplierId: number } => m.supplierId !== null,
      )
      .filter((m) => m.segment === "LOW_VALUE")
      .slice(0, 5)
      .map((m) => ({
        supplierId: m.supplierId,
        supplierName: supplierLtvMap.get(m.supplierId) ?? "Supplier",
        lifetimeValue: m.supplierLifetimeValue,
        predictedFutureValue: m.predictedFutureValue,
        totalOrders: m.totalOrders,
        segment: m.segment,
      }));

    return sendResponse(res, 200, {
      data: {
        total,
        recentPurchases,
        outstandingPayables: toNumber(purchaseTotals._sum.pendingAmount),
        topSuppliers: topSuppliersList,
        supplierAnalytics: {
          highValueCount: highValueSuppliers.length,
          lowValueCount: lowValueSuppliers.length,
          highValueSuppliers,
          lowValueSuppliers,
        },
      },
    });
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

    const { cashInflow, purchases, dailyExpenses } = await resolveSequentially({
        cashInflow: () =>
          fetchCashInflowSnapshot({
            userId,
            start: startOfMonth,
            endExclusive: addDays(startOfMonth, daysInMonth),
            debugLabel: "dashboard cashflow",
          }),
        purchases: () =>
          prisma.purchase.findMany({
            where: {
              user_id: userId,
              purchase_date: { gte: startOfMonth },
              paymentStatus: { in: ["PAID", "PARTIALLY_PAID", "UNPAID"] },
            },
            select: {
              purchase_date: true,
              paymentDate: true,
              paidAmount: true,
            },
          }),
        dailyExpenses: () => getDailyExpenses({ userId, from: startOfMonth }),
      });

    const inflowMap = new Map<string, number>();
    cashInflow.entries
      .filter((entry) => {
        if (inflowMode === "sales") return entry.source === "sale_receipt";
        if (inflowMode === "payments") return entry.source !== "sale_receipt";
        return true;
      })
      .forEach((entry) => {
        const key = toDateKey(entry.date);
        inflowMap.set(key, (inflowMap.get(key) ?? 0) + entry.amount);
      });

    const outflowMap = new Map<string, number>();
    purchases.forEach((purchase) => {
      const key = toDateKey(purchase.paymentDate ?? purchase.purchase_date);
      outflowMap.set(
        key,
        (outflowMap.get(key) ?? 0) + toNumber(purchase.paidAmount),
      );
    });

    dailyExpenses.forEach((expense) => {
      const key = toDateKey(expense.day);
      outflowMap.set(key, (outflowMap.get(key) ?? 0) + expense.amount);
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

    const data = await buildDashboardForecast({ userId });

    return sendResponse(res, 200, {
      data,
    });
  }
}

export default DashboardController;
