import { InvoiceStatus, SaleStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";
import {
  fetchCashInflowSnapshot,
  getDailyExpenses,
} from "../../services/dashboardAnalyticsService.js";
import { buildFinancialCopilot } from "../copilot/copilot.service.js";
import { formatCopilotCurrency } from "../copilot/copilot.language.js";
import {
  detectAssistantLanguage,
  type AssistantLanguage,
} from "./assistant.language.js";

type AssistantIntent =
  | "profit"
  | "total_sales"
  | "pending_payments"
  | "cashflow"
  | "top_spend"
  | "vendor_spend"
  | "budget_plan"
  | "savings_suggestion"
  | "bill_reminder"
  | "health_score"
  | "behavior_insights"
  | "goal_tracking"
  | "affordability"
  | "help";

type AssistantHistoryMessage = {
  role: "assistant" | "user";
  content: string;
};

type AssistantPeriodKey =
  | "today"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month";

type AssistantPeriod = {
  key: AssistantPeriodKey;
  start: Date;
  endExclusive: Date;
};

type AssistantFinanceSnapshot = {
  period: AssistantPeriod;
  totalSales: number;
  purchasePayments: number;
  expenses: number;
  totalOutflow: number;
  profit: number;
  pendingPayments: number;
  cashflowInflow: number;
  cashflowOutflow: number;
  cashflowNet: number;
  purchaseCount: number;
  salesCount: number;
};

type AssistantPurchaseRecord = {
  id: number;
  purchase_date: Date;
  paymentDate: Date | null;
  total: unknown;
  totalAmount: unknown;
  paidAmount: unknown;
  paymentStatus: string;
  notes: string | null;
  supplier: { name: string | null } | null;
  items: Array<{
    name: string;
    line_total: unknown;
    product: {
      name: string;
      category: { name: string } | null;
    } | null;
  }>;
};

type AssistantTopSpend = {
  name: string;
  amount: number;
  purchaseCount: number;
  shareOfOutflow: number;
  source: "category" | "supplier";
};

type AssistantSpendMatch = {
  name: string;
  amount: number;
  purchaseCount: number;
  shareOfOutflow: number;
};

type AssistantParsedQuery = {
  language: AssistantLanguage;
  intent: AssistantIntent;
  period: AssistantPeriod;
  amount: number | null;
  entity: string | null;
  conversationMessage: string;
  usedHistory: boolean;
};

export type AssistantReply = {
  language: AssistantLanguage;
  intent: AssistantIntent;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  examples: string[];
};

const SYNCED_INVOICE_NOTE_PATTERN = /Synced from invoice\s+/i;
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;

const PROFIT_KEYWORDS = [
  "profit",
  "margin",
  "profitability",
  "munafa",
  "labh",
  "लाभ",
  "मुनाफा",
  "प्रॉफिट",
];

const SALES_KEYWORDS = [
  "sales",
  "sale",
  "revenue",
  "receipt",
  "receipts",
  "bikri",
  "बिक्री",
  "सेल्स",
];

const PENDING_KEYWORDS = [
  "pending",
  "outstanding",
  "receivable",
  "receivables",
  "dues",
  "collection",
  "bakaya",
  "baki",
  "बाकी",
  "बकाया",
  "pending payment",
];

const CASHFLOW_KEYWORDS = [
  "cashflow",
  "cash flow",
  "inflow",
  "outflow",
  "net cash",
  "cash position",
  "nakdi",
  "नकदी",
  "कैशफ्लो",
];

const SPEND_KEYWORDS = [
  "spend",
  "spent",
  "expense",
  "expenses",
  "kharch",
  "खर्च",
  "pay",
  "paid",
  "order",
  "payment",
];

const TOP_SPEND_KEYWORDS = [
  "sabse zyada",
  "most",
  "highest",
  "top spend",
  "top expense",
  "kis cheez",
  "where is my money going",
  "paisa kis",
  "जा रहा",
];

const AFFORDABILITY_KEYWORDS = [
  "afford",
  "can i buy",
  "can i spend",
  "manage",
  "budget",
  "kharid",
  "ले सकता",
  "ले सकती",
  "afford kar",
  "sakta hoon",
  "sakti hoon",
];

const BUDGET_KEYWORDS = [
  "budget",
  "safe budget",
  "monthly budget",
  "weekly budget",
  "limit",
  "budget plan",
  "kharch limit",
  "budget kitna",
];

const SAVINGS_KEYWORDS = [
  "save",
  "saving",
  "savings",
  "bachat",
  "reduce expense",
  "reduce spend",
  "save more",
];

const REMINDER_KEYWORDS = [
  "bill",
  "bill due",
  "reminder",
  "autopay",
  "auto-pay",
  "subscription",
  "rent",
  "electricity",
  "due",
];

const HEALTH_KEYWORDS = [
  "health score",
  "financial health",
  "financial score",
  "money health",
  "score",
];

const BEHAVIOR_KEYWORDS = [
  "behavior",
  "behaviour",
  "habit",
  "habits",
  "pattern",
  "patterns",
  "weekend spend",
  "late night",
  "late-night",
  "spending habit",
];

const GOAL_KEYWORDS = [
  "goal",
  "trip",
  "vacation",
  "gadget",
  "save for",
  "target",
  "goal progress",
];

const FOLLOW_UP_KEYWORDS = [
  "aur",
  "or",
  "what about",
  "usme",
  "uska",
  "same",
  "then",
  "last month",
  "this month",
  "pichle",
  "is mahine",
  "आज",
  "aaj",
];

const HELP_EXAMPLES: Record<AssistantLanguage, string[]> = {
  en: [
    "How much did I spend on Swiggy last month?",
    "What is my profit this month?",
    "Which category is taking most of my money?",
    "Can I afford ₹10,000 this month?",
  ],
  hi: [
    "मैंने पिछले महीने Swiggy पर कितना खर्च किया?",
    "इस महीने मेरा profit कितना है?",
    "मेरा सबसे ज़्यादा पैसा किस category पर जा रहा है?",
    "क्या मैं इस महीने ₹10,000 afford कर सकता हूँ?",
  ],
  hinglish: [
    "Maine last month Swiggy pe kitna spend kiya?",
    "Is month mera profit kitna hai?",
    "Mera sabse zyada paisa kis category pe ja raha hai?",
    "Main ₹10,000 afford kar sakta hoon kya?",
  ],
};

const toNumber = (value: unknown) => Number(value ?? 0);

const roundMetric = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

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

const formatCurrency = (value: number, language: AssistantLanguage) =>
  new Intl.NumberFormat(language === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPeriodLabel = (
  period: AssistantPeriod,
  language: AssistantLanguage,
) => {
  if (period.key === "today") {
    return language === "hi" ? "आज" : language === "hinglish" ? "aaj" : "today";
  }

  if (period.key === "this_week") {
    return language === "hi"
      ? "इस हफ्ते"
      : language === "hinglish"
        ? "is week"
        : "this week";
  }

  if (period.key === "last_week") {
    return language === "hi"
      ? "पिछले हफ्ते"
      : language === "hinglish"
        ? "last week"
        : "last week";
  }

  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(period.start);
};

const hasKeyword = (message: string, keywords: string[]) => {
  const normalized = normalizeText(message);
  return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const containsDevanagari = (message: string) => DEVANAGARI_PATTERN.test(message);

const isSyncedInvoiceSale = (notes: string | null | undefined) =>
  SYNCED_INVOICE_NOTE_PATTERN.test(notes ?? "");

const resolveInvoicePaidAmount = (invoice: {
  total: unknown;
  status: InvoiceStatus | string;
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

  return invoice.status === InvoiceStatus.PAID ? total : 0;
};

const resolveInvoicePendingAmount = (invoice: {
  total: unknown;
  status: InvoiceStatus | string;
  payments: Array<{ amount: unknown }>;
}) => {
  if (invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID) {
    return 0;
  }

  return Math.max(0, toNumber(invoice.total) - resolveInvoicePaidAmount(invoice));
};

const resolvePurchaseRealizedAmount = (purchase: {
  paymentStatus: string;
  totalAmount: unknown;
  paidAmount: unknown;
  total: unknown;
}) => {
  if (purchase.paymentStatus === "PAID") {
    return roundMetric(
      Math.max(0, toNumber(purchase.totalAmount) || toNumber(purchase.total)),
    );
  }

  if (purchase.paymentStatus === "PARTIALLY_PAID") {
    return roundMetric(Math.max(0, toNumber(purchase.paidAmount)));
  }

  return 0;
};

const resolveAllocationRatio = (purchase: AssistantPurchaseRecord) => {
  const realizedAmount = resolvePurchaseRealizedAmount(purchase);
  const totalAmount = toNumber(purchase.totalAmount) || toNumber(purchase.total);

  if (realizedAmount <= 0 || totalAmount <= 0) {
    return 0;
  }

  return Math.min(1, realizedAmount / totalAmount);
};

const resolveConversationMessage = (
  message: string,
  history: AssistantHistoryMessage[],
) => {
  const normalized = normalizeText(message);
  const recentUserMessage = [...history]
    .reverse()
    .find((entry) => entry.role === "user" && entry.content.trim().length > 0);

  const shouldUseHistory =
    !!recentUserMessage &&
    (message.trim().length <= 28 ||
      FOLLOW_UP_KEYWORDS.some((keyword) => normalized.includes(keyword)));

  if (!shouldUseHistory || !recentUserMessage) {
    return {
      conversationMessage: message,
      usedHistory: false,
    };
  }

  // Preserve the latest wording while borrowing missing context from the previous user turn.
  return {
    conversationMessage: `${recentUserMessage.content} ${message}`.trim(),
    usedHistory: true,
  };
};

const resolveAssistantPeriod = (message: string) => {
  const now = new Date();
  const todayStart = startOfDayUtc(now);
  const tomorrow = addDaysUtc(todayStart, 1);
  const thisWeekStart = startOfWeekUtc(now);
  const lastWeekStart = addDaysUtc(thisWeekStart, -7);
  const thisMonthStart = startOfMonthUtc(now);
  const lastMonthStart = startOfMonthUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  );
  const nextMonthStart = startOfMonthUtc(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  );

  if (hasKeyword(message, ["today", "aaj", "आज"])) {
    return {
      key: "today",
      start: todayStart,
      endExclusive: tomorrow,
    } satisfies AssistantPeriod;
  }

  if (
    hasKeyword(message, [
      "last week",
      "previous week",
      "pichle hafte",
      "pichla hafta",
      "पिछले हफ्ते",
    ])
  ) {
    return {
      key: "last_week",
      start: lastWeekStart,
      endExclusive: thisWeekStart,
    } satisfies AssistantPeriod;
  }

  if (
    hasKeyword(message, [
      "this week",
      "is week",
      "iss week",
      "is hafte",
      "इस हफ्ते",
    ])
  ) {
    return {
      key: "this_week",
      start: thisWeekStart,
      endExclusive: tomorrow,
    } satisfies AssistantPeriod;
  }

  if (
    hasKeyword(message, [
      "last month",
      "previous month",
      "pichle mahine",
      "pichla mahina",
      "पिछले महीने",
    ])
  ) {
    return {
      key: "last_month",
      start: lastMonthStart,
      endExclusive: thisMonthStart,
    } satisfies AssistantPeriod;
  }

  return {
    key: "this_month",
    start: thisMonthStart,
    endExclusive: nextMonthStart > tomorrow ? tomorrow : nextMonthStart,
  } satisfies AssistantPeriod;
};

const extractAmount = (message: string) => {
  const match = message.replace(/,/g, "").match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const cleanExtractedEntity = (value: string) =>
  value
    .replace(
      /\b(last|this|month|week|today|kitna|kitni|kitne|spend|spent|expense|expenses|kharch|hai|tha|kiya|kya|afford|kar|sakta|sakti)\b/gi,
      " ",
    )
    .replace(/[?.,!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractEntity = (message: string) => {
  const latinPatterns = [
    /(?:on|at|from|for)\s+([a-z][a-z0-9&\-\s]{1,50}?)(?=\s+(?:last|this|today|kitna|kitni|kitne|spend|spent|expense|expenses|week|month|hai|tha|kiya|kya|$))/i,
    /([a-z][a-z0-9&\-\s]{1,50}?)\s+(?:pe|par)\s+(?:kitna|kitni|kitne|spend|kharch|expense)/i,
  ];

  for (const pattern of latinPatterns) {
    const match = message.match(pattern);
    const candidate = cleanExtractedEntity(match?.[1] ?? "");
    if (candidate.length >= 2) {
      return candidate;
    }
  }

  return null;
};

const detectIntent = (message: string, amount: number | null, entity: string | null) => {
  if (amount !== null && hasKeyword(message, AFFORDABILITY_KEYWORDS)) {
    return "affordability" satisfies AssistantIntent;
  }

  if (hasKeyword(message, HEALTH_KEYWORDS)) {
    return "health_score" satisfies AssistantIntent;
  }

  if (hasKeyword(message, BEHAVIOR_KEYWORDS)) {
    return "behavior_insights" satisfies AssistantIntent;
  }

  if (hasKeyword(message, GOAL_KEYWORDS)) {
    return "goal_tracking" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SAVINGS_KEYWORDS)) {
    return "savings_suggestion" satisfies AssistantIntent;
  }

  if (hasKeyword(message, REMINDER_KEYWORDS)) {
    return "bill_reminder" satisfies AssistantIntent;
  }

  if (hasKeyword(message, BUDGET_KEYWORDS)) {
    return "budget_plan" satisfies AssistantIntent;
  }

  if (hasKeyword(message, TOP_SPEND_KEYWORDS)) {
    return "top_spend" satisfies AssistantIntent;
  }

  if (entity && hasKeyword(message, SPEND_KEYWORDS)) {
    return "vendor_spend" satisfies AssistantIntent;
  }

  if (hasKeyword(message, PENDING_KEYWORDS)) {
    return "pending_payments" satisfies AssistantIntent;
  }

  if (hasKeyword(message, CASHFLOW_KEYWORDS)) {
    return "cashflow" satisfies AssistantIntent;
  }

  if (hasKeyword(message, PROFIT_KEYWORDS)) {
    return "profit" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SALES_KEYWORDS)) {
    return "total_sales" satisfies AssistantIntent;
  }

  return "help" satisfies AssistantIntent;
};

const buildAssistantSnapshot = async (
  userId: number,
  period: AssistantPeriod,
): Promise<{
  snapshot: AssistantFinanceSnapshot;
  purchases: AssistantPurchaseRecord[];
}> => {
  const [salesSnapshot, purchases, expenseRows, sales, invoices] = await Promise.all([
    fetchCashInflowSnapshot({
      userId,
      start: period.start,
      endExclusive: period.endExclusive,
      debugLabel: "assistant conversational snapshot",
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        OR: [
          { paymentDate: { gte: period.start, lt: period.endExclusive } },
          {
            paymentDate: null,
            purchase_date: { gte: period.start, lt: period.endExclusive },
          },
        ],
      },
      select: {
        id: true,
        purchase_date: true,
        paymentDate: true,
        total: true,
        totalAmount: true,
        paidAmount: true,
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
    getDailyExpenses({ userId, from: period.start }),
    prisma.sale.findMany({
      where: {
        user_id: userId,
        status: SaleStatus.COMPLETED,
        sale_date: { gte: period.start, lt: period.endExclusive },
      },
      select: {
        pendingAmount: true,
        notes: true,
      },
    }),
    prisma.invoice.findMany({
      where: {
        user_id: userId,
        date: { gte: period.start, lt: period.endExclusive },
        status: {
          in: [
            InvoiceStatus.SENT,
            InvoiceStatus.PARTIALLY_PAID,
            InvoiceStatus.OVERDUE,
            InvoiceStatus.PAID,
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

  const purchasePayments = roundMetric(
    purchases.reduce((sum, purchase) => sum + resolvePurchaseRealizedAmount(purchase), 0),
  );
  const expenses = roundMetric(
    expenseRows
      .filter((row) => row.day >= period.start && row.day < period.endExclusive)
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const pendingSales = roundMetric(
    sales
      .filter((sale) => !isSyncedInvoiceSale(sale.notes))
      .reduce((sum, sale) => sum + Math.max(0, toNumber(sale.pendingAmount)), 0),
  );
  const pendingInvoices = roundMetric(
    invoices.reduce((sum, invoice) => sum + resolveInvoicePendingAmount(invoice), 0),
  );
  const totalOutflow = roundMetric(purchasePayments + expenses);
  const totalSales = roundMetric(salesSnapshot.total);

  return {
    snapshot: {
      period,
      totalSales,
      purchasePayments,
      expenses,
      totalOutflow,
      profit: roundMetric(totalSales - totalOutflow),
      pendingPayments: roundMetric(pendingSales + pendingInvoices),
      cashflowInflow: totalSales,
      cashflowOutflow: totalOutflow,
      cashflowNet: roundMetric(totalSales - totalOutflow),
      purchaseCount: purchases.filter(
        (purchase) => resolvePurchaseRealizedAmount(purchase) > 0,
      ).length,
      salesCount: salesSnapshot.entries.length,
    },
    purchases,
  };
};

const buildHighlights = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
  intent: AssistantIntent,
  extra?: {
    spendMatch?: AssistantSpendMatch | null;
    topSpend?: AssistantTopSpend | null;
    requestedAmount?: number | null;
    copilotSummary?: Awaited<ReturnType<typeof buildFinancialCopilot>> | null;
  },
) => {
  if (intent === "budget_plan" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Safe budget" : "Safe budget",
        value: formatCopilotCurrency(
          extra.copilotSummary.budget.suggestedMonthlyBudget,
          language,
        ),
      },
      {
        label: language === "hi" ? "बाकी room" : language === "hinglish" ? "Safe room" : "Safe room",
        value: formatCopilotCurrency(
          Math.max(extra.copilotSummary.budget.remainingSafeToSpend, 0),
          language,
        ),
      },
      {
        label: language === "hi" ? "Daily pace" : language === "hinglish" ? "Daily pace" : "Daily pace",
        value: formatCopilotCurrency(
          extra.copilotSummary.budget.dailySafeSpend,
          language,
        ),
      },
    ];
  }

  if (intent === "savings_suggestion" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Savings" : "Savings",
        value: formatCopilotCurrency(
          extra.copilotSummary.savings.monthlySavingsPotential,
          language,
        ),
      },
      {
        label: language === "hi" ? "Top idea" : language === "hinglish" ? "Top idea" : "Top idea",
        value: extra.copilotSummary.savings.opportunities[0]?.category ?? "--",
      },
    ];
  }

  if (intent === "bill_reminder" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Next bill" : language === "hinglish" ? "Next bill" : "Next bill",
        value: extra.copilotSummary.reminders.items[0]?.title ?? "--",
      },
      {
        label: language === "hi" ? "Amount" : "Amount",
        value: formatCopilotCurrency(
          extra.copilotSummary.reminders.items[0]?.monthlyAmount ?? 0,
          language,
        ),
      },
    ];
  }

  if (intent === "health_score" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Score" : "Score",
        value: `${extra.copilotSummary.healthScore.score}/100`,
      },
      {
        label: language === "hi" ? "Band" : "Band",
        value: extra.copilotSummary.healthScore.band,
      },
    ];
  }

  if (intent === "behavior_insights" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Pattern" : language === "hinglish" ? "Pattern" : "Pattern",
        value: extra.copilotSummary.behaviorInsights.items[0]?.title ?? "--",
      },
      {
        label: language === "hi" ? "Watch" : language === "hinglish" ? "Watch" : "Watch",
        value: extra.copilotSummary.behaviorInsights.items[1]?.title ?? "--",
      },
    ];
  }

  if (intent === "goal_tracking" && extra?.copilotSummary) {
    return [
      {
        label: language === "hi" ? "Monthly save" : language === "hinglish" ? "Monthly save" : "Monthly save",
        value: formatCopilotCurrency(
          extra.copilotSummary.goals.projectedMonthlySavings,
          language,
        ),
      },
      {
        label: language === "hi" ? "Goal" : "Goal",
        value: extra.copilotSummary.goals.items[0]?.title ?? "--",
      },
    ];
  }

  if (intent === "vendor_spend" && extra?.spendMatch) {
    return [
      {
        label:
          language === "hi"
            ? "खर्च"
            : language === "hinglish"
              ? "Spend"
              : "Spend",
        value: formatCurrency(extra.spendMatch.amount, language),
      },
      {
        label:
          language === "hi"
            ? "खरीद एंट्री"
            : language === "hinglish"
              ? "Entries"
              : "Entries",
        value: String(extra.spendMatch.purchaseCount),
      },
      {
        label:
          language === "hi"
            ? "आउटफ्लो शेयर"
            : language === "hinglish"
              ? "Outflow share"
              : "Outflow share",
        value: `${roundMetric(extra.spendMatch.shareOfOutflow, 1)}%`,
      },
    ];
  }

  if (intent === "top_spend" && extra?.topSpend) {
    return [
      {
        label:
          language === "hi"
            ? "टॉप bucket"
            : language === "hinglish"
              ? "Top bucket"
              : "Top bucket",
        value: extra.topSpend.name,
      },
      {
        label:
          language === "hi"
            ? "खर्च"
            : language === "hinglish"
              ? "Spend"
              : "Spend",
        value: formatCurrency(extra.topSpend.amount, language),
      },
      {
        label:
          language === "hi"
            ? "शेयर"
            : language === "hinglish"
              ? "Share"
              : "Share",
        value: `${roundMetric(extra.topSpend.shareOfOutflow, 1)}%`,
      },
    ];
  }

  if (intent === "affordability" && extra?.requestedAmount != null) {
    const requestedAmount = extra?.requestedAmount ?? 0;
    return [
      {
        label:
          language === "hi"
            ? "राशि"
            : language === "hinglish"
              ? "Amount"
              : "Amount",
        value: formatCurrency(requestedAmount, language),
      },
      {
        label:
          language === "hi"
            ? "नेट cashflow"
            : language === "hinglish"
              ? "Net cashflow"
              : "Net cashflow",
        value: formatCurrency(snapshot.cashflowNet, language),
      },
      {
        label:
          language === "hi"
            ? "बाकी पेमेंट"
            : language === "hinglish"
              ? "Pending"
              : "Pending",
        value: formatCurrency(snapshot.pendingPayments, language),
      },
    ];
  }

  if (intent === "profit") {
    return [
      {
        label: "Profit",
        value: formatCurrency(snapshot.profit, language),
      },
      {
        label: "Sales",
        value: formatCurrency(snapshot.totalSales, language),
      },
      {
        label:
          language === "hi"
            ? "कुल खर्च"
            : language === "hinglish"
              ? "Total outflow"
              : "Total outflow",
        value: formatCurrency(snapshot.totalOutflow, language),
      },
    ];
  }

  if (intent === "pending_payments") {
    return [
      {
        label:
          language === "hi"
            ? "बाकी पेमेंट"
            : language === "hinglish"
              ? "Pending payments"
              : "Pending payments",
        value: formatCurrency(snapshot.pendingPayments, language),
      },
      {
        label: "Sales",
        value: formatCurrency(snapshot.totalSales, language),
      },
    ];
  }

  if (intent === "cashflow") {
    return [
      {
        label: "Inflow",
        value: formatCurrency(snapshot.cashflowInflow, language),
      },
      {
        label: "Outflow",
        value: formatCurrency(snapshot.cashflowOutflow, language),
      },
      {
        label: "Net",
        value: formatCurrency(snapshot.cashflowNet, language),
      },
    ];
  }

  return [
    {
      label: "Sales",
      value: formatCurrency(snapshot.totalSales, language),
    },
    {
      label: "Profit",
      value: formatCurrency(snapshot.profit, language),
    },
    {
      label:
        language === "hi"
          ? "बाकी"
          : language === "hinglish"
            ? "Pending"
            : "Pending",
      value: formatCurrency(snapshot.pendingPayments, language),
    },
  ];
};

const buildExamples = (language: AssistantLanguage) => HELP_EXAMPLES[language];

const findSpendMatch = (
  purchases: AssistantPurchaseRecord[],
  entity: string,
  totalOutflow: number,
): AssistantSpendMatch | null => {
  const normalizedEntity = normalizeText(entity);
  if (normalizedEntity.length < 2) {
    return null;
  }

  let amount = 0;
  let purchaseCount = 0;
  const labelTotals = new Map<string, number>();

  for (const purchase of purchases) {
    const realizedAmount = resolvePurchaseRealizedAmount(purchase);
    if (realizedAmount <= 0) continue;

    const supplierName = purchase.supplier?.name?.trim() ?? "";
    const notes = purchase.notes?.trim() ?? "";
    const supplierMatch = supplierName && normalizeText(supplierName).includes(normalizedEntity);
    const noteMatch = notes && normalizeText(notes).includes(normalizedEntity);

    if (supplierMatch || noteMatch) {
      amount += realizedAmount;
      purchaseCount += 1;
      const label = supplierMatch ? supplierName : entity;
      labelTotals.set(label, (labelTotals.get(label) ?? 0) + realizedAmount);
      continue;
    }

    const allocationRatio = resolveAllocationRatio(purchase);
    if (allocationRatio <= 0) continue;

    let purchaseItemAmount = 0;
    for (const item of purchase.items) {
      const candidates = [
        item.name,
        item.product?.name ?? "",
        item.product?.category?.name ?? "",
      ]
        .map((value) => value.trim())
        .filter(Boolean);

      const matchedLabel = candidates.find((candidate) =>
        normalizeText(candidate).includes(normalizedEntity),
      );
      if (!matchedLabel) continue;

      const lineAmount = roundMetric(toNumber(item.line_total) * allocationRatio);
      if (lineAmount <= 0) continue;

      purchaseItemAmount += lineAmount;
      labelTotals.set(
        matchedLabel,
        (labelTotals.get(matchedLabel) ?? 0) + lineAmount,
      );
    }

    if (purchaseItemAmount > 0) {
      amount += purchaseItemAmount;
      purchaseCount += 1;
    }
  }

  if (amount <= 0) {
    return null;
  }

  const bestLabel =
    [...labelTotals.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    entity;

  return {
    name: bestLabel,
    amount: roundMetric(amount),
    purchaseCount,
    shareOfOutflow: totalOutflow > 0 ? roundMetric((amount / totalOutflow) * 100, 1) : 0,
  };
};

const findTopSpend = (
  purchases: AssistantPurchaseRecord[],
  totalOutflow: number,
): AssistantTopSpend | null => {
  const categoryTotals = new Map<string, { amount: number; purchaseIds: Set<number> }>();
  const supplierTotals = new Map<string, { amount: number; purchaseIds: Set<number> }>();

  for (const purchase of purchases) {
    const realizedAmount = resolvePurchaseRealizedAmount(purchase);
    if (realizedAmount <= 0) continue;

    const supplierName = purchase.supplier?.name?.trim() || "Unknown supplier";
    const existingSupplier = supplierTotals.get(supplierName) ?? {
      amount: 0,
      purchaseIds: new Set<number>(),
    };
    existingSupplier.amount += realizedAmount;
    existingSupplier.purchaseIds.add(purchase.id);
    supplierTotals.set(supplierName, existingSupplier);

    const allocationRatio = resolveAllocationRatio(purchase);
    for (const item of purchase.items) {
      const categoryName = item.product?.category?.name?.trim() || "Uncategorized";
      const lineAmount = roundMetric(toNumber(item.line_total) * allocationRatio);
      if (lineAmount <= 0) continue;

      const current = categoryTotals.get(categoryName) ?? {
        amount: 0,
        purchaseIds: new Set<number>(),
      };
      current.amount += lineAmount;
      current.purchaseIds.add(purchase.id);
      categoryTotals.set(categoryName, current);
    }
  }

  const topCategory = [...categoryTotals.entries()]
    .map(([name, value]) => ({
      name,
      amount: roundMetric(value.amount),
      purchaseCount: value.purchaseIds.size,
      shareOfOutflow:
        totalOutflow > 0 ? roundMetric((value.amount / totalOutflow) * 100, 1) : 0,
      source: "category" as const,
    }))
    .sort((left, right) => right.amount - left.amount)[0];

  if (topCategory) {
    return topCategory;
  }

  const topSupplier = [...supplierTotals.entries()]
    .map(([name, value]) => ({
      name,
      amount: roundMetric(value.amount),
      purchaseCount: value.purchaseIds.size,
      shareOfOutflow:
        totalOutflow > 0 ? roundMetric((value.amount / totalOutflow) * 100, 1) : 0,
      source: "supplier" as const,
    }))
    .sort((left, right) => right.amount - left.amount)[0];

  return topSupplier ?? null;
};

const buildProfitAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);
  const positive = snapshot.profit >= 0;

  if (language === "hi") {
    return `आपका ${periodLabel} का profit ${formatCurrency(
      snapshot.profit,
      language,
    )} है। Sales ${formatCurrency(
      snapshot.totalSales,
      language,
    )} रही और कुल outflow ${formatCurrency(
      snapshot.totalOutflow,
      language,
    )} रहा, इसलिए net result ${positive ? "positive" : "negative"} है।`;
  }

  if (language === "hinglish") {
    return `Aapka ${periodLabel} profit ${formatCurrency(
      snapshot.profit,
      language,
    )} hai. Sales ${formatCurrency(
      snapshot.totalSales,
      language,
    )} rahi aur total outflow ${formatCurrency(
      snapshot.totalOutflow,
      language,
    )} raha, isliye net result ${positive ? "positive" : "tight"} side par hai.`;
  }

  return `Your profit for ${periodLabel} is ${formatCurrency(
    snapshot.profit,
    language,
  )}. Sales came in at ${formatCurrency(
    snapshot.totalSales,
    language,
  )} and total outflow was ${formatCurrency(
    snapshot.totalOutflow,
    language,
  )}, so the net result is ${positive ? "positive" : "under pressure"}.`;
};

const buildSalesAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);

  if (language === "hi") {
    return `${periodLabel} में आपकी total sales receipts ${formatCurrency(
      snapshot.totalSales,
      language,
    )} हैं। इसमें paid sales और invoice collections दोनों शामिल हैं, इसलिए यह cash-in view देता है।`;
  }

  if (language === "hinglish") {
    return `${periodLabel} mein aapki total sales receipts ${formatCurrency(
      snapshot.totalSales,
      language,
    )} hain. Isme paid sales aur invoice collections dono include hain, isliye yeh actual cash-in picture dikhata hai.`;
  }

  return `Your total sales receipts for ${periodLabel} are ${formatCurrency(
    snapshot.totalSales,
    language,
  )}. This includes paid sales and invoice collections, so it reflects actual cash coming in.`;
};

const buildPendingAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);

  if (language === "hi") {
    return `${periodLabel} के लिए आपकी बाकी payments ${formatCurrency(
      snapshot.pendingPayments,
      language,
    )} हैं। अगर यह amount लगातार high रह रही है, तो collection follow-up थोड़ा तेज करना useful रहेगा।`;
  }

  if (language === "hinglish") {
    return `${periodLabel} ke liye aapki pending payments ${formatCurrency(
      snapshot.pendingPayments,
      language,
    )} hain. Agar yeh amount lagatar high rahe, to collection follow-up thoda fast karna useful rahega.`;
  }

  return `Your pending payments for ${periodLabel} are ${formatCurrency(
    snapshot.pendingPayments,
    language,
  )}. If this stays high, it is a good signal to push collections a bit faster.`;
};

const buildCashflowAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);
  const tone =
    snapshot.cashflowNet >= 0
      ? language === "hi"
        ? "संतुलित"
        : language === "hinglish"
          ? "manageable"
          : "healthy"
      : language === "hi"
        ? "दबाव में"
        : language === "hinglish"
          ? "tight"
          : "under pressure";

  if (language === "hi") {
    return `${periodLabel} का आपका cashflow ${tone} है। Inflow ${formatCurrency(
      snapshot.cashflowInflow,
      language,
    )} है, outflow ${formatCurrency(
      snapshot.cashflowOutflow,
      language,
    )} है, और net ${formatCurrency(snapshot.cashflowNet, language)} है।`;
  }

  if (language === "hinglish") {
    return `${periodLabel} ka aapka cashflow ${tone} hai. Inflow ${formatCurrency(
      snapshot.cashflowInflow,
      language,
    )} hai, outflow ${formatCurrency(
      snapshot.cashflowOutflow,
      language,
    )} hai, aur net ${formatCurrency(snapshot.cashflowNet, language)} hai.`;
  }

  return `Your cashflow for ${periodLabel} is ${tone}. Inflow is ${formatCurrency(
    snapshot.cashflowInflow,
    language,
  )}, outflow is ${formatCurrency(
    snapshot.cashflowOutflow,
    language,
  )}, and net cashflow is ${formatCurrency(snapshot.cashflowNet, language)}.`;
};

const buildVendorSpendAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
  entity: string,
  match: AssistantSpendMatch | null,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);

  if (!match) {
    if (language === "hi") {
      return `मुझे ${periodLabel} में "${entity}" के नाम से कोई tracked spend नहीं मिला। हो सकता है यह supplier, product, category या notes में किसी दूसरे नाम से saved हो।`;
    }

    if (language === "hinglish") {
      return `Mujhe ${periodLabel} mein "${entity}" naam se koi tracked spend nahi mila. Ho sakta hai yeh supplier, product, category ya notes mein kisi aur naam se saved ho.`;
    }

    return `I could not find any tracked spend for "${entity}" in ${periodLabel}. It may be saved under a different supplier, product, category, or note name.`;
  }

  if (language === "hi") {
    return `${periodLabel} में आपने ${match.name} पर ${formatCurrency(
      match.amount,
      language,
    )} spend किया। यह आपकी tracked outflow का लगभग ${roundMetric(
      match.shareOfOutflow,
      1,
    )}% है और ${match.purchaseCount} purchase entries में दिख रहा है।`;
  }

  if (language === "hinglish") {
    return `${periodLabel} mein aapne ${match.name} par ${formatCurrency(
      match.amount,
      language,
    )} spend kiya. Yeh aapki tracked outflow ka lagbhag ${roundMetric(
      match.shareOfOutflow,
      1,
    )}% hai aur ${match.purchaseCount} purchase entries mein dikh raha hai.`;
  }

  return `You spent ${formatCurrency(
    match.amount,
    language,
  )} on ${match.name} in ${periodLabel}. That is about ${roundMetric(
    match.shareOfOutflow,
    1,
  )}% of your tracked outflow across ${match.purchaseCount} purchase entries.`;
};

const buildTopSpendAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
  topSpend: AssistantTopSpend | null,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);

  if (!topSpend) {
    if (language === "hi") {
      return `${periodLabel} के लिए spend breakdown निकालने लायक purchase data अभी काफी नहीं है। जैसे ही category या supplier entries बढ़ेंगी, मैं इसे और clearly बता पाऊँगा।`;
    }

    if (language === "hinglish") {
      return `${periodLabel} ke liye spend breakdown nikalne layak purchase data abhi kaafi nahi hai. Jaise hi category ya supplier entries badhengi, main ise aur clearly bata paunga.`;
    }

    return `There is not enough purchase breakdown data for ${periodLabel} yet. Once more category or supplier entries are tracked, I can explain this more clearly.`;
  }

  const sourceLabel = topSpend.source === "category" ? "category" : "supplier";

  if (language === "hi") {
    return `${periodLabel} में आपका सबसे ज़्यादा पैसा ${topSpend.name} ${sourceLabel} पर जा रहा है। वहाँ ${formatCurrency(
      topSpend.amount,
      language,
    )} spend हुआ, जो total tracked outflow का लगभग ${roundMetric(
      topSpend.shareOfOutflow,
      1,
    )}% है।`;
  }

  if (language === "hinglish") {
    return `${periodLabel} mein aapka sabse zyada paisa ${topSpend.name} ${sourceLabel} pe ja raha hai. Wahan ${formatCurrency(
      topSpend.amount,
      language,
    )} spend hua, jo total tracked outflow ka lagbhag ${roundMetric(
      topSpend.shareOfOutflow,
      1,
    )}% hai.`;
  }

  return `Most of your money is going into ${topSpend.name} ${sourceLabel} in ${periodLabel}. Spend there is ${formatCurrency(
    topSpend.amount,
    language,
  )}, which is about ${roundMetric(topSpend.shareOfOutflow, 1)}% of your tracked outflow.`;
};

