const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  PARTIALLY_PAID: "PARTIALLY_PAID",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
  VOID: "VOID",
} as const;

const SALE_STATUS = {
  COMPLETED: "COMPLETED",
} as const;
import prisma from "../config/db.config.js";
import { fetchCashInflowSnapshot, getDailyExpenses } from "./dashboardAnalyticsService.js";

type MonthPoint = {
  month: string;
  value: number;
};

type FinancialInsightTone = "positive" | "warning" | "critical" | "info";

export type DashboardFinancialInsight = {
  id: string;
  tone: FinancialInsightTone;
  title: string;
  message: string;
};

export type DashboardForecastPayload = {
  generatedAt: string;
  basis: {
    averageWindowDays: number;
    historicalWindowMonths: number;
    projectionMonths: number;
  };
  sales: {
    method: string;
    historicalMonthly: Array<{ month: string; receipts: number }>;
    predictedMonthly: Array<{ month: string; receipts: number }>;
    trailing30Days: {
      totalReceipts: number;
      averageDailyReceipts: number;
      previous30DaysTotal: number;
      trendPercent: number;
    };
    projectedNext30Days: number;
  };
  cashflow: {
    trailing30Days: {
      inflow: number;
      outflow: number;
      net: number;
      averageDailyInflow: number;
      averageDailyOutflow: number;
      balanceEstimate: number;
    };
    projected30Days: {
      inflow: number;
      outflow: number;
      net: number;
      closingBalanceEstimate: number;
    };
    predictedMonthly: Array<{
      month: string;
      inflow: number;
      outflow: number;
      net: number;
      closingBalanceEstimate: number;
    }>;
  };
  profit: {
    historicalMonthly: Array<{
      month: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    }>;
    projectedMonthly: Array<{
      month: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    }>;
    trailing30Days: {
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    };
    projected30Days: {
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      margin: number;
    };
  };
  receivables: {
    outstanding: number;
  };
  insights: DashboardFinancialInsight[];
};

type DailyAmount = {
  date: Date;
  amount: number;
};

const AVERAGE_WINDOW_DAYS = 30;
const HISTORICAL_WINDOW_MONTHS = 6;
const PROJECTION_MONTHS = 3;
const SYNCED_INVOICE_NOTE_PATTERN = /Synced from invoice\s+/i;

const toNumber = (value: unknown) => Number(value ?? 0);

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

const startOfMonthUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const daysInMonthUtc = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

const sumAmounts = (entries: DailyAmount[]) =>
  roundMetric(entries.reduce((sum, entry) => sum + entry.amount, 0));

const averagePerDay = (total: number, days: number) =>
  roundMetric(days <= 0 ? 0 : total / days);

const marginPercent = (profit: number, sales: number) =>
  sales <= 0 ? 0 : roundMetric((profit / sales) * 100, 1);

const percentChange = (current: number, previous: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 0;
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 100 : -100;
  }
  return roundMetric(((current - previous) / Math.abs(previous)) * 100, 1);
};

const buildHistoricalMonthStarts = (months: number, fromDate = new Date()) =>
  Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    return new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() - offset, 1),
    );
  });

const buildProjectedMonthStarts = (months: number, fromDate = new Date()) =>
  Array.from({ length: months }, (_, index) => {
    const offset = index + 1;
    return new Date(
      Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth() + offset, 1),
    );
  });

const sumByMonth = (entries: DailyAmount[], monthStartDates: Date[]) => {
  const totals = new Map<string, number>();

  entries.forEach((entry) => {
    const key = toMonthKey(entry.date);
    totals.set(key, (totals.get(key) ?? 0) + entry.amount);
  });

  return monthStartDates.map((monthStart) => {
    const key = toMonthKey(monthStart);
    return {
      month: monthLabel(monthStart),
      value: roundMetric(totals.get(key) ?? 0),
    };
  });
};

const isSyncedInvoiceSale = (notes: string | null | undefined) =>
  SYNCED_INVOICE_NOTE_PATTERN.test(notes ?? "");

