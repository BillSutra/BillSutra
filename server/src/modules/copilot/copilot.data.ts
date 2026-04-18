import { Prisma } from "@prisma/client";
import prisma from "../../config/db.config.js";
import { fetchCashInflowSnapshot, getDailyExpenses } from "../../services/dashboardAnalyticsService.js";
import { buildDashboardForecast } from "../../services/dashboardForecastService.js";
import type {
  CopilotDataset,
  CopilotMonthStat,
  CopilotPurchaseRecord,
  ExtraEntryRecord,
  FinancialGoalRecord,
} from "./copilot.types.js";
import {
  addDaysUtc,
  addMonthsUtc,
  monthKey,
  monthLabel,
  roundMetric,
  startOfDayUtc,
  startOfMonthUtc,
  sum,
  toNumber,
} from "./copilot.utils.js";

let goalsTableReady: boolean | null = null;

const ensureFinancialGoalsTable = async () => {
  if (goalsTableReady) {
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS financial_goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(191) NOT NULL,
      emoji VARCHAR(32),
      target_amount DECIMAL(12, 2) NOT NULL,
      current_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
      monthly_contribution_target DECIMAL(12, 2),
      target_date TIMESTAMP(3),
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS financial_goals_user_id_idx
    ON financial_goals(user_id);
  `);

  goalsTableReady = true;
};

type FinancialGoalRow = {
  id: number;
  user_id: number;
  title: string;
  emoji: string | null;
  target_amount: Prisma.Decimal | number;
  current_amount: Prisma.Decimal | number;
  monthly_contribution_target: Prisma.Decimal | number | null;
  target_date: Date | null;
  created_at: Date;
  updated_at: Date;
};

const mapGoalRow = (row: FinancialGoalRow): FinancialGoalRecord => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  emoji: row.emoji,
  targetAmount: toNumber(row.target_amount),
  currentAmount: toNumber(row.current_amount),
  monthlyContributionTarget:
    row.monthly_contribution_target == null
      ? null
      : toNumber(row.monthly_contribution_target),
  targetDate: row.target_date?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

export const listFinancialGoals = async (userId: number) => {
  await ensureFinancialGoalsTable();
  const rows = await prisma.$queryRaw<FinancialGoalRow[]>`
    SELECT
      id,
      user_id,
      title,
      emoji,
      target_amount,
      current_amount,
      monthly_contribution_target,
      target_date,
      created_at,
      updated_at
    FROM financial_goals
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return rows.map(mapGoalRow);
};

export const createFinancialGoal = async (params: {
  userId: number;
  title: string;
  emoji?: string | null;
  targetAmount: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
}) => {
  await ensureFinancialGoalsTable();
  const [row] = await prisma.$queryRaw<FinancialGoalRow[]>`
    INSERT INTO financial_goals (
      user_id,
      title,
      emoji,
      target_amount,
      current_amount,
      monthly_contribution_target,
      target_date
    )
    VALUES (
      ${params.userId},
      ${params.title},
      ${params.emoji ?? null},
      ${roundMetric(params.targetAmount, 2)},
      ${roundMetric(params.currentAmount ?? 0, 2)},
      ${
        params.monthlyContributionTarget == null
          ? null
          : roundMetric(params.monthlyContributionTarget, 2)
      },
      ${params.targetDate ? new Date(params.targetDate) : null}
    )
    RETURNING
      id,
      user_id,
      title,
      emoji,
      target_amount,
      current_amount,
      monthly_contribution_target,
      target_date,
      created_at,
      updated_at
  `;

  return row ? mapGoalRow(row) : null;
};

export const updateFinancialGoal = async (params: {
  userId: number;
  goalId: number;
  title?: string;
  emoji?: string | null;
  targetAmount?: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
}) => {
  await ensureFinancialGoalsTable();
  const [existing] = await prisma.$queryRaw<FinancialGoalRow[]>`
    SELECT
      id,
      user_id,
      title,
      emoji,
      target_amount,
      current_amount,
      monthly_contribution_target,
      target_date,
      created_at,
      updated_at
    FROM financial_goals
    WHERE id = ${params.goalId}
      AND user_id = ${params.userId}
    LIMIT 1
  `;

  if (!existing) {
    return null;
  }

  const [row] = await prisma.$queryRaw<FinancialGoalRow[]>`
    UPDATE financial_goals
    SET
      title = ${params.title ?? existing.title},
      emoji = ${params.emoji === undefined ? existing.emoji : params.emoji},
      target_amount = ${roundMetric(
        params.targetAmount ?? toNumber(existing.target_amount),
        2,
      )},
      current_amount = ${roundMetric(
        params.currentAmount ?? toNumber(existing.current_amount),
        2,
      )},
      monthly_contribution_target = ${
        params.monthlyContributionTarget === undefined
          ? existing.monthly_contribution_target
          : params.monthlyContributionTarget == null
            ? null
            : roundMetric(params.monthlyContributionTarget, 2)
      },
      target_date = ${
        params.targetDate === undefined
          ? existing.target_date
          : params.targetDate
            ? new Date(params.targetDate)
            : null
      },
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.goalId}
      AND user_id = ${params.userId}
    RETURNING
      id,
      user_id,
      title,
      emoji,
      target_amount,
      current_amount,
      monthly_contribution_target,
      target_date,
      created_at,
      updated_at
  `;

  return row ? mapGoalRow(row) : null;
};

export const deleteFinancialGoal = async (params: {
  userId: number;
  goalId: number;
}) => {
  await ensureFinancialGoalsTable();
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    DELETE FROM financial_goals
    WHERE id = ${params.goalId}
      AND user_id = ${params.userId}
    RETURNING id
  `;

  return rows.length > 0;
};

const buildMonthStats = (params: {
  monthStarts: Date[];
  inflowEntries: Array<{ amount: number; date: Date }>;
  purchases: CopilotPurchaseRecord[];
  expenseEntries: Array<{ day: Date; amount: number }>;
  extraEntries: ExtraEntryRecord[];
}) => {
  const inflowMap = new Map<string, number>();
  params.inflowEntries.forEach((entry) => {
    const key = monthKey(entry.date);
    inflowMap.set(key, (inflowMap.get(key) ?? 0) + entry.amount);
  });

  const purchaseMap = new Map<string, number>();
  params.purchases.forEach((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    const key = monthKey(effectiveDate);
    purchaseMap.set(key, (purchaseMap.get(key) ?? 0) + purchase.paidAmount);
  });

  const expenseMap = new Map<string, number>();
  params.expenseEntries.forEach((entry) => {
    const key = monthKey(entry.day);
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + entry.amount);
  });

  const extraIncomeMap = new Map<string, number>();
  const extraExpenseMap = new Map<string, number>();
  const extraLossMap = new Map<string, number>();
  const extraInvestmentMap = new Map<string, number>();
  params.extraEntries.forEach((entry) => {
    const key = monthKey(entry.date);
    switch (entry.type) {
      case "INCOME":
        extraIncomeMap.set(key, (extraIncomeMap.get(key) ?? 0) + entry.amount);
        break;
      case "EXPENSE":
        extraExpenseMap.set(key, (extraExpenseMap.get(key) ?? 0) + entry.amount);
        break;
      case "LOSS":
        extraLossMap.set(key, (extraLossMap.get(key) ?? 0) + entry.amount);
        break;
      case "INVESTMENT":
        extraInvestmentMap.set(key, (extraInvestmentMap.get(key) ?? 0) + entry.amount);
        break;
    }
  });

  return params.monthStarts.map<CopilotMonthStat>((monthStart) => {
    const key = monthKey(monthStart);
    const inflow = roundMetric(inflowMap.get(key) ?? 0, 2);
    const purchaseOutflow = roundMetric(purchaseMap.get(key) ?? 0, 2);
    const expenses = roundMetric(expenseMap.get(key) ?? 0, 2);
    const outflow = roundMetric(purchaseOutflow + expenses, 2);
    const extraIncome = roundMetric(extraIncomeMap.get(key) ?? 0, 2);
    const extraExpense = roundMetric(extraExpenseMap.get(key) ?? 0, 2);
    const extraLoss = roundMetric(extraLossMap.get(key) ?? 0, 2);
    const extraInvestment = roundMetric(extraInvestmentMap.get(key) ?? 0, 2);
    const extraNet = roundMetric(extraIncome - extraExpense - extraLoss - extraInvestment, 2);

    return {
      key,
      label: monthLabel(monthStart),
      monthStart,
      inflow,
      purchaseOutflow,
      expenses,
      outflow,
      net: roundMetric(inflow - outflow, 2),
      extraIncome,
      extraExpense,
      extraLoss,
      extraInvestment,
      extraNet,
    };
  });
};

const buildMonthStarts = (now: Date, months = 6) =>
  Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    return addMonthsUtc(startOfMonthUtc(now), -offset);
  });

export const buildCopilotDataset = async (userId: number): Promise<CopilotDataset> => {
  const now = new Date();
  const today = startOfDayUtc(now);
  const currentMonthStart = startOfMonthUtc(now);
  const nextMonthStart = addMonthsUtc(currentMonthStart, 1);
  const trailing30Start = addDaysUtc(today, -29);
  const previous30Start = addDaysUtc(trailing30Start, -30);
  const historicalWindowStart = addMonthsUtc(currentMonthStart, -5);

  const [forecast, inflowSnapshot, purchasesRaw, expenseEntries, goals, extraEntriesRaw] = await Promise.all([
    buildDashboardForecast({ userId }),
    fetchCashInflowSnapshot({
      userId,
      start: historicalWindowStart,
      endExclusive: nextMonthStart,
      debugLabel: "copilot dataset",
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        purchase_date: { gte: historicalWindowStart, lt: nextMonthStart },
      },
      orderBy: { purchase_date: "asc" },
      select: {
        id: true,
        purchase_date: true,
        paymentDate: true,
        totalAmount: true,
        paidAmount: true,
        pendingAmount: true,
        paymentStatus: true,
        notes: true,
        supplier: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            name: true,
            line_total: true,
            product: {
              select: {
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getDailyExpenses({ userId, from: historicalWindowStart }),
    listFinancialGoals(userId),
    prisma.extraEntry.findMany({
      where: {
        userId,
        date: { gte: historicalWindowStart, lt: nextMonthStart },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const purchases: CopilotPurchaseRecord[] = purchasesRaw.map((purchase) => ({
    id: purchase.id,
    purchaseDate: purchase.purchase_date,
    paymentDate: purchase.paymentDate,
    totalAmount: toNumber(purchase.totalAmount),
    paidAmount: toNumber(purchase.paidAmount),
    pendingAmount: toNumber(purchase.pendingAmount),
    paymentStatus: purchase.paymentStatus,
    notes: purchase.notes,
    supplierName: purchase.supplier?.name ?? null,
    items: purchase.items.map((item) => ({
      name: item.name,
      lineTotal: toNumber(item.line_total),
      categoryName: item.product?.category?.name ?? null,
      productName: item.product?.name ?? null,
    })),
  }));

  const extraEntries: ExtraEntryRecord[] = extraEntriesRaw.map((entry) => ({
    id: entry.id,
    title: entry.title,
    amount: toNumber(entry.amount),
    type: entry.type,
    date: entry.date,
    notes: entry.notes,
    userId: entry.userId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  const monthStats = buildMonthStats({
    monthStarts: buildMonthStarts(now),
    inflowEntries: inflowSnapshot.entries,
    purchases,
    expenseEntries,
    extraEntries,
  });

  const currentMonthStat =
    monthStats.find((entry) => entry.key === monthKey(currentMonthStart)) ?? {
      key: monthKey(currentMonthStart),
      label: monthLabel(currentMonthStart),
      monthStart: currentMonthStart,
      inflow: 0,
      purchaseOutflow: 0,
      expenses: 0,
      outflow: 0,
      net: 0,
      extraIncome: 0,
      extraExpense: 0,
      extraLoss: 0,
      extraInvestment: 0,
      extraNet: 0,
    };

  const recentInflowEntries = inflowSnapshot.entries.filter(
    (entry) => entry.date >= trailing30Start && entry.date < nextMonthStart,
  );

  return {
    now,
    today,
    currentMonthStart,
    nextMonthStart,
    trailing30Start,
    previous30Start,
    monthStats,
    currentMonthStat,
    last30MonthLikeInflow: roundMetric(sum(recentInflowEntries.map((entry) => entry.amount)), 2),
    purchases,
    pendingPurchaseAmount: roundMetric(
      sum(purchases.map((purchase) => purchase.pendingAmount)),
      2,
    ),
    forecast,
    goals,
    extraEntries,
  };
};