const buildAffordabilityAnswer = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
  amount: number | null,
) => {
  const periodLabel = formatPeriodLabel(snapshot.period, language);

  if (amount === null) {
    if (language === "hi") {
      return "ज़रूर, बस amount भी लिख दीजिए. जैसे: क्या मैं ₹10,000 afford कर सकता हूँ?";
    }

    if (language === "hinglish") {
      return "Bilkul, bas amount bhi likh do. Jaise: Main ₹10,000 afford kar sakta hoon kya?";
    }

    return "Sure, just include the amount too. For example: Can I afford ₹10,000 this month?";
  }

  const net = snapshot.cashflowNet;
  const status =
    net >= amount
      ? "comfortable"
      : net >= amount * 0.6
        ? "tight"
        : "risky";

  if (language === "hi") {
    if (status === "comfortable") {
      return `${periodLabel} के net cashflow ${formatCurrency(
        net,
        language,
      )} के हिसाब से ${formatCurrency(
        amount,
        language,
      )} अभी manageable लगता है। Final decision लेते समय actual bank balance और upcoming payments भी देख लें।`;
    }

    if (status === "tight") {
      return `${periodLabel} के net cashflow ${formatCurrency(
        net,
        language,
      )} के हिसाब से ${formatCurrency(
        amount,
        language,
      )} थोड़ा tight लग रहा है। Pending collections आ जाएँ तो यह easier हो सकता है, वरना cash cushion कम रहेगा।`;
    }

    return `${periodLabel} के current net cashflow ${formatCurrency(
      net,
      language,
    )} के मुकाबले ${formatCurrency(
      amount,
      language,
    )} risky side पर दिख रहा है। बेहतर रहेगा कि पहले inflow बढ़े या pending collections clear हों।`;
  }

  if (language === "hinglish") {
    if (status === "comfortable") {
      return `${periodLabel} ke net cashflow ${formatCurrency(
        net,
        language,
      )} ke hisaab se ${formatCurrency(
        amount,
        language,
      )} abhi manageable lagta hai. Final decision se pehle actual bank balance aur upcoming payments bhi check kar lena.`;
    }

    if (status === "tight") {
      return `${periodLabel} ke net cashflow ${formatCurrency(
        net,
        language,
      )} ke hisaab se ${formatCurrency(
        amount,
        language,
      )} thoda tight lag raha hai. Pending collections aa jayein to yeh easier ho sakta hai, warna cash cushion kam rahega.`;
    }

    return `${periodLabel} ke current net cashflow ${formatCurrency(
      net,
      language,
    )} ke saamne ${formatCurrency(
      amount,
      language,
    )} risky side par dikh raha hai. Pehle inflow improve ho ya pending collections clear hon, to better rahega.`;
  }

  if (status === "comfortable") {
    return `Based on your ${periodLabel} net cashflow of ${formatCurrency(
      net,
      language,
    )}, ${formatCurrency(
      amount,
      language,
    )} looks manageable right now. I would still check actual bank balance and upcoming payments before committing.`;
  }

  if (status === "tight") {
    return `Based on your ${periodLabel} net cashflow of ${formatCurrency(
      net,
      language,
    )}, ${formatCurrency(
      amount,
      language,
    )} looks a bit tight. It becomes easier if pending collections land soon, otherwise your cushion stays thin.`;
  }

  return `Against your current ${periodLabel} net cashflow of ${formatCurrency(
    net,
    language,
  )}, ${formatCurrency(
    amount,
    language,
  )} looks risky. It would be safer after inflow improves or pending collections clear.`;
};

const buildBudgetPlanAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => summary.budget.summary;

const buildSavingsSuggestionAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => {
  const topOpportunity = summary.savings.opportunities[0];
  if (!topOpportunity) {
    return summary.savings.summary;
  }

  if (language === "hi") {
    return `${summary.savings.summary} सबसे पहले ${topOpportunity.category} पर ध्यान दीजिए. ${topOpportunity.description}`;
  }

  if (language === "hinglish") {
    return `${summary.savings.summary} Sabse pehle ${topOpportunity.category} pe dhyan do. ${topOpportunity.description}`;
  }

  return `${summary.savings.summary} Start with ${topOpportunity.category}. ${topOpportunity.description}`;
};

const buildBillReminderAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => {
  const nextReminder = summary.reminders.items[0];
  if (!nextReminder) {
    return summary.reminders.summary;
  }

  if (language === "hi") {
    return `${summary.reminders.summary} ${nextReminder.description}`;
  }

  if (language === "hinglish") {
    return `${summary.reminders.summary} ${nextReminder.description}`;
  }

  return `${summary.reminders.summary} ${nextReminder.description}`;
};

const buildHealthScoreAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => {
  if (language === "hi") {
    return `${summary.healthScore.summary} ${summary.healthScore.nextBestAction}`;
  }

  if (language === "hinglish") {
    return `${summary.healthScore.summary} ${summary.healthScore.nextBestAction}`;
  }

  return `${summary.healthScore.summary} ${summary.healthScore.nextBestAction}`;
};

const buildBehaviorInsightsAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => {
  const [firstInsight, secondInsight] = summary.behaviorInsights.items;
  if (!firstInsight) {
    return summary.behaviorInsights.summary;
  }

  if (language === "hi") {
    return secondInsight
      ? `${summary.behaviorInsights.summary} ${firstInsight.description} ${secondInsight.description}`
      : `${summary.behaviorInsights.summary} ${firstInsight.description}`;
  }

  if (language === "hinglish") {
    return secondInsight
      ? `${summary.behaviorInsights.summary} ${firstInsight.description} ${secondInsight.description}`
      : `${summary.behaviorInsights.summary} ${firstInsight.description}`;
  }

  return secondInsight
    ? `${summary.behaviorInsights.summary} ${firstInsight.description} ${secondInsight.description}`
    : `${summary.behaviorInsights.summary} ${firstInsight.description}`;
};

const buildGoalTrackingAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
) => {
  const nextGoal = summary.goals.items[0];
  if (!nextGoal) {
    return summary.goals.summary;
  }

  if (language === "hi") {
    return `${summary.goals.summary} अभी ${nextGoal.title} ${nextGoal.progressPercent}% complete है. ${nextGoal.summary}`;
  }

  if (language === "hinglish") {
    return `${summary.goals.summary} Abhi ${nextGoal.title} ${nextGoal.progressPercent}% complete hai. ${nextGoal.summary}`;
  }

  return `${summary.goals.summary} Right now ${nextGoal.title} is ${nextGoal.progressPercent}% complete. ${nextGoal.summary}`;
};