const resolveInvoicePaidAmount = (invoice: {
  total: unknown;
  status: string;
  payments: Array<{ amount: unknown }>;
}) => {
  const total = toNumber(invoice.total);
  const paymentsTotal = invoice.payments.reduce(
    (sum, payment) => sum + toNumber(payment.amount),
    0,
  );
  const normalizedPaid = Math.max(0, Math.min(paymentsTotal, total));

  if (normalizedPaid > 0) {
    return normalizedPaid;
  }

  return invoice.status === INVOICE_STATUS.PAID ? total : 0;
};

const resolveInvoicePendingAmount = (invoice: {
  total: unknown;
  status: string;
  payments: Array<{ amount: unknown }>;
}) => {
  if (
    invoice.status === INVOICE_STATUS.DRAFT ||
    invoice.status === INVOICE_STATUS.VOID
  ) {
    return 0;
  }

  return Math.max(0, toNumber(invoice.total) - resolveInvoicePaidAmount(invoice));
};

const forecastMonthlyFromDailyAverage = (params: {
  averageDailyAmount: number;
  months: number;
  fromDate?: Date;
}) => {
  const { averageDailyAmount, months, fromDate = new Date() } = params;
  return buildProjectedMonthStarts(months, fromDate).map((monthStart) => {
    const value = averageDailyAmount * daysInMonthUtc(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth(),
    );

    return {
      month: monthLabel(monthStart),
      value: roundMetric(value),
    };
  });
};

const mapPurchaseEntries = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const purchases = await prisma.purchase.findMany({
    where: {
      user_id: params.userId,
      paidAmount: { gt: 0 },
      OR: [
        { paymentDate: { gte: params.start, lt: params.endExclusive } },
        { paymentDate: null, purchase_date: { gte: params.start, lt: params.endExclusive } },
      ],
    },
    select: {
      purchase_date: true,
      paymentDate: true,
      paidAmount: true,
    },
  });

  return purchases
    .map((purchase) => ({
      date: purchase.paymentDate ?? purchase.purchase_date,
      amount: roundMetric(toNumber(purchase.paidAmount)),
    }))
    .filter((entry) => entry.amount > 0);
};

const mapExpenseEntries = async (params: {
  userId: number;
  start: Date;
  endExclusive: Date;
}) => {
  const expenseRows = await getDailyExpenses({ userId: params.userId, from: params.start });
  return expenseRows
    .filter((row) => row.day >= params.start && row.day < params.endExclusive)
    .map((row) => ({
      date: row.day,
      amount: roundMetric(row.amount),
    }))
    .filter((entry) => entry.amount > 0);
};

const filterEntriesByRange = (entries: DailyAmount[], start: Date, endExclusive: Date) =>
  entries.filter((entry) => entry.date >= start && entry.date < endExclusive);

export const forecastSales = (params: {
  cashReceipts: DailyAmount[];
  now?: Date;
}) => {
  const now = params.now ?? new Date();
  const tomorrow = addDaysUtc(startOfDayUtc(now), 1);
  const last30Start = addDaysUtc(tomorrow, -AVERAGE_WINDOW_DAYS);
  const previous30Start = addDaysUtc(last30Start, -AVERAGE_WINDOW_DAYS);

  const trailing30Receipts = filterEntriesByRange(
    params.cashReceipts,
    last30Start,
    tomorrow,
  );
  const previous30Receipts = filterEntriesByRange(
    params.cashReceipts,
    previous30Start,
    last30Start,
  );

  const trailing30Total = sumAmounts(trailing30Receipts);
  const previous30Total = sumAmounts(previous30Receipts);
  const averageDailyReceipts = averagePerDay(trailing30Total, AVERAGE_WINDOW_DAYS);
  const projectedMonthly = forecastMonthlyFromDailyAverage({
    averageDailyAmount: averageDailyReceipts,
    months: PROJECTION_MONTHS,
    fromDate: now,
  });

  return {
    method: "daily-average-receipts",
    historicalMonthly: sumByMonth(
      params.cashReceipts,
      buildHistoricalMonthStarts(HISTORICAL_WINDOW_MONTHS, now),
    ).map((point) => ({
      month: point.month,
      receipts: point.value,
    })),
    predictedMonthly: projectedMonthly.map((point) => ({
      month: point.month,
      receipts: point.value,
    })),
    trailing30Days: {
      totalReceipts: trailing30Total,
      averageDailyReceipts,
      previous30DaysTotal: previous30Total,
      trendPercent: percentChange(trailing30Total, previous30Total),
    },
    projectedNext30Days: roundMetric(averageDailyReceipts * AVERAGE_WINDOW_DAYS),
  };
};

