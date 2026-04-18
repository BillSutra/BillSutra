import type { DashboardForecastPayload } from "../../services/dashboardForecastService.js";
import type { AssistantLanguage } from "../assistant/assistant.language.js";

export type CopilotPriority = "high" | "medium" | "low";
export type CopilotTone = "positive" | "warning" | "critical" | "info";
export type CopilotBudgetStatus = "on_track" | "caution" | "over_budget";
export type CopilotDecisionVerdict = "safe" | "warning" | "risky";
export type CopilotHealthBand =
  | "excellent"
  | "good"
  | "needs_improvement"
  | "poor";

export type CopilotMonthStat = {
  key: string;
  label: string;
  monthStart: Date;
  inflow: number;
  purchaseOutflow: number;
  expenses: number;
  outflow: number;
  net: number;
  extraIncome: number;
  extraExpense: number;
  extraLoss: number;
  extraInvestment: number;
  extraNet: number;
};

export type CopilotPurchaseRecord = {
  id: number;
  purchaseDate: Date;
  paymentDate: Date | null;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: string;
  notes: string | null;
  supplierName: string | null;
  items: Array<{
    name: string;
    lineTotal: number;
    categoryName: string | null;
    productName: string | null;
  }>;
};

export type FinancialGoalRecord = {
  id: number;
  userId: number;
  title: string;
  emoji: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContributionTarget: number | null;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExtraEntryRecord = {
  id: string;
  title: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "LOSS" | "INVESTMENT";
  date: Date;
  notes: string | null;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CopilotDataset = {
  now: Date;
  today: Date;
  currentMonthStart: Date;
  nextMonthStart: Date;
  trailing30Start: Date;
  previous30Start: Date;
  monthStats: CopilotMonthStat[];
  currentMonthStat: CopilotMonthStat;
  last30MonthLikeInflow: number;
  purchases: CopilotPurchaseRecord[];
  pendingPurchaseAmount: number;
  forecast: DashboardForecastPayload;
  goals: FinancialGoalRecord[];
  extraEntries: ExtraEntryRecord[];
};

export type CopilotBudgetInsight = {
  suggestedMonthlyBudget: number;
  remainingSafeToSpend: number;
  fixedExpensesEstimate: number;
  spentThisMonth: number;
  projectedMonthSpend: number;
  dailySafeSpend: number;
  status: CopilotBudgetStatus;
  summary: string;
  action: string;
};

export type CopilotSavingsOpportunity = {
  id: string;
  title: string;
  description: string;
  potentialMonthlySavings: number;
  category: string;
  priority: CopilotPriority;
};

export type CopilotReminderItem = {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  daysUntilDue: number | null;
  monthlyAmount: number;
  priority: CopilotPriority;
  suggestedAction: string;
  behavior: "early" | "on_time" | "late";
};

export type CopilotHealthComponent = {
  label: string;
  score: number;
  outOf: number;
};

export type CopilotHealthScore = {
  score: number;
  band: CopilotHealthBand;
  summary: string;
  nextBestAction: string;
  breakdown: CopilotHealthComponent[];
};

export type CopilotBehaviorInsight = {
  id: string;
  title: string;
  description: string;
  priority: CopilotPriority;
};

export type CopilotBehaviorInsights = {
  summary: string;
  items: CopilotBehaviorInsight[];
};

export type CopilotNudge = {
  id: string;
  tone: CopilotTone;
  message: string;
  action: string;
};

export type CopilotGoalProgress = {
  id: number;
  title: string;
  emoji: string | null;
  targetAmount: number;
  currentAmount: number;
  monthlyContributionTarget: number | null;
  targetDate: string | null;
  progressPercent: number;
  remainingAmount: number;
  projectedCompletionDate: string | null;
  monthsToGoal: number | null;
  summary: string;
};

export type CopilotGoalSummary = {
  projectedMonthlySavings: number;
  summary: string;
  items: CopilotGoalProgress[];
};

export type CopilotDecision = {
  amount: number;
  verdict: CopilotDecisionVerdict;
  summary: string;
  explanation: string;
  suggestedDelayDays: number;
  impactOnBudget: number;
  safeRoomAfterPurchase: number;
  reserveForUpcomingExpenses: number;
  currentBalanceEstimate: number;
  projectedClosingBalance: number;
};

export type FinancialCopilotPayload = {
  generatedAt: string;
  language: AssistantLanguage;
  overview: {
    headline: string;
    summary: string;
    action: string;
  };
  budget: CopilotBudgetInsight;
  savings: {
    summary: string;
    monthlySavingsPotential: number;
    opportunities: CopilotSavingsOpportunity[];
  };
  reminders: {
    summary: string;
    items: CopilotReminderItem[];
  };
  healthScore: CopilotHealthScore;
  behaviorInsights: CopilotBehaviorInsights;
  nudges: CopilotNudge[];
  goals: CopilotGoalSummary;
  decision: CopilotDecision | null;
  examples: string[];
};
