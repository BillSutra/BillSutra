import { InvoiceStatus, SaleStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";
import {
  fetchCashInflowSnapshot,
  getDailyExpenses,
} from "../../services/dashboardAnalyticsService.js";

type AssistantLanguage = "en" | "hi";
type AssistantIntent =
  | "profit"
  | "total_sales"
  | "pending_payments"
  | "cashflow"
  | "help";

type AssistantFinanceSnapshot = {
  periodStart: Date;
  totalSales: number;
  purchasePayments: number;
  expenses: number;
  totalOutflow: number;
  profit: number;
  pendingPayments: number;
  cashflowInflow: number;
  cashflowOutflow: number;
  cashflowNet: number;
};

export type AssistantReply = {
  language: AssistantLanguage;
  intent: AssistantIntent;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  examples: string[];
};

const HINDI_SCRIPT_PATTERN = /[\u0900-\u097F]/;
const HINDI_ROMANIZED_HINTS = [
  "kitna",
  "kitni",
  "kitne",
  "aapka",
  "aapki",
  "aaj",
  "mahina",
  "mahine",
  "batao",
  "bakaya",
  "baki",
  "munafa",
  "labh",
  "nakdi",
  "kharcha",
];
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

const formatCurrency = (value: number, language: AssistantLanguage) =>
  new Intl.NumberFormat(language === "hi" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatPeriodLabel = (periodStart: Date, language: AssistantLanguage) =>
  new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(periodStart);

const detectLanguage = (message: string): AssistantLanguage => {
  const normalized = message.toLowerCase();
  if (HINDI_SCRIPT_PATTERN.test(message)) {
    return "hi";
  }

  return HINDI_ROMANIZED_HINTS.some((hint) => normalized.includes(hint)) ? "hi" : "en";
};

const detectIntent = (message: string): AssistantIntent => {
  const normalized = message.toLowerCase();

  const hasKeyword = (keywords: string[]) =>
    keywords.some((keyword) => normalized.includes(keyword));

  if (
    hasKeyword([
      "profit",
      "margin",
      "profitability",
      "\u0932\u093e\u092d",
      "\u092a\u094d\u0930\u0949\u092b\u093f\u091f",
      "\u092e\u0941\u0928\u093e\u092b\u093e",
      "munafa",
      "labh",
    ])
  ) {
    return "profit";
  }

  if (
    hasKeyword([
      "pending payment",
      "pending payments",
      "receivable",
      "receivables",
      "outstanding",
      "dues",
      "collection",
      "\u092c\u093e\u0915\u0940",
      "\u092c\u0915\u093e\u092f\u093e",
      "pending",
      "bakaya",
      "baki",
    ])
  ) {
    return "pending_payments";
  }

  if (
    hasKeyword([
      "cashflow",
      "cash flow",
      "inflow",
      "outflow",
      "net cash",
      "cash position",
      "\u0915\u0948\u0936\u092b\u094d\u0932\u094b",
      "\u0928\u0915\u0926\u0940",
      "cashflow risk",
      "nakdi",
    ])
  ) {
    return "cashflow";
  }

  if (
    hasKeyword([
      "sales",
      "sale",
      "revenue",
      "receipt",
      "receipts",
      "\u092c\u093f\u0915\u094d\u0930\u0940",
      "\u0938\u0947\u0932\u094d\u0938",
      "sales amount",
      "total sales",
      "bikri",
    ])
  ) {
    return "total_sales";
  }

  return "help";
};

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

const buildCurrentMonthSnapshot = async (userId: number) => {
  const now = new Date();
  const monthStart = startOfMonthUtc(now);
  const tomorrow = addDaysUtc(startOfDayUtc(now), 1);

  const [salesSnapshot, purchases, expenseRows, sales, invoices] = await Promise.all([
    fetchCashInflowSnapshot({
      userId,
      start: monthStart,
      endExclusive: tomorrow,
      debugLabel: "assistant current month",
    }),
    prisma.purchase.findMany({
      where: {
        user_id: userId,
        paidAmount: { gt: 0 },
        OR: [
          { paymentDate: { gte: monthStart, lt: tomorrow } },
          { paymentDate: null, purchase_date: { gte: monthStart, lt: tomorrow } },
        ],
      },
      select: {
        paidAmount: true,
      },
    }),
    getDailyExpenses({ userId, from: monthStart }),
    prisma.sale.findMany({
      where: {
        user_id: userId,
        status: SaleStatus.COMPLETED,
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
    purchases.reduce((sum, purchase) => sum + toNumber(purchase.paidAmount), 0),
  );
  const expenses = roundMetric(
    expenseRows
      .filter((row) => row.day >= monthStart && row.day < tomorrow)
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
  const totalSales = salesSnapshot.total;
  const totalOutflow = roundMetric(purchasePayments + expenses);
  const profit = roundMetric(totalSales - totalOutflow);

  return {
    periodStart: monthStart,
    totalSales,
    purchasePayments,
    expenses,
    totalOutflow,
    profit,
    pendingPayments: roundMetric(pendingSales + pendingInvoices),
    cashflowInflow: totalSales,
    cashflowOutflow: totalOutflow,
    cashflowNet: roundMetric(totalSales - totalOutflow),
  } satisfies AssistantFinanceSnapshot;
};

const buildHighlights = (
  language: AssistantLanguage,
  snapshot: AssistantFinanceSnapshot,
  intent: AssistantIntent,
) => {
  if (intent === "profit") {
    return [
      {
        label: language === "hi" ? "Profit" : "Profit",
        value: formatCurrency(snapshot.profit, language),
      },
      {
        label: language === "hi" ? "Sales" : "Sales",
        value: formatCurrency(snapshot.totalSales, language),
      },
      {
        label: language === "hi" ? "Kharch" : "Outflow",
        value: formatCurrency(snapshot.totalOutflow, language),
      },
    ];
  }

  if (intent === "total_sales") {
    return [
      {
        label: language === "hi" ? "Total Sales" : "Total sales",
        value: formatCurrency(snapshot.totalSales, language),
      },
      {
        label: language === "hi" ? "Kharid" : "Purchases",
        value: formatCurrency(snapshot.purchasePayments, language),
      },
      {
        label: language === "hi" ? "Kharch" : "Expenses",
        value: formatCurrency(snapshot.expenses, language),
      },
    ];
  }

  if (intent === "pending_payments") {
    return [
      {
        label: language === "hi" ? "Pending Payment" : "Pending payments",
        value: formatCurrency(snapshot.pendingPayments, language),
      },
      {
        label: language === "hi" ? "Is mahine ki sales" : "Sales this month",
        value: formatCurrency(snapshot.totalSales, language),
      },
    ];
  }

  if (intent === "cashflow") {
    return [
      {
        label: language === "hi" ? "Inflow" : "Inflow",
        value: formatCurrency(snapshot.cashflowInflow, language),
      },
      {
        label: language === "hi" ? "Outflow" : "Outflow",
        value: formatCurrency(snapshot.cashflowOutflow, language),
      },
      {
        label: language === "hi" ? "Net" : "Net",
        value: formatCurrency(snapshot.cashflowNet, language),
      },
    ];
  }

  return [
    {
      label: language === "hi" ? "Total Sales" : "Total sales",
      value: formatCurrency(snapshot.totalSales, language),
    },
    {
      label: language === "hi" ? "Profit" : "Profit",
      value: formatCurrency(snapshot.profit, language),
    },
    {
      label: language === "hi" ? "Pending Payment" : "Pending payments",
      value: formatCurrency(snapshot.pendingPayments, language),
    },
  ];
};

const buildExamples = (language: AssistantLanguage) =>
  language === "hi"
    ? [
        "Is mahine ka profit kitna hai?",
        "Meri total sales batao",
        "Pending payments kitne hain?",
        "Cashflow kaisa chal raha hai?",
      ]
    : [
        "What is my profit this month?",
        "Show my total sales",
        "How much is pending in payments?",
        "What is my cashflow this month?",
      ];

const buildResponseText = (
  language: AssistantLanguage,
  intent: AssistantIntent,
  snapshot: AssistantFinanceSnapshot,
) => {
  const periodLabel = formatPeriodLabel(snapshot.periodStart, language);

  if (language === "hi") {
    if (intent === "profit") {
      return `Aapka ${periodLabel} ka profit ${formatCurrency(
        snapshot.profit,
        language,
      )} hai. Sales receipts ${formatCurrency(
        snapshot.totalSales,
        language,
      )} aur total outflow ${formatCurrency(snapshot.totalOutflow, language)} hai.`;
    }

    if (intent === "total_sales") {
      return `Aapki ${periodLabel} ki total sales receipts ${formatCurrency(
        snapshot.totalSales,
        language,
      )} hain. Isme paid sales aur invoice payments dono shamil hain.`;
    }

    if (intent === "pending_payments") {
      return `Aapke pending payments ${formatCurrency(
        snapshot.pendingPayments,
        language,
      )} hain. Agar yeh amount zyada time se baki hai to collection follow-up jaldi karna useful rahega.`;
    }

    if (intent === "cashflow") {
      const mood = snapshot.cashflowNet >= 0 ? "positive" : "negative";
      return `Aapka ${periodLabel} ka cashflow ${mood} hai. Inflow ${formatCurrency(
        snapshot.cashflowInflow,
        language,
      )}, outflow ${formatCurrency(
        snapshot.cashflowOutflow,
        language,
      )} aur net ${formatCurrency(snapshot.cashflowNet, language)} hai.`;
    }

    return "Main aapko profit, total sales, pending payments aur cashflow ke baare mein bata sakta hoon. Aap pooch sakte hain: is mahine ka profit kitna hai?";
  }

  if (intent === "profit") {
    return `Your profit for ${periodLabel} is ${formatCurrency(
      snapshot.profit,
      language,
    )}. Sales receipts are ${formatCurrency(
      snapshot.totalSales,
      language,
    )} and total outflow is ${formatCurrency(snapshot.totalOutflow, language)}.`;
  }

  if (intent === "total_sales") {
    return `Your total sales receipts for ${periodLabel} are ${formatCurrency(
      snapshot.totalSales,
      language,
    )}. This includes paid sales and invoice payments received.`;
  }

  if (intent === "pending_payments") {
    return `Your pending payments are ${formatCurrency(
      snapshot.pendingPayments,
      language,
    )}. If this stays high, it is a good time to follow up on collections.`;
  }

  if (intent === "cashflow") {
    const mood = snapshot.cashflowNet >= 0 ? "positive" : "negative";
    return `Your cashflow for ${periodLabel} is ${mood}. Inflow is ${formatCurrency(
      snapshot.cashflowInflow,
      language,
    )}, outflow is ${formatCurrency(
      snapshot.cashflowOutflow,
      language,
    )}, and net cashflow is ${formatCurrency(snapshot.cashflowNet, language)}.`;
  }

  return "I can help with profit, total sales, pending payments, and cashflow. Try asking: What is my profit this month?";
};

export const answerAssistantQuery = async (params: {
  userId: number;
  message: string;
}): Promise<AssistantReply> => {
  const language = detectLanguage(params.message);
  const intent = detectIntent(params.message);
  const snapshot = await buildCurrentMonthSnapshot(params.userId);

  return {
    language,
    intent,
    answer: buildResponseText(language, intent, snapshot),
    highlights: buildHighlights(language, snapshot, intent),
    examples: buildExamples(language),
  };
};