export const forecastCashflow = (params: {
  cashReceipts: DailyAmount[];
  purchasePayments: DailyAmount[];
  expenseEntries: DailyAmount[];
  now?: Date;
}) => {
  const now = params.now ?? new Date();
  const tomorrow = addDaysUtc(startOfDayUtc(now), 1);
  const last30Start = addDaysUtc(tomorrow, -AVERAGE_WINDOW_DAYS);

  const trailingInflow = sumAmounts(
    filterEntriesByRange(params.cashReceipts, last30Start, tomorrow),
  );
  const trailingPurchaseOutflow = sumAmounts(
    filterEntriesByRange(params.purchasePayments, last30Start, tomorrow),
  );
  const trailingExpenseOutflow = sumAmounts(
    filterEntriesByRange(params.expenseEntries, last30Start, tomorrow),
  );
  const trailingOutflow = roundMetric(trailingPurchaseOutflow + trailingExpenseOutflow);
  const trailingNet = roundMetric(trailingInflow - trailingOutflow);
  const averageDailyInflow = averagePerDay(trailingInflow, AVERAGE_WINDOW_DAYS);
  const averageDailyOutflow = averagePerDay(trailingOutflow, AVERAGE_WINDOW_DAYS);
  const projected30Inflow = roundMetric(averageDailyInflow * AVERAGE_WINDOW_DAYS);
  const projected30Outflow = roundMetric(averageDailyOutflow * AVERAGE_WINDOW_DAYS);
  const projected30Net = roundMetric(projected30Inflow - projected30Outflow);
  let runningBalance = trailingNet;

  const projectedMonthly = buildProjectedMonthStarts(PROJECTION_MONTHS, now).map(
    (monthStart) => {
      const days = daysInMonthUtc(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
      );
      const inflow = roundMetric(averageDailyInflow * days);
      const outflow = roundMetric(averageDailyOutflow * days);
      const net = roundMetric(inflow - outflow);
      runningBalance = roundMetric(runningBalance + net);

      return {
        month: monthLabel(monthStart),
        inflow,
        outflow,
        net,
        closingBalanceEstimate: runningBalance,
      };
    },
  );

  return {
    trailing30Days: {
      inflow: trailingInflow,
      outflow: trailingOutflow,
      net: trailingNet,
      averageDailyInflow,
      averageDailyOutflow,
      balanceEstimate: trailingNet,
    },
    projected30Days: {
      inflow: projected30Inflow,
      outflow: projected30Outflow,
      net: projected30Net,
      closingBalanceEstimate: roundMetric(trailingNet + projected30Net),
    },
    predictedMonthly: projectedMonthly,
  };
};

