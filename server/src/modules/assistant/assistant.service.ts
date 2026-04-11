import { InvoiceStatus, SaleStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";
import {
  fetchCashInflowSnapshot,
  getDailyExpenses,
} from "../../services/dashboardAnalyticsService.js";
import { emitDashboardUpdate } from "../../services/dashboardRealtime.js";
import { buildFinancialCopilot } from "../copilot/copilot.service.js";
import { formatCopilotCurrency } from "../copilot/copilot.language.js";
import { createInvoice as createInvoiceRecord } from "../invoice/invoice.service.js";
import {
  detectAssistantLanguage,
  type AssistantLanguage,
} from "./assistant.language.js";

type AssistantIntent =
  | "profit"
  | "total_sales"
  | "pending_payments"
  | "cashflow"
  | "create_bill"
  | "add_product"
  | "smart_insights"
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

type AssistantActionType = "create_invoice" | "create_product";
type AssistantActionStatus = "success" | "failed" | "noop";

type AssistantAction = {
  type: AssistantActionType;
  status: AssistantActionStatus;
  message: string;
  resourceId?: number;
  resourceLabel?: string;
  route?: string;
};

type AssistantCopilotProductSuggestion = {
  id: number;
  name: string;
  price: number;
  gstRate: number;
};

type AssistantCopilotInvoiceItem = {
  name: string;
  quantity: number;
  price: number;
  gstRate: number | null;
  source: "explicit" | "catalog" | "top_seller";
};

type AssistantCopilotInvoiceAutocomplete = {
  customerName: string;
  autoCompleted: boolean;
  items: AssistantCopilotInvoiceItem[];
};

type AssistantCopilotGstRecommendation = {
  rate: number;
  reason: string;
  confidence: "high" | "medium" | "low";
};

type AssistantCopilotInsight = {
  title: string;
  detail: string;
  value?: string;
};

type AssistantCopilotPayload = {
  productSuggestions?: AssistantCopilotProductSuggestion[];
  invoiceAutocomplete?: AssistantCopilotInvoiceAutocomplete;
  gstRecommendation?: AssistantCopilotGstRecommendation;
  smartInsights?: AssistantCopilotInsight[];
};

type AssistantActionExecution = {
  action: AssistantAction;
  copilot?: AssistantCopilotPayload;
};

export type AssistantReply = {
  language: AssistantLanguage;
  intent: AssistantIntent;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  examples: string[];
  action?: AssistantAction;
  copilot?: AssistantCopilotPayload;
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

const CREATE_BILL_KEYWORDS = [
  "create bill",
  "make bill",
  "new bill",
  "generate bill",
  "create invoice",
  "make invoice",
  "new invoice",
  "bill bana",
  "invoice bana",
  "बिल बनाओ",
  "इनवॉइस बनाओ",
];

const ADD_PRODUCT_KEYWORDS = [
  "add product",
  "create product",
  "new product",
  "product add",
  "add item",
  "product banao",
  "product bana",
  "प्रोडक्ट जोड़ो",
  "प्रोडक्ट बनाओ",
];

const SMART_INSIGHT_KEYWORDS = [
  "smart insight",
  "smart insights",
  "top selling",
  "best selling",
  "top seller",
  "best seller",
  "top product",
  "सबसे ज्यादा बिकने",
  "बेस्ट सेलिंग",
  "टॉप सेलिंग",
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
    "Create a bill for Ravi Kumar with 2 x Rice at ₹45",
    "Add product Bread at ₹40 with GST 5",
    "Show smart insights and top selling product",
    "Show today's sales",
    "How much did I spend on Swiggy last month?",
    "What is my profit this month?",
    "Which category is taking most of my money?",
    "Can I afford ₹10,000 this month?",
  ],
  hi: [
    "Ravi Kumar के लिए 2 x Rice @ ₹45 का bill बनाओ",
    "Bread product ₹40 पर GST 5 के साथ जोड़ो",
    "स्मार्ट insights दिखाओ और top selling product बताओ",
    "आज की sales दिखाओ",
    "मैंने पिछले महीने Swiggy पर कितना खर्च किया?",
    "इस महीने मेरा profit कितना है?",
    "मेरा सबसे ज़्यादा पैसा किस category पर जा रहा है?",
    "क्या मैं इस महीने ₹10,000 afford कर सकता हूँ?",
  ],
  hinglish: [
    "Ravi Kumar ke liye 2 x Rice @ ₹45 ka bill banao",
    "Bread product ₹40 par GST 5 ke saath add karo",
    "Smart insights dikhao aur top selling product batao",
    "Aaj ki sales dikhao",
    "Maine last month Swiggy pe kitna spend kiya?",
    "Is month mera profit kitna hai?",
    "Mera sabse zyada paisa kis category pe ja raha hai?",
    "Main ₹10,000 afford kar sakta hoon kya?",
  ],
};

const ASSISTANT_ACTION_DEDUPE_WINDOW_MS = 8_000;
const assistantRecentActions = new Map<
  string,
  {
    at: number;
    action: AssistantAction;
  }
>();

const assistantDebugEnabled = process.env.NODE_ENV !== "production";

const logAssistantDebug = (event: string, payload: Record<string, unknown>) => {
  if (!assistantDebugEnabled) return;
  console.info(`[assistant] ${event}`, payload);
};

const toNumber = (value: unknown) => Number(value ?? 0);

const roundMetric = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const normalizeForActionKey = (value: string) =>
  normalizeText(value).replace(/[^a-z0-9\u0900-\u097f ]/g, " ").replace(/\s+/g, " ").trim();

const buildAssistantActionKey = (
  userId: number,
  intent: AssistantIntent,
  message: string,
) => `${userId}:${intent}:${normalizeForActionKey(message)}`;

const pruneRecentAssistantActions = () => {
  const threshold = Date.now() - ASSISTANT_ACTION_DEDUPE_WINDOW_MS;
  for (const [key, entry] of assistantRecentActions.entries()) {
    if (entry.at < threshold) {
      assistantRecentActions.delete(key);
    }
  }
};

const getRecentAssistantAction = (key: string): AssistantAction | null => {
  pruneRecentAssistantActions();
  const entry = assistantRecentActions.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.at > ASSISTANT_ACTION_DEDUPE_WINDOW_MS) {
    assistantRecentActions.delete(key);
    return null;
  }

  return entry.action;
};

