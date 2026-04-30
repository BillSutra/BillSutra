import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { sumAnalyticsDailyStatsRange } from "./analyticsDailyStats.service.js";
import { resolveDashboardFilters } from "./dashboardAnalyticsService.js";

type DashboardQuickInsightTone = "positive" | "warning" | "critical" | "info";

export type DashboardQuickInsight = {
  id: string;
  tone: DashboardQuickInsightTone;
  title: string;
  message: string;
  actionUrl: string;
};

export type DashboardQuickInsightsPayload = {
  generatedAt: string;
  headline: string;
  summary: string;
  items: DashboardQuickInsight[];
};

type QuickInsightsLanguage = "en" | "hi";

type LowStockRow = {
  name: string;
  stock_on_hand: number;
  reorder_level: number;
  total_count: bigint | number;
};

type TopProductRow = {
  name: string;
  units: bigint | number;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const roundMetric = (value: number, digits = 1) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const percentChange = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    if (current === 0) return 0;
    return current > previous ? 100 : -100;
  }
  return roundMetric(((current - previous) / Math.abs(previous)) * 100);
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount));

const formatCount = (count: number) =>
  new Intl.NumberFormat("en-IN").format(Math.max(0, count));

const resolveLanguage = (language?: string | null): QuickInsightsLanguage =>
  language?.trim().toLowerCase() === "hi" ? "hi" : "en";

const buildCopy = (language: QuickInsightsLanguage) =>
  language === "hi"
    ? {
        healthyHeadline: "Aaj ka business steady dikh raha hai.",
        attentionHeadline: "Aaj kuch cheezen turant dhyan maang rahi hain.",
        healthySummary:
          "Quick Insights aapke business data se turant useful signals nikaal rahi hai.",
        attentionSummary:
          "Quick Insights un areas ko highlight kar rahi hai jahan aaj action lene se impact padega.",
        salesUpTitle: "Sales momentum",
        salesUpMessage: (change: number, label: string) =>
          `Sales pichle ${label} ke mukable ${change}% upar hain.`,
        salesDownTitle: "Sales slowdown",
        salesDownMessage: (change: number, label: string) =>
          `Sales pichle ${label} ke mukable ${Math.abs(change)}% niche hain.`,
        collectionsTitle: "Collections pending",
        collectionsMessage: (amount: number, overdueCount: number) =>
          overdueCount > 0
            ? `${formatCount(overdueCount)} overdue invoice${overdueCount === 1 ? "" : "s"} ke saath ${formatCurrency(amount)} abhi bhi collect hona baki hai.`
            : `${formatCurrency(amount)} collections abhi pending hain.`,
        dueSoonTitle: "Upcoming dues",
        dueSoonMessage: (dueTodayCount: number, dueSoonCount: number) =>
          dueTodayCount > 0
            ? `${formatCount(dueTodayCount)} invoice${dueTodayCount === 1 ? "" : "s"} aaj due hain.${dueSoonCount > 0 ? ` Agle 3 dino me ${formatCount(dueSoonCount)} aur due hain.` : ""}`
            : `Agle 3 dino me ${formatCount(dueSoonCount)} invoice${dueSoonCount === 1 ? "" : "s"} due hain.`,
        lowStockTitle: "Stock alert",
        lowStockMessage: (count: number, row: LowStockRow | null) =>
          row
            ? `${formatCount(count)} item${count === 1 ? "" : "s"} reorder level par hain. ${row.name} me sirf ${formatCount(row.stock_on_hand)} baki hai.`
            : `${formatCount(count)} item${count === 1 ? "" : "s"} low stock me hain.`,
        noSalesTitle: "No sales yet",
        noSalesMessage:
          "Aaj abhi tak koi sale record nahi hui. Billing desk ya walk-in activity check karein.",
        topProductTitle: "Best seller today",
        topProductMessage: (row: TopProductRow) =>
          `${row.name} aaj ${formatCount(toNumber(row.units))} unit ke saath sabse aage hai.`,
        profitTitle: "Profit trend",
        profitMessage: (change: number, label: string) =>
          `Booked profit pichle ${label} ke mukable ${Math.abs(change)}% ${change >= 0 ? "upar" : "niche"} hai.`,
        healthyTitle: "Sab kuch sync me hai",
        healthyMessage:
          "Aaj ke core metrics stable hain. Agle update tak dashboard signals healthy dikh rahe hain.",
      }
    : {
        healthyHeadline: "Business looks steady today.",
        attentionHeadline: "A few areas need attention today.",
        healthySummary:
          "Quick Insights turns your latest business data into fast, practical signals.",
        attentionSummary:
          "Quick Insights is highlighting the items most likely to affect today's cash flow and follow-up.",
        salesUpTitle: "Sales momentum",
        salesUpMessage: (change: number, label: string) =>
          `Sales are up ${change}% versus the previous ${label}.`,
        salesDownTitle: "Sales slowdown",
        salesDownMessage: (change: number, label: string) =>
          `Sales are down ${Math.abs(change)}% versus the previous ${label}.`,
        collectionsTitle: "Collections pending",
        collectionsMessage: (amount: number, overdueCount: number) =>
          overdueCount > 0
            ? `${formatCount(overdueCount)} overdue invoice${overdueCount === 1 ? "" : "s"} still account for ${formatCurrency(amount)} in pending collections.`
            : `${formatCurrency(amount)} is still pending in collections.`,
        dueSoonTitle: "Upcoming dues",
        dueSoonMessage: (dueTodayCount: number, dueSoonCount: number) =>
          dueTodayCount > 0
            ? `${formatCount(dueTodayCount)} invoice${dueTodayCount === 1 ? "" : "s"} are due today.${dueSoonCount > 0 ? ` ${formatCount(dueSoonCount)} more are due in the next 3 days.` : ""}`
            : `${formatCount(dueSoonCount)} invoice${dueSoonCount === 1 ? "" : "s"} are due in the next 3 days.`,
        lowStockTitle: "Stock alert",
        lowStockMessage: (count: number, row: LowStockRow | null) =>
          row
            ? `${formatCount(count)} item${count === 1 ? "" : "s"} are at reorder level. ${row.name} has only ${formatCount(row.stock_on_hand)} left.`
            : `${formatCount(count)} item${count === 1 ? "" : "s"} are running low.`,
        noSalesTitle: "No sales yet",
        noSalesMessage:
          "No sales have been recorded today yet. It may be worth checking the billing desk or walk-in activity.",
        topProductTitle: "Best seller today",
        topProductMessage: (row: TopProductRow) =>
          `${row.name} is leading today with ${formatCount(toNumber(row.units))} units sold.`,
        profitTitle: "Profit trend",
        profitMessage: (change: number, label: string) =>
          `Booked profit is ${change >= 0 ? "up" : "down"} ${Math.abs(change)}% versus the previous ${label}.`,
        healthyTitle: "Everything is in sync",
        healthyMessage:
          "Core metrics look stable right now. The dashboard is not seeing any urgent pressure points at the moment.",
      };

