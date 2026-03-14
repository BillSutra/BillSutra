import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";

type RevenuePoint = { date: Date; total: Prisma.Decimal | number };
type CostPoint = { date: Date; total: Prisma.Decimal | number };
type ExpensePoint = { month: Date; amount: number };

type NotificationInput = {
  lowStock: string[];
  pendingSales: Array<{ customer: string; pendingAmount: number }>;
  supplierPayables: Array<{ supplier: string; pendingAmount: number }>;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

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