const buildDecisionGuidanceAnswer = (
  language: AssistantLanguage,
  summary: Awaited<ReturnType<typeof buildFinancialCopilot>>,
  amount: number | null,
) => {
  if (!summary.decision) {
    if (language === "hi") {
      return amount == null
        ? "ज़रूर, बस amount भी लिख दीजिए. जैसे: क्या मैं ₹10,000 afford कर सकता हूँ?"
        : summary.budget.summary;
    }

    if (language === "hinglish") {
      return amount == null
        ? "Bilkul, bas amount bhi likh do. Jaise: Main ₹10,000 afford kar sakta hoon kya?"
        : summary.budget.summary;
    }

    return amount == null
      ? "Sure, just include the amount too. For example: Can I afford ₹10,000 this month?"
      : summary.budget.summary;
  }

  if (language === "hi") {
    return `${summary.decision.summary} ${summary.decision.explanation} इस महीने safe room लगभग ${formatCopilotCurrency(
      Math.max(summary.budget.remainingSafeToSpend, 0),
      language,
    )} बची है.`;
  }

  if (language === "hinglish") {
    return `${summary.decision.summary} ${summary.decision.explanation} Is month safe room lagbhag ${formatCopilotCurrency(
      Math.max(summary.budget.remainingSafeToSpend, 0),
      language,
    )} bachi hai.`;
  }

  return `${summary.decision.summary} ${summary.decision.explanation} You still have about ${formatCopilotCurrency(
    Math.max(summary.budget.remainingSafeToSpend, 0),
    language,
  )} of safe room left this month.`;
};

const buildHelpAnswer = (language: AssistantLanguage, usedHistory: boolean) => {
  const historyHint = usedHistory
    ? language === "hi"
      ? "मैंने आपके पिछले message का context भी देखा। "
      : language === "hinglish"
        ? "Maine aapke pichle message ka context bhi use kiya. "
        : "I also used your previous message for context. "
    : "";

  if (language === "hi") {
    return `${historyHint}मैं profit, sales, pending payments, cashflow, category spend, supplier spend, budget planning, savings suggestions, bill reminders, health score, behavior insights, goal tracking और affordability जैसे सवाल समझ सकता हूँ। आप इनमें से कुछ पूछ सकते हैं।`;
  }

  if (language === "hinglish") {
    return `${historyHint}Main profit, sales, pending payments, cashflow, category spend, supplier spend, budget planning, savings suggestions, bill reminders, health score, behavior insights, goal tracking, aur affordability jaise sawal samajh sakta hoon. Aap inme se kuch pooch sakte ho.`;
  }

  return `${historyHint}I can help with profit, sales, pending payments, cashflow, spend by supplier or category, budget planning, savings ideas, bill reminders, health score, behavior insights, goal tracking, and affordability questions. Try one of the example prompts.`;
};

const parseAssistantQuery = (
  message: string,
  history: AssistantHistoryMessage[],
): AssistantParsedQuery => {
  const { conversationMessage, usedHistory } = resolveConversationMessage(
    message,
    history,
  );
  const languageProfile = detectAssistantLanguage(message);
  const amount = extractAmount(conversationMessage);
  const entity = extractEntity(conversationMessage);
  const intent = detectIntent(conversationMessage, amount, entity);

  return {
    language:
      containsDevanagari(message) && languageProfile.mixed
        ? "hinglish"
        : languageProfile.language,
    intent,
    period: resolveAssistantPeriod(conversationMessage),
    amount,
    entity,
    conversationMessage,
    usedHistory,
  };
};

export const answerAssistantQuery = async (params: {
  userId: number;
  message: string;
  history?: AssistantHistoryMessage[];
}): Promise<AssistantReply> => {
  const parsed = parseAssistantQuery(params.message, params.history ?? []);
  const needsCopilotSummary =
    parsed.intent === "budget_plan" ||
    parsed.intent === "savings_suggestion" ||
    parsed.intent === "bill_reminder" ||
    parsed.intent === "health_score" ||
    parsed.intent === "behavior_insights" ||
    parsed.intent === "goal_tracking" ||
    parsed.intent === "affordability";
  const { snapshot, purchases } = await buildAssistantSnapshot(
    params.userId,
    parsed.period,
  );
  const copilotSummary = needsCopilotSummary
    ? await buildFinancialCopilot({
        userId: params.userId,
        language: parsed.language,
        fallbackMessage: parsed.conversationMessage,
        decisionAmount: parsed.amount,
      })
    : null;

  const spendMatch =
    parsed.intent === "vendor_spend" && parsed.entity
      ? findSpendMatch(purchases, parsed.entity, snapshot.totalOutflow)
      : null;
  const topSpend =
    parsed.intent === "top_spend"
      ? findTopSpend(purchases, snapshot.totalOutflow)
      : null;

  let answer = "";
  if (parsed.intent === "profit") {
    answer = buildProfitAnswer(parsed.language, snapshot);
  } else if (parsed.intent === "total_sales") {
    answer = buildSalesAnswer(parsed.language, snapshot);
  } else if (parsed.intent === "pending_payments") {
    answer = buildPendingAnswer(parsed.language, snapshot);
  } else if (parsed.intent === "cashflow") {
    answer = buildCashflowAnswer(parsed.language, snapshot);
  } else if (parsed.intent === "vendor_spend" && parsed.entity) {
    answer = buildVendorSpendAnswer(
      parsed.language,
      snapshot,
      parsed.entity,
      spendMatch,
    );
  } else if (parsed.intent === "top_spend") {
    answer = buildTopSpendAnswer(parsed.language, snapshot, topSpend);
  } else if (parsed.intent === "budget_plan" && copilotSummary) {
    answer = buildBudgetPlanAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "savings_suggestion" && copilotSummary) {
    answer = buildSavingsSuggestionAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "bill_reminder" && copilotSummary) {
    answer = buildBillReminderAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "health_score" && copilotSummary) {
    answer = buildHealthScoreAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "behavior_insights" && copilotSummary) {
    answer = buildBehaviorInsightsAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "goal_tracking" && copilotSummary) {
    answer = buildGoalTrackingAnswer(parsed.language, copilotSummary);
  } else if (parsed.intent === "affordability") {
    answer = copilotSummary
      ? buildDecisionGuidanceAnswer(parsed.language, copilotSummary, parsed.amount)
      : buildAffordabilityAnswer(parsed.language, snapshot, parsed.amount);
  } else {
    answer = buildHelpAnswer(parsed.language, parsed.usedHistory);
  }

  return {
    language: parsed.language,
    intent: parsed.intent,
    answer,
    highlights: buildHighlights(parsed.language, snapshot, parsed.intent, {
      spendMatch,
      topSpend,
      requestedAmount: parsed.amount,
      copilotSummary,
    }),
    examples: copilotSummary?.examples ?? buildExamples(parsed.language),
  };
};