export const buildDashboardQuickInsights = async (params: {
  userId: number;
  filters: {
    range?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    granularity?: unknown;
  };
  language?: string | null;
}): Promise<DashboardQuickInsightsPayload> => {
  const language = resolveLanguage(params.language);
  const copy = buildCopy(language);
  const resolved = resolveDashboardFilters(params.filters);
  const comparisonLabel =
    resolved.daySpan === 1 ? "day" : `${resolved.daySpan}-day period`;
  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const todayEnd = addDaysUtc(todayStart, 1);
  const nextThreeDays = addDaysUtc(todayEnd, 3);

  const [
    currentTotals,
    previousTotals,
    todayTotals,
    overdueCount,
    dueTodayCount,
    dueSoonCount,
    lowStockRows,
    topProductRows,
  ] = await Promise.all([
    sumAnalyticsDailyStatsRange({
      userId: params.userId,
      start: resolved.start,
      endExclusive: resolved.endExclusive,
    }),
    sumAnalyticsDailyStatsRange({
      userId: params.userId,
      start: resolved.previousStart,
      endExclusive: resolved.previousEndExclusive,
    }),
    sumAnalyticsDailyStatsRange({
      userId: params.userId,
      start: todayStart,
      endExclusive: todayEnd,
    }),
    prisma.invoice.count({
      where: {
        user_id: params.userId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        due_date: { lt: todayStart },
      },
    }),
    prisma.invoice.count({
      where: {
        user_id: params.userId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        due_date: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.invoice.count({
      where: {
        user_id: params.userId,
        status: { in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
        due_date: { gte: todayEnd, lt: nextThreeDays },
      },
    }),
    prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT
        p.name,
        p.stock_on_hand,
        p.reorder_level,
        COUNT(*) OVER() AS total_count
      FROM "products" AS p
      WHERE p.user_id = ${params.userId}
        AND p.reorder_level > 0
        AND p.stock_on_hand <= p.reorder_level
      ORDER BY p.stock_on_hand ASC, p.updated_at DESC
      LIMIT 3
    `),
    prisma.$queryRaw<TopProductRow[]>(Prisma.sql`
      SELECT
        COALESCE(p.name, si.name) AS name,
        COALESCE(SUM(si.quantity), 0) AS units
      FROM "sale_items" AS si
      INNER JOIN "sales" AS s
        ON s.id = si.sale_id
      LEFT JOIN "products" AS p
        ON p.id = si.product_id
      WHERE s.user_id = ${params.userId}
        AND s.status = 'COMPLETED'
        AND s.sale_date >= ${todayStart}
        AND s.sale_date < ${todayEnd}
      GROUP BY COALESCE(p.name, si.name)
      ORDER BY units DESC, name ASC
      LIMIT 1
    `),
  ]);

  const currentSales =
    currentTotals.collectedSales + currentTotals.invoiceCollections;
  const previousSales =
    previousTotals.collectedSales + previousTotals.invoiceCollections;
  const salesChange = percentChange(currentSales, previousSales);

  const currentProfit =
    currentTotals.bookedSales -
    currentTotals.bookedPurchases -
    currentTotals.expenses +
    currentTotals.extraIncome -
    currentTotals.extraExpense -
    currentTotals.extraLoss -
    currentTotals.extraInvestment;
  const previousProfit =
    previousTotals.bookedSales -
    previousTotals.bookedPurchases -
    previousTotals.expenses +
    previousTotals.extraIncome -
    previousTotals.extraExpense -
    previousTotals.extraLoss -
    previousTotals.extraInvestment;
  const profitChange = percentChange(currentProfit, previousProfit);

  const lowStockCount = toNumber(lowStockRows[0]?.total_count ?? 0);
  const lowStockLead = lowStockRows[0] ?? null;
  const topProduct = topProductRows[0] ?? null;

  const items: DashboardQuickInsight[] = [];

  if (salesChange > 3) {
    items.push({
      id: "sales-up",
      tone: "positive",
      title: copy.salesUpTitle,
      message: copy.salesUpMessage(salesChange, comparisonLabel),
      actionUrl: "/dashboard",
    });
  } else if (salesChange < -3) {
    items.push({
      id: "sales-down",
      tone: salesChange < -10 ? "critical" : "warning",
      title: copy.salesDownTitle,
      message: copy.salesDownMessage(salesChange, comparisonLabel),
      actionUrl: "/dashboard",
    });
  }

  if (currentTotals.pendingSales > 0) {
    items.push({
      id: "collections-pending",
      tone: overdueCount > 0 ? "critical" : "warning",
      title: copy.collectionsTitle,
      message: copy.collectionsMessage(currentTotals.pendingSales, overdueCount),
      actionUrl: "/customers",
    });
  }

  if (dueTodayCount > 0 || dueSoonCount > 0) {
    items.push({
      id: "upcoming-dues",
      tone: dueTodayCount > 0 ? "critical" : "warning",
      title: copy.dueSoonTitle,
      message: copy.dueSoonMessage(dueTodayCount, dueSoonCount),
      actionUrl: "/invoices/history",
    });
  }

  if (lowStockCount > 0) {
    items.push({
      id: "low-stock",
      tone:
        lowStockLead && lowStockLead.stock_on_hand <= 0
          ? "critical"
          : "warning",
      title: copy.lowStockTitle,
      message: copy.lowStockMessage(lowStockCount, lowStockLead),
      actionUrl: "/inventory",
    });
  }

  if (topProduct) {
    items.push({
      id: "top-product",
      tone: "info",
      title: copy.topProductTitle,
      message: copy.topProductMessage(topProduct),
      actionUrl: "/products",
    });
  } else if (todayTotals.saleCount === 0) {
    items.push({
      id: "no-sales-today",
      tone: "info",
      title: copy.noSalesTitle,
      message: copy.noSalesMessage,
      actionUrl: "/simple-bill",
    });
  }

  if (profitChange <= -5) {
    items.push({
      id: "profit-trend",
      tone: profitChange <= -15 ? "critical" : "warning",
      title: copy.profitTitle,
      message: copy.profitMessage(profitChange, comparisonLabel),
      actionUrl: "/insights#forecasting",
    });
  }

  const deduped = items
    .filter(
      (item, index, array) =>
        array.findIndex((entry) => entry.id === item.id) === index,
    )
    .slice(0, 5);

  const hasAttention = deduped.some(
    (item) => item.tone === "critical" || item.tone === "warning",
  );

  return {
    generatedAt: new Date().toISOString(),
    headline: hasAttention ? copy.attentionHeadline : copy.healthyHeadline,
    summary: hasAttention ? copy.attentionSummary : copy.healthySummary,
    items:
      deduped.length > 0
        ? deduped
        : [
            {
              id: "healthy",
              tone: "positive",
              title: copy.healthyTitle,
              message: copy.healthyMessage,
              actionUrl: "/dashboard",
            },
          ],
  };
};