const rememberAssistantAction = (key: string, action: AssistantAction) => {
  assistantRecentActions.set(key, { at: Date.now(), action });
};

const cleanActionEntity = (value: string) =>
  value
    .replace(/[?.,!]/g, " ")
    .replace(
      /\b(with|at|price|gst|for|to|today|tomorrow|this|last|month|week|bill|invoice|please|plz|and)\b.*$/i,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

const extractCustomerNameForBill = (message: string) => {
  const quoted = message.match(/(?:for|to|customer)\s+["']([^"']{2,80})["']/i);
  if (quoted?.[1]) {
    const cleanedQuoted = cleanActionEntity(quoted[1]);
    if (cleanedQuoted.length >= 2) return cleanedQuoted;
  }

  const direct = message.match(
    /(?:for|to|customer)\s+([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s.&\-]{1,80})/i,
  );
  if (!direct?.[1]) {
    return null;
  }

  const cleaned = cleanActionEntity(direct[1]);
  return cleaned.length >= 2 ? cleaned : null;
};

type AssistantInvoiceItemCandidate = {
  name: string;
  quantity: number;
  price: number;
};

const extractInvoiceItemsFromMessage = (
  message: string,
): AssistantInvoiceItemCandidate[] => {
  const itemPattern =
    /(\d+(?:\.\d+)?)?\s*(?:x|qty)?\s*([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,50}?)\s*(?:at|@)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/gi;
  const items: AssistantInvoiceItemCandidate[] = [];

  for (const match of message.matchAll(itemPattern)) {
    const quantity = Math.max(1, Math.round(Number(match[1] ?? "1")));
    const name = cleanActionEntity(match[2] ?? "");
    const price = Number(match[3] ?? "0");

    if (!name || !Number.isFinite(price) || price <= 0) {
      continue;
    }

    items.push({
      name,
      quantity,
      price,
    });
  }

  return items;
};

const extractProductNameForCreate = (message: string) => {
  const quoted = message.match(/["']([^"']{2,80})["']/);
  if (quoted?.[1]) {
    const cleanedQuoted = cleanActionEntity(quoted[1]);
    if (cleanedQuoted.length >= 2) return cleanedQuoted;
  }

  const named = message.match(
    /(?:add|create|new)\s+(?:a\s+)?product(?:\s+(?:named|called))?\s+([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,80})/i,
  );
  if (!named?.[1]) {
    return null;
  }

  const cleaned = cleanActionEntity(named[1]);
  return cleaned.length >= 2 ? cleaned : null;
};

const extractRequestedGstRate = (message: string) => {
  if (hasKeyword(message, ["without gst", "no gst"])) {
    return 0;
  }

  const numericMatch = message.match(
    /(?:gst(?:\s*rate)?\s*|)(\d+(?:\.\d+)?)\s*%?\s*gst|gst(?:\s*rate)?\s*(\d+(?:\.\d+)?)/i,
  );
  const raw = numericMatch?.[1] ?? numericMatch?.[2] ?? null;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (hasKeyword(message, ["with gst", "gst"])) {
    return 18;
  }

  return null;
};

const buildAssistantSku = (productName: string) => {
  const base = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const prefix = base || "ITEM";
  const suffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 90 + 10,
  )}`;
  return `${prefix}-${suffix}`;
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

type AssistantTopSellingProduct = {
  productId: number | null;
  name: string;
  quantity: number;
  revenue: number;
  gstRate: number | null;
  stockOnHand: number | null;
  unitPrice: number | null;
};

const GST_KEYWORD_HINTS: Array<{ rate: number; keywords: string[] }> = [
  {
    rate: 5,
    keywords: [
      "rice",
      "atta",
      "flour",
      "milk",
      "bread",
      "dal",
      "wheat",
      "grocery",
      "chai",
      "tea",
    ],
  },
  {
    rate: 12,
    keywords: ["medicine", "medicines", "pharma", "drug", "drugs"],
  },
  {
    rate: 18,
    keywords: [
      "mobile",
      "charger",
      "cable",
      "electronics",
      "laptop",
      "service",
      "consulting",
    ],
  },
  {
    rate: 28,
    keywords: ["cigarette", "tobacco", "perfume", "luxury", "car"],
  },
];

const inferGstRateFromKeywords = (productName: string) => {
  const normalized = normalizeText(productName);
  if (!normalized) {
    return null;
  }

  for (const band of GST_KEYWORD_HINTS) {
    if (band.keywords.some((keyword) => normalized.includes(keyword))) {
      return band.rate;
    }
  }

  return null;
};

const buildGstRecommendation = async (params: {
  userId: number;
  productName: string;
  language: AssistantLanguage;
}): Promise<AssistantCopilotGstRecommendation> => {
  const exact = await prisma.product.findFirst({
    where: {
      user_id: params.userId,
      name: {
        equals: params.productName,
        mode: "insensitive",
      },
    },
    select: {
      name: true,
      gst_rate: true,
    },
  });

  if (exact) {
    const rate = roundMetric(toNumber(exact.gst_rate), 2);
    return {
      rate,
      confidence: "high",
      reason:
        params.language === "hi"
          ? `${exact.name} के existing catalog data से GST लिया गया है।`
          : params.language === "hinglish"
            ? `${exact.name} ke existing catalog data se GST liya gaya hai.`
            : `GST is based on existing catalog data for ${exact.name}.`,
    };
  }

  const tokens = normalizeText(params.productName)
    .split(" ")
    .filter((token) => token.length >= 3)
    .slice(0, 3);

  if (tokens.length > 0) {
    const similarProducts = await prisma.product.findMany({
      where: {
        user_id: params.userId,
        OR: tokens.map((token) => ({
          name: {
            contains: token,
            mode: "insensitive",
          },
        })),
      },
      select: {
        gst_rate: true,
      },
      take: 40,
    });

    const bands = new Map<string, { rate: number; count: number }>();
    for (const product of similarProducts) {
      const rate = roundMetric(toNumber(product.gst_rate), 2);
      if (!Number.isFinite(rate) || rate < 0 || rate > 28) {
        continue;
      }

      const key = rate.toFixed(2);
      const current = bands.get(key) ?? { rate, count: 0 };
      current.count += 1;
      bands.set(key, current);
    }

    const topBand = [...bands.values()].sort((left, right) => {
      if (right.count === left.count) {
        return left.rate - right.rate;
      }

      return right.count - left.count;
    })[0];

    if (topBand) {
      return {
        rate: topBand.rate,
        confidence: "medium",
        reason:
          params.language === "hi"
            ? "मिलते-जुलते products के आधार पर GST suggest किया गया है।"
            : params.language === "hinglish"
              ? "Milte-julte products ke basis par GST suggest kiya gaya hai."
              : "GST is suggested from similar products in your catalog.",
      };
    }
  }

  const keywordRate = inferGstRateFromKeywords(params.productName);
  if (keywordRate != null) {
    return {
      rate: keywordRate,
      confidence: "medium",
      reason:
        params.language === "hi"
          ? "Product type keywords के आधार पर GST suggest किया गया है।"
          : params.language === "hinglish"
            ? "Product type keywords ke basis par GST suggest kiya gaya hai."
            : "GST is suggested from product-type keywords.",
    };
  }

  return {
    rate: 18,
    confidence: "low",
    reason:
      params.language === "hi"
        ? "Specific match नहीं मिला, इसलिए default GST 18% suggest किया गया।"
        : params.language === "hinglish"
          ? "Specific match nahi mila, isliye default GST 18% suggest kiya gaya."
          : "No clear match found, so default GST 18% is suggested.",
  };
};

const searchProductSuggestions = async (params: {
  userId: number;
  message: string;
  limit?: number;
}): Promise<AssistantCopilotProductSuggestion[]> => {
  const tokens = normalizeText(params.message)
    .split(/[^a-z0-9\u0900-\u097f]+/i)
    .filter((token) => token.length >= 2)
    .slice(0, 4);

  if (tokens.length === 0) {
    return [];
  }

  const candidates = await prisma.product.findMany({
    where: {
      user_id: params.userId,
      OR: tokens.map((token) => ({
        name: {
          contains: token,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
      name: true,
      price: true,
      gst_rate: true,
    },
    take: 30,
  });

  const scored = candidates
    .map((candidate) => {
      const normalizedName = normalizeText(candidate.name);
      const score = tokens.reduce((sum, token) => {
        if (normalizedName.startsWith(token)) {
          return sum + 3;
        }

        if (normalizedName.includes(token)) {
          return sum + 1;
        }

        return sum;
      }, 0);

      return {
        ...candidate,
        score,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, params.limit ?? 5);

  return scored.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    price: roundMetric(toNumber(candidate.price), 2),
    gstRate: roundMetric(toNumber(candidate.gst_rate), 2),
  }));
};

const fetchTopSellingProducts = async (params: {
  userId: number;
  period: AssistantPeriod;
  limit?: number;
}): Promise<AssistantTopSellingProduct[]> => {
  const groups = await prisma.saleItem.groupBy({
    by: ["product_id", "name"],
    where: {
      sale: {
        user_id: params.userId,
        status: SaleStatus.COMPLETED,
        sale_date: {
          gte: params.period.start,
          lt: params.period.endExclusive,
        },
      },
    },
    _sum: {
      quantity: true,
      line_total: true,
    },
    orderBy: [{ _sum: { quantity: "desc" } }, { _sum: { line_total: "desc" } }],
    take: Math.max((params.limit ?? 3) * 2, 6),
  });

  const productIds = groups
    .map((group) => group.product_id)
    .filter((id): id is number => typeof id === "number");

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: {
            user_id: params.userId,
            id: { in: productIds },
          },
          select: {
            id: true,
            name: true,
            gst_rate: true,
            stock_on_hand: true,
            price: true,
          },
        })
      : [];

  const productMap = new Map(products.map((product) => [product.id, product]));

  return groups
    .map((group) => {
      const quantity = Math.max(0, Number(group._sum.quantity ?? 0));
      const revenue = roundMetric(toNumber(group._sum.line_total), 2);
      const product =
        group.product_id != null ? productMap.get(group.product_id) ?? null : null;

      return {
        productId: group.product_id,
        name: product?.name ?? group.name,
        quantity,
        revenue,
        gstRate: product ? roundMetric(toNumber(product.gst_rate), 2) : null,
        stockOnHand: product?.stock_on_hand ?? null,
        unitPrice: product ? roundMetric(toNumber(product.price), 2) : null,
      } satisfies AssistantTopSellingProduct;
    })
    .filter((item) => item.quantity > 0 && item.name.trim().length > 0)
    .sort((left, right) => {
      if (right.quantity === left.quantity) {
        return right.revenue - left.revenue;
      }

      return right.quantity - left.quantity;
    })
    .slice(0, params.limit ?? 3);
};

const buildAutocompleteItemsFromTopProducts = async (params: {
  userId: number;
  period: AssistantPeriod;
}): Promise<AssistantCopilotInvoiceItem[]> => {
  const topSelling = await fetchTopSellingProducts({
    userId: params.userId,
    period: params.period,
    limit: 3,
  });

  if (topSelling.length > 0) {
    return topSelling.map((item) => {
      const inferredPrice =
        item.unitPrice ??
        (item.quantity > 0 ? roundMetric(item.revenue / item.quantity, 2) : 0);

      return {
        name: item.name,
        quantity: 1,
        price: Math.max(1, inferredPrice),
        gstRate: item.gstRate,
        source: "top_seller",
      } satisfies AssistantCopilotInvoiceItem;
    });
  }

  const fallbackProducts = await prisma.product.findMany({
    where: {
      user_id: params.userId,
    },
    orderBy: {
      updated_at: "desc",
    },
    select: {
      name: true,
      price: true,
      gst_rate: true,
    },
    take: 2,
  });

  return fallbackProducts.map((product) => ({
    name: product.name,
    quantity: 1,
    price: Math.max(1, roundMetric(toNumber(product.price), 2)),
    gstRate: roundMetric(toNumber(product.gst_rate), 2),
    source: "catalog",
  }));
};

const buildSmartInsightsPayload = async (params: {
  userId: number;
  language: AssistantLanguage;
  period: AssistantPeriod;
}): Promise<AssistantCopilotInsight[]> => {
  const topSelling = await fetchTopSellingProducts({
    userId: params.userId,
    period: params.period,
    limit: 3,
  });

  if (topSelling.length === 0) {
    return [];
  }

  const primary = topSelling[0];
  const periodLabel = formatPeriodLabel(params.period, params.language);
  const insights: AssistantCopilotInsight[] = [
    {
      title:
        params.language === "hi"
          ? "टॉप सेलिंग प्रोडक्ट"
          : params.language === "hinglish"
            ? "Top selling product"
            : "Top selling product",
      detail:
        params.language === "hi"
          ? `${periodLabel} में ${primary.name} सबसे ज्यादा बिका (${primary.quantity} यूनिट)।`
          : params.language === "hinglish"
            ? `${periodLabel} mein ${primary.name} sabse zyada bika (${primary.quantity} units).`
            : `${primary.name} sold the most in ${periodLabel} (${primary.quantity} units).`,
      value: primary.name,
    },
  ];

  if (primary.stockOnHand != null && primary.stockOnHand <= Math.max(3, primary.quantity)) {
    insights.push({
      title:
        params.language === "hi"
          ? "रीस्टॉक अलर्ट"
          : params.language === "hinglish"
            ? "Restock alert"
            : "Restock alert",
      detail:
        params.language === "hi"
          ? `${primary.name} का stock ${primary.stockOnHand} है। रीस्टॉक प्लान अभी बनाना बेहतर रहेगा।`
          : params.language === "hinglish"
            ? `${primary.name} ka stock ${primary.stockOnHand} hai. Restock plan abhi banana better rahega.`
            : `${primary.name} stock is ${primary.stockOnHand}. Plan a restock now to avoid stockout.`,
    });
  }

  if (primary.gstRate != null) {
    insights.push({
      title: params.language === "hi" ? "GST संकेत" : "GST hint",
      detail:
        params.language === "hi"
          ? `${primary.name} के लिए आमतौर पर ${primary.gstRate}% GST उपयोग हो रहा है।`
          : params.language === "hinglish"
            ? `${primary.name} ke liye usually ${primary.gstRate}% GST use ho raha hai.`
            : `${primary.name} is usually billed with ${primary.gstRate}% GST.`,
      value: `${primary.gstRate}%`,
    });
  }

  return insights;
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
  if (hasKeyword(message, CREATE_BILL_KEYWORDS)) {
    return "create_bill" satisfies AssistantIntent;
  }

  if (hasKeyword(message, ADD_PRODUCT_KEYWORDS)) {
    return "add_product" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SMART_INSIGHT_KEYWORDS)) {
    return "smart_insights" satisfies AssistantIntent;
  }

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

const buildActionExamples = (
  language: AssistantLanguage,
  intent: AssistantIntent,
) => {
  if (intent === "create_bill") {
    if (language === "hi") {
      return [
        "Ravi Kumar के लिए 2 x Rice @ ₹45 का bill बनाओ",
        "Ravi Kumar के लिए 1 x Notebook @ ₹50 और 1 x Pen @ ₹10 का bill बनाओ",
      ];
    }

    if (language === "hinglish") {
      return [
        "Ravi Kumar ke liye 2 x Rice @ ₹45 ka bill banao",
        "Ravi Kumar ke liye 1 x Notebook @ ₹50 aur 1 x Pen @ ₹10 ka bill banao",
      ];
    }

    return [
      "Create a bill for Ravi Kumar with 2 x Rice at ₹45",
      "Create a bill for Ravi Kumar with 1 x Notebook at ₹50 and 1 x Pen at ₹10",
    ];
  }

  if (intent === "add_product") {
    if (language === "hi") {
      return [
        "Bread product ₹40 पर GST 5 के साथ जोड़ो",
        "Milk product ₹60 add करो",
      ];
    }

    if (language === "hinglish") {
      return [
        "Bread product ₹40 par GST 5 ke saath add karo",
        "Milk product ₹60 add karo",
      ];
    }

    return [
      "Add product Bread at ₹40 with GST 5",
      "Add product Milk at ₹60",
    ];
  }

  return HELP_EXAMPLES[language];
};

const executeAddProductAction = async (params: {
  userId: number;
  language: AssistantLanguage;
  message: string;
}): Promise<AssistantActionExecution> => {
  logAssistantDebug("action.add_product.started", {
    userId: params.userId,
  });

  const dedupeKey = buildAssistantActionKey(
    params.userId,
    "add_product",
    params.message,
  );
  const recent = getRecentAssistantAction(dedupeKey);
  if (recent?.status === "success") {
    return {
      action: {
        ...recent,
        status: "noop",
        message:
          params.language === "hi"
            ? "मैंने अभी-अभी यह product जोड़ दिया था। लिस्ट refresh करके देखें।"
            : params.language === "hinglish"
              ? "Maine abhi yeh product add kiya tha. Product list refresh karke dekho."
              : "I just added this product. Please refresh the product list once.",
      },
    };
  }

  const productName = extractProductNameForCreate(params.message);
  const price = extractAmount(params.message);
  const gstRate = extractRequestedGstRate(params.message);

  const productSuggestions = await searchProductSuggestions({
    userId: params.userId,
    message: params.message,
  });

  if (!productName || price == null || price <= 0) {
    return {
      action: {
        type: "create_product",
        status: "failed",
        message:
          params.language === "hi"
            ? "Product add करने के लिए नाम और price दोनों चाहिए। जैसे: Bread product ₹40 पर GST 5 जोड़ो।"
            : params.language === "hinglish"
              ? "Product add karne ke liye naam aur price dono chahiye. Example: Bread product ₹40 par GST 5 add karo."
              : "To add a product, I need both name and price. Example: Add product Bread at ₹40 with GST 5.",
      },
      copilot:
        productSuggestions.length > 0
          ? {
              productSuggestions,
            }
          : undefined,
    };
  }

  if (gstRate != null && (gstRate < 0 || gstRate > 28)) {
    return {
      action: {
        type: "create_product",
        status: "failed",
        message:
          params.language === "hi"
            ? "GST rate 0 से 28 के बीच रखें।"
            : params.language === "hinglish"
              ? "GST rate 0 se 28 ke beech rakho."
              : "Please keep GST rate between 0 and 28.",
      },
      copilot:
        productSuggestions.length > 0
          ? {
              productSuggestions,
            }
          : undefined,
    };
  }

  const gstRecommendation: AssistantCopilotGstRecommendation =
    gstRate != null
      ? {
          rate: gstRate,
          confidence: "high",
          reason:
            params.language === "hi"
              ? `आपने GST ${gstRate}% दिया, वही लागू किया गया।`
              : params.language === "hinglish"
                ? `Aapne GST ${gstRate}% diya, wahi apply kiya gaya.`
                : `Using the GST ${gstRate}% you provided.`,
        }
      : await buildGstRecommendation({
          userId: params.userId,
          productName,
          language: params.language,
        });

  const resolvedGstRate = gstRate ?? gstRecommendation.rate;

  const existingProduct = await prisma.product.findFirst({
    where: {
      user_id: params.userId,
      name: {
        equals: productName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      price: true,
      gst_rate: true,
    },
  });

  if (existingProduct) {
    return {
      action: {
        type: "create_product",
        status: "noop",
        message:
          params.language === "hi"
            ? `${existingProduct.name} पहले से मौजूद है। क्या मैं इसका price update करूँ?`
            : params.language === "hinglish"
              ? `${existingProduct.name} pehle se hai. Kya main iska price update karun?`
              : `${existingProduct.name} already exists. Do you want me to update its price?`,
        resourceId: existingProduct.id,
        resourceLabel: existingProduct.name,
        route: "/products",
      },
      copilot: {
        gstRecommendation,
        productSuggestions: [
          {
            id: existingProduct.id,
            name: existingProduct.name,
            price: roundMetric(toNumber(existingProduct.price), 2),
            gstRate: roundMetric(toNumber(existingProduct.gst_rate), 2),
          },
          ...productSuggestions,
        ].slice(0, 5),
      },
    };
  }

  const createdProduct = await prisma.product.create({
    data: {
      user_id: params.userId,
      name: productName,
      sku: buildAssistantSku(productName),
      price,
      gst_rate: resolvedGstRate,
      stock_on_hand: 0,
      reorder_level: 0,
    },
    select: {
      id: true,
      name: true,
      price: true,
      gst_rate: true,
    },
  });

  emitDashboardUpdate({ userId: params.userId, source: "assistant.product.create" });

  logAssistantDebug("action.add_product.completed", {
    userId: params.userId,
    productId: createdProduct.id,
  });

  const action: AssistantAction = {
    type: "create_product",
    status: "success",
    message:
      params.language === "hi"
        ? `${createdProduct.name} ${resolvedGstRate}% GST के साथ जोड़ दिया गया। क्या अब मैं इसके साथ bill बनाने में मदद करूँ?`
        : params.language === "hinglish"
          ? `${createdProduct.name} ${resolvedGstRate}% GST ke saath add ho gaya. Kya ab main iske saath bill banane mein help karun?`
          : `${createdProduct.name} has been added with ${resolvedGstRate}% GST. Do you want me to help create a bill with it?`,
    resourceId: createdProduct.id,
    resourceLabel: createdProduct.name,
    route: "/products",
  };

  rememberAssistantAction(dedupeKey, action);
  return {
    action,
    copilot: {
      gstRecommendation,
      productSuggestions: [
        {
          id: createdProduct.id,
          name: createdProduct.name,
          price: roundMetric(toNumber(createdProduct.price), 2),
          gstRate: roundMetric(toNumber(createdProduct.gst_rate), 2),
        },
        ...productSuggestions,
      ].slice(0, 5),
    },
  };
};

const executeCreateBillAction = async (params: {
  userId: number;
  language: AssistantLanguage;
  message: string;
}): Promise<AssistantActionExecution> => {
  logAssistantDebug("action.create_bill.started", {
    userId: params.userId,
  });

  const dedupeKey = buildAssistantActionKey(
    params.userId,
    "create_bill",
    params.message,
  );
  const recent = getRecentAssistantAction(dedupeKey);
  if (recent?.status === "success") {
    return {
      action: {
        ...recent,
        status: "noop",
        message:
          params.language === "hi"
            ? "यह command मैंने अभी run की थी। duplicate bill रोक दिया गया है।"
            : params.language === "hinglish"
              ? "Yeh command maine abhi run ki thi. Duplicate bill rok diya gaya hai."
              : "I just ran this command. I prevented a duplicate bill.",
      },
    };
  }

  const customerName = extractCustomerNameForBill(params.message);
  if (!customerName) {
    return {
      action: {
        type: "create_invoice",
        status: "failed",
        message:
          params.language === "hi"
            ? "कृपया ग्राहक का नाम भी दें। जैसे: Ravi Kumar के लिए 2 x Rice @ ₹45 का bill बनाओ।"
            : params.language === "hinglish"
              ? "Please customer name bhi do. Example: Ravi Kumar ke liye 2 x Rice @ ₹45 ka bill banao."
              : "Please include customer name too. Example: Create a bill for Ravi Kumar with 2 x Rice at ₹45.",
      },
    };
  }

  const customer =
    (await prisma.customer.findFirst({
      where: {
        user_id: params.userId,
        name: {
          equals: customerName,
          mode: "insensitive",
        },
      },
      select: { id: true, name: true },
    })) ??
    (await prisma.customer.findFirst({
      where: {
        user_id: params.userId,
        name: {
          contains: customerName,
          mode: "insensitive",
        },
      },
      orderBy: { created_at: "desc" },
      select: { id: true, name: true },
    }));

  if (!customer) {
    return {
      action: {
        type: "create_invoice",
        status: "failed",
        message:
          params.language === "hi"
            ? `मुझे "${customerName}" नाम का ग्राहक नहीं मिला। आप existing customer चुन सकते हैं या पहले ग्राहक जोड़ें।`
            : params.language === "hinglish"
              ? `Mujhe "${customerName}" naam ka customer nahi mila. Aap existing customer select kar sakte ho ya pehle customer add karo.`
              : `I could not find customer "${customerName}". You can select an existing customer or add one first.`,
      },
    };
  }

  const catalogProducts = await prisma.product.findMany({
    where: { user_id: params.userId },
    select: {
      id: true,
      name: true,
      price: true,
      gst_rate: true,
    },
    take: 400,
  });

  const catalogByExactName = new Map(
    catalogProducts.map((product) => [normalizeText(product.name), product]),
  );

  const explicitItems = extractInvoiceItemsFromMessage(params.message);
  const messageNormalized = normalizeText(params.message);

  const inferredItems = catalogProducts
    .filter((product) => {
      const normalizedName = normalizeText(product.name);
      return normalizedName.length >= 3 && messageNormalized.includes(normalizedName);
    })
    .slice(0, 8)
    .map((product) => ({
      name: product.name,
      quantity: 1,
      price: Math.max(0, toNumber(product.price)),
      productId: product.id,
      taxRate: toNumber(product.gst_rate),
      source: "catalog" as const,
    }));

  type DraftBillItem = {
    name: string;
    quantity: number;
    price: number;
    productId?: number;
    taxRate?: number;
    source: "explicit" | "catalog" | "top_seller";
  };

  let draftItems: DraftBillItem[] = [
    ...explicitItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      productId: undefined as number | undefined,
      taxRate: undefined as number | undefined,
      source: "explicit" as const,
    })),
    ...inferredItems,
  ];

  let autoCompleted = false;

  const validDraftItems = draftItems.filter(
    (item) =>
      item.name.trim().length > 0 &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      Number.isFinite(item.price) &&
      item.price > 0,
  );

  if (validDraftItems.length === 0) {
    const autocompleteItems = await buildAutocompleteItemsFromTopProducts({
      userId: params.userId,
      period: resolveAssistantPeriod(params.message),
    });

    draftItems = autocompleteItems.map((item) => {
      const exactMatch = catalogByExactName.get(normalizeText(item.name));
      return {
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        productId: exactMatch?.id,
        taxRate: item.gstRate ?? undefined,
        source: item.source,
      };
    });
    autoCompleted = draftItems.length > 0;
  }

  const validItems = draftItems.filter(
    (item) =>
      item.name.trim().length > 0 &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0 &&
      Number.isFinite(item.price) &&
      item.price > 0,
  );

  if (validItems.length === 0) {
    return {
      action: {
        type: "create_invoice",
        status: "failed",
        message:
          params.language === "hi"
            ? "Bill बनाने के लिए कम से कम 1 item और valid price चाहिए। जैसे: Ravi Kumar के लिए 2 x Rice @ ₹45 का bill बनाओ।"
            : params.language === "hinglish"
              ? "Bill banane ke liye kam se kam 1 item aur valid price chahiye. Example: Ravi Kumar ke liye 2 x Rice @ ₹45 ka bill banao."
              : "To create a bill, I need at least 1 item with a valid price. Example: Create a bill for Ravi Kumar with 2 x Rice at ₹45.",
      },
    };
  }

  const gstMemo = new Map<string, AssistantCopilotGstRecommendation>();
  let primaryGstRecommendation: AssistantCopilotGstRecommendation | undefined;

  const finalizedItems = await Promise.all(
    validItems.map(async (item) => {
      const normalizedName = normalizeText(item.name);
      const exactMatch =
        item.productId != null
          ? catalogProducts.find((product) => product.id === item.productId) ?? null
          : catalogByExactName.get(normalizedName) ?? null;

      let taxRate =
        item.taxRate != null && Number.isFinite(item.taxRate)
          ? roundMetric(item.taxRate, 2)
          : undefined;

      if (taxRate == null) {
        if (exactMatch) {
          taxRate = roundMetric(toNumber(exactMatch.gst_rate), 2);
          if (!primaryGstRecommendation) {
            primaryGstRecommendation = {
              rate: taxRate,
              confidence: "high",
              reason:
                params.language === "hi"
                  ? `${exactMatch.name} के existing catalog GST का उपयोग किया गया।`
                  : params.language === "hinglish"
                    ? `${exactMatch.name} ke existing catalog GST ka use kiya gaya.`
                    : `Used existing catalog GST for ${exactMatch.name}.`,
            };
          }
        } else {
          const cached = gstMemo.get(normalizedName);
          const recommendation =
            cached ??
            (await buildGstRecommendation({
              userId: params.userId,
              productName: item.name,
              language: params.language,
            }));
          gstMemo.set(normalizedName, recommendation);
          taxRate = recommendation.rate;
          if (!primaryGstRecommendation) {
            primaryGstRecommendation = recommendation;
          }
        }
      }

      return {
        ...item,
        productId: item.productId ?? exactMatch?.id,
        taxRate,
      };
    }),
  );

  const invoiceAutocomplete: AssistantCopilotInvoiceAutocomplete = {
    customerName: customer.name,
    autoCompleted,
    items: finalizedItems.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      gstRate: item.taxRate ?? null,
      source: item.source,
    })),
  };

  const createdInvoice = await createInvoiceRecord(params.userId, {
    customer_id: customer.id,
    date: new Date(),
    due_date: new Date(),
    discount: 0,
    discount_type: "FIXED",
    status: InvoiceStatus.SENT,
    sync_sales: false,
    notes: "Created via Assistant",
    items: finalizedItems.map((item) => ({
      product_id: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.taxRate,
    })),
  });

  emitDashboardUpdate({ userId: params.userId, source: "assistant.invoice.create" });

  logAssistantDebug("action.create_bill.completed", {
    userId: params.userId,
    invoiceId: createdInvoice.id,
  });

  const action: AssistantAction = {
    type: "create_invoice",
    status: "success",
    message:
      params.language === "hi"
        ? `Bill बन गया: ${createdInvoice.invoice_number}.${autoCompleted ? " मैंने items auto-complete भी किए हैं।" : ""} क्या अब PDF download करें या print करें?`
        : params.language === "hinglish"
          ? `Bill ban gaya: ${createdInvoice.invoice_number}.${autoCompleted ? " Maine items auto-complete bhi kiye hain." : ""} Kya ab PDF download karein ya print karein?`
          : `Bill created: ${createdInvoice.invoice_number}.${autoCompleted ? " I also auto-completed the items for you." : ""} Do you want to download PDF or print now?`,
    resourceId: createdInvoice.id,
    resourceLabel: createdInvoice.invoice_number,
    route: `/invoices/history/${createdInvoice.id}`,
  };

  rememberAssistantAction(dedupeKey, action);
  return {
    action,
    copilot: {
      invoiceAutocomplete,
      gstRecommendation: primaryGstRecommendation,
      productSuggestions: await searchProductSuggestions({
        userId: params.userId,
        message: params.message,
      }),
    },
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
    smartInsights?: AssistantCopilotInsight[];
  },
) => {
  if (intent === "smart_insights" && extra?.smartInsights?.length) {
    return extra.smartInsights.slice(0, 3).map((insight) => ({
      label: insight.title,
      value: insight.value ?? insight.detail,
    }));
  }

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

const buildSmartInsightsAnswer = (
  language: AssistantLanguage,
  period: AssistantPeriod,
  insights: AssistantCopilotInsight[],
) => {
  const periodLabel = formatPeriodLabel(period, language);
  if (insights.length === 0) {
    if (language === "hi") {
      return `${periodLabel} के लिए अभी पर्याप्त sales pattern data नहीं है। थोड़ा और billing data आने पर मैं smart insights दिखा दूँगा।`;
    }

    if (language === "hinglish") {
      return `${periodLabel} ke liye abhi enough sales pattern data nahi hai. Thoda aur billing data aate hi main smart insights dikha dunga.`;
    }

    return `I do not have enough sales pattern data for ${periodLabel} yet. Once more billing data is available, I can show smart insights.`;
  }

  const [first, second] = insights;
  if (!second) {
    return first.detail;
  }

  return `${first.detail} ${second.detail}`;
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
    return `${historyHint}मैं उसे ठीक से समझ नहीं पाया। ऐसे पूछें: "आज की sales दिखाओ", "Ravi Kumar के लिए bill बनाओ", या "Bread product ₹40 पर GST 5 जोड़ो".`;
  }

  if (language === "hinglish") {
    return `${historyHint}Main is query ko clearly samajh nahi paaya. Aise try karo: "Show today's sales", "Create a bill for Ravi Kumar", ya "Add product Bread at ₹40 with GST 5".`;
  }

  return `${historyHint}I could not understand that clearly. Try: "Show today's sales", "Create a bill for Ravi Kumar", or "Add product Bread at ₹40 with GST 5".`;
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
  const startedAt = Date.now();
  const parsed = parseAssistantQuery(params.message, params.history ?? []);

  logAssistantDebug("query.received", {
    userId: params.userId,
    intent: parsed.intent,
    period: parsed.period.key,
    language: parsed.language,
    usedHistory: parsed.usedHistory,
  });

  try {
    if (parsed.intent === "add_product") {
      const result = await executeAddProductAction({
        userId: params.userId,
        language: parsed.language,
        message: parsed.conversationMessage,
      });

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: result.action.message,
        highlights:
          result.action.resourceLabel
            ? [
                {
                  label: parsed.language === "hi" ? "Product" : "Product",
                  value: result.action.resourceLabel,
                },
              ]
            : [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: result.action,
        copilot: result.copilot,
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        actionStatus: result.action.status,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "create_bill") {
      const result = await executeCreateBillAction({
        userId: params.userId,
        language: parsed.language,
        message: parsed.conversationMessage,
      });

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: result.action.message,
        highlights:
          result.action.resourceLabel
            ? [
                {
                  label: parsed.language === "hi" ? "Invoice" : "Invoice",
                  value: result.action.resourceLabel,
                },
              ]
            : [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: result.action,
        copilot: result.copilot,
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        actionStatus: result.action.status,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "smart_insights") {
      const smartInsights = await buildSmartInsightsPayload({
        userId: params.userId,
        language: parsed.language,
        period: parsed.period,
      });

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: buildSmartInsightsAnswer(parsed.language, parsed.period, smartInsights),
        highlights: smartInsights.slice(0, 3).map((insight) => ({
          label: insight.title,
          value: insight.value ?? insight.detail,
        })),
        examples: buildExamples(parsed.language),
        copilot: {
          smartInsights,
        },
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "help") {
      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: buildHelpAnswer(parsed.language, parsed.usedHistory),
        highlights: [],
        examples: buildExamples(parsed.language),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    const needsCopilotSummary =
      parsed.intent === "budget_plan" ||
      parsed.intent === "savings_suggestion" ||
      parsed.intent === "bill_reminder" ||
      parsed.intent === "health_score" ||
      parsed.intent === "behavior_insights" ||
      parsed.intent === "goal_tracking" ||
      parsed.intent === "affordability";

    const [snapshotResult, copilotSummary] = await Promise.all([
      buildAssistantSnapshot(params.userId, parsed.period),
      needsCopilotSummary
        ? buildFinancialCopilot({
            userId: params.userId,
            language: parsed.language,
            fallbackMessage: parsed.conversationMessage,
            decisionAmount: parsed.amount,
          })
        : Promise.resolve<Awaited<ReturnType<typeof buildFinancialCopilot>> | null>(
            null,
          ),
    ]);

    const { snapshot, purchases } = snapshotResult;

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

    const reply: AssistantReply = {
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

    logAssistantDebug("query.completed", {
      userId: params.userId,
      intent: parsed.intent,
      durationMs: Date.now() - startedAt,
    });

    return reply;
  } catch (error) {
    logAssistantDebug("query.failed", {
      userId: params.userId,
      intent: parsed.intent,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  }
};