export const forecastProfit = (params: {
  cashReceipts: DailyAmount[];
  purchasePayments: DailyAmount[];
  expenseEntries: DailyAmount[];
  now?: Date;
}) => {
  const now = params.now ?? new Date();
  const tomorrow = addDaysUtc(startOfDayUtc(now), 1);
  const last30Start = addDaysUtc(tomorrow, -AVERAGE_WINDOW_DAYS);

  const historicalMonthStarts = buildHistoricalMonthStarts(HISTORICAL_WINDOW_MONTHS, now);
  const monthlySales = sumByMonth(params.cashReceipts, historicalMonthStarts);
  const monthlyPurchases = sumByMonth(params.purchasePayments, historicalMonthStarts);
  const monthlyExpenses = sumByMonth(params.expenseEntries, historicalMonthStarts);

  const historicalMonthly = historicalMonthStarts.map((monthStart, index) => {
    const sales = monthlySales[index]?.value ?? 0;
    const purchases = monthlyPurchases[index]?.value ?? 0;
    const expenses = monthlyExpenses[index]?.value ?? 0;
    const profit = roundMetric(sales - purchases - expenses);

    return {
      month: monthLabel(monthStart),
      sales,
      purchases,
      expenses,
      profit,
      margin: marginPercent(profit, sales),
    };
  });

  const trailingSales = sumAmounts(filterEntriesByRange(params.cashReceipts, last30Start, tomorrow));
  const trailingPurchases = sumAmounts(
    filterEntriesByRange(params.purchasePayments, last30Start, tomorrow),
  );
  const trailingExpenses = sumAmounts(
    filterEntriesByRange(params.expenseEntries, last30Start, tomorrow),
  );
  const trailingProfit = roundMetric(trailingSales - trailingPurchases - trailingExpenses);

  const averageDailySales = averagePerDay(trailingSales, AVERAGE_WINDOW_DAYS);
  const averageDailyPurchases = averagePerDay(trailingPurchases, AVERAGE_WINDOW_DAYS);
  const averageDailyExpenses = averagePerDay(trailingExpenses, AVERAGE_WINDOW_DAYS);

  const projectedMonthly = buildProjectedMonthStarts(PROJECTION_MONTHS, now).map(
    (monthStart) => {
      const days = daysInMonthUtc(
        monthStart.getUTCFullYear(),
        monthStart.getUTCMonth(),
      );
      const sales = roundMetric(averageDailySales * days);
      const purchases = roundMetric(averageDailyPurchases * days);
      const expenses = roundMetric(averageDailyExpenses * days);
      const profit = roundMetric(sales - purchases - expenses);

      return {
        month: monthLabel(monthStart),
        sales,
        purchases,
        expenses,
        profit,
        margin: marginPercent(profit, sales),
      };
    },
  );

  const projected30Sales = roundMetric(averageDailySales * AVERAGE_WINDOW_DAYS);
  const projected30Purchases = roundMetric(averageDailyPurchases * AVERAGE_WINDOW_DAYS);
  const projected30Expenses = roundMetric(averageDailyExpenses * AVERAGE_WINDOW_DAYS);
  const projected30Profit = roundMetric(
    projected30Sales - projected30Purchases - projected30Expenses,
  );

  return {
    historicalMonthly,
    projectedMonthly,
    trailing30Days: {
      sales: trailingSales,
      purchases: trailingPurchases,
      expenses: trailingExpenses,
      profit: trailingProfit,
      margin: marginPercent(trailingProfit, trailingSales),
    },
    projected30Days: {
      sales: projected30Sales,
      purchases: projected30Purchases,
      expenses: projected30Expenses,
      profit: projected30Profit,
      margin: marginPercent(projected30Profit, projected30Sales),
    },
  };
};

const fetchOutstandingReceivables = async (userId: number) => {
  const [sales, invoices] = await Promise.all([
    prisma.sale.findMany({
      where: {
        user_id: userId,
        status: SALE_STATUS.COMPLETED,
        pendingAmount: { gt: 0 },
      },
      select: {
        pendingAmount: true,
        notes: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        user_id: userId,
        status: {
          in: [
            INVOICE_STATUS.SENT,
            INVOICE_STATUS.PARTIALLY_PAID,
            INVOICE_STATUS.OVERDUE,
            INVOICE_STATUS.PAID,
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

  const salePending = sales
    .filter((sale) => !isSyncedInvoiceSale(sale.notes))
    .reduce((sum, sale) => sum + Math.max(0, toNumber(sale.pendingAmount)), 0);

  const invoicePending = invoices.reduce(
    (sum, invoice) => sum + resolveInvoicePendingAmount(invoice),
    0,
  );

  return roundMetric(salePending + invoicePending);
};

export const generateFinancialInsights = (params: {
  sales: DashboardForecastPayload["sales"];
  cashflow: DashboardForecastPayload["cashflow"];
  profit: DashboardForecastPayload["profit"];
  receivables: DashboardForecastPayload["receivables"];
}) => {
  const insights: DashboardFinancialInsight[] = [];

  if (params.sales.trailing30Days.trendPercent >= 5) {
    insights.push({
      id: "sales-uptrend",
      tone: "positive",
      title: "Sales are increasing compared to last period",
      message: `Cash receipts are up ${params.sales.trailing30Days.trendPercent}% versus the previous 30 days.`,
    });
  } else if (params.sales.trailing30Days.trendPercent <= -5) {
    insights.push({
      id: "sales-slowdown",
      tone: "warning",
      title: "Sales receipts have slowed down",
      message: `Cash receipts are down ${Math.abs(
        params.sales.trailing30Days.trendPercent,
      )}% versus the previous 30 days.`,
    });
  } else {
    insights.push({
      id: "sales-stable",
      tone: "info",
      title: "Sales trend is stable",
      message: "Receipts are moving close to the previous 30-day run rate.",
    });
  }

  const projectedMonthlySales = params.sales.predictedMonthly[0]?.receipts ?? 0;
  const pendingRatio =
    projectedMonthlySales > 0
      ? params.receivables.outstanding / projectedMonthlySales
      : params.receivables.outstanding > 0
        ? 1
        : 0;

  if (pendingRatio >= 0.7) {
    insights.push({
      id: "pending-payments-high",
      tone: "warning",
      title: "High pending payments detected",
      message: `Outstanding receivables are ${roundMetric(
        pendingRatio * 100,
        1,
      )}% of one projected month of sales.`,
    });
  }

  if (
    params.cashflow.projected30Days.net < 0 ||
    params.cashflow.projected30Days.closingBalanceEstimate < 0
  ) {
    insights.push({
      id: "cashflow-negative-risk",
      tone: "critical",
      title: "Cashflow may become negative soon",
      message: `Projected 30-day net cashflow is ${params.cashflow.projected30Days.net.toLocaleString(
        "en-IN",
        { style: "currency", currency: "INR" },
      )}.`,
    });
  } else {
    insights.push({
      id: "cashflow-healthy",
      tone: "positive",
      title: "Cashflow outlook is healthy",
      message: `Projected 30-day closing cash position is ${params.cashflow.projected30Days.closingBalanceEstimate.toLocaleString(
        "en-IN",
        { style: "currency", currency: "INR" },
      )}.`,
    });
  }

  if (params.profit.projected30Days.profit > 0) {
    insights.push({
      id: "profit-positive",
      tone: "positive",
      title: "Profit projection remains positive",
      message: `Projected 30-day profit is ${params.profit.projected30Days.profit.toLocaleString(
        "en-IN",
        { style: "currency", currency: "INR" },
      )} at a ${params.profit.projected30Days.margin}% margin.`,
    });
  } else {
    insights.push({
      id: "profit-pressure",
      tone: "warning",
      title: "Profit margins are under pressure",
      message: `Projected 30-day profit is ${params.profit.projected30Days.profit.toLocaleString(
        "en-IN",
        { style: "currency", currency: "INR" },
      )}. Review cost and collection speed.`,
    });
  }

  return insights.slice(0, 4);
};

export const buildDashboardForecast = async (params: { userId: number; now?: Date }) => {
  const now = params.now ?? new Date();
  const tomorrow = addDaysUtc(startOfDayUtc(now), 1);
  const historyStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (HISTORICAL_WINDOW_MONTHS - 1), 1),
  );

  const [cashInflow, purchasePayments, expenseEntries, outstandingReceivables] =
    await Promise.all([
      fetchCashInflowSnapshot({
        userId: params.userId,
        start: historyStart,
        endExclusive: tomorrow,
        debugLabel: "dashboard forecast",
      }),
      mapPurchaseEntries({
        userId: params.userId,
        start: historyStart,
        endExclusive: tomorrow,
      }),
      mapExpenseEntries({
        userId: params.userId,
        start: historyStart,
        endExclusive: tomorrow,
      }),
      fetchOutstandingReceivables(params.userId),
    ]);

  const cashReceipts = cashInflow.entries.map((entry) => ({
    date: entry.date,
    amount: entry.amount,
  }));

  const sales = forecastSales({ cashReceipts, now });
  const cashflow = forecastCashflow({
    cashReceipts,
    purchasePayments,
    expenseEntries,
    now,
  });
  const profit = forecastProfit({
    cashReceipts,
    purchasePayments,
    expenseEntries,
    now,
  });

  const receivables = {
    outstanding: outstandingReceivables,
  };

  return {
    generatedAt: now.toISOString(),
    basis: {
      averageWindowDays: AVERAGE_WINDOW_DAYS,
      historicalWindowMonths: HISTORICAL_WINDOW_MONTHS,
      projectionMonths: PROJECTION_MONTHS,
    },
    sales,
    cashflow,
    profit,
    receivables,
    insights: generateFinancialInsights({
      sales,
      cashflow,
      profit,
      receivables,
    }),
  } satisfies DashboardForecastPayload;
};
