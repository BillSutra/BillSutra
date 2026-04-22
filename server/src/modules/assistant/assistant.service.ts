import { Prisma } from "@prisma/client";
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
import type {
  AssistantAction as ContractAssistantAction,
  AssistantCommand as ContractAssistantCommand,
  AssistantCommandIntent as ContractAssistantCommandIntent,
  AssistantCopilotGstRecommendation as ContractAssistantCopilotGstRecommendation,
  AssistantCopilotInsight as ContractAssistantCopilotInsight,
  AssistantCopilotInvoiceItem as ContractAssistantCopilotInvoiceItem,
  AssistantCopilotPayload as ContractAssistantCopilotPayload,
  AssistantCopilotProductSuggestion as ContractAssistantCopilotProductSuggestion,
  AssistantHistoryMessage as ContractAssistantHistoryMessage,
  AssistantIntent as ContractAssistantIntent,
  AssistantReply as ContractAssistantReply,
  AssistantStructuredPayload as ContractAssistantStructuredPayload,
} from "./assistant.contract.js";

type AssistantIntent = ContractAssistantIntent;
type AssistantHistoryMessage = ContractAssistantHistoryMessage;

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
  navigationTarget: string | null;
  conversationMessage: string;
  usedHistory: boolean;
};

type AssistantAction = ContractAssistantAction;
type AssistantCopilotProductSuggestion =
  ContractAssistantCopilotProductSuggestion;
type AssistantCopilotInvoiceItem = ContractAssistantCopilotInvoiceItem;
type AssistantCopilotGstRecommendation =
  ContractAssistantCopilotGstRecommendation;
type AssistantCopilotInsight = ContractAssistantCopilotInsight;
type AssistantCopilotPayload = ContractAssistantCopilotPayload;
type AssistantCommandIntent = ContractAssistantCommandIntent;
type AssistantCommand = ContractAssistantCommand;
type AssistantStructuredPayload = ContractAssistantStructuredPayload;

type AssistantActionExecution = {
  action: AssistantAction;
  copilot?: AssistantCopilotPayload;
  command?: AssistantCommand;
};

export type AssistantReply = ContractAssistantReply;

const SYNCED_INVOICE_NOTE_PATTERN = /Synced from invoice\s+/i;
const DEVANAGARI_PATTERN = /[\u0900-\u097F]/;
const BILLING_ONLY_FALLBACK_MESSAGE =
  "Main sirf billing aur products mein help kar sakta hoon.";
const DASHBOARD_ROUTE_TARGETS = {
  simpleBill: "/dashboard/simple-bill",
  products: "/dashboard/products",
  customers: "/dashboard/customers",
  invoices: "/dashboard/invoices",
} as const;

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
  "create a bill",
  "create bill for",
  "create a bill for",
  "make bill",
  "make a bill",
  "new bill",
  "generate bill",
  "generate a bill",
  "bill generate karo",
  "bill bana do",
  "bill banao",
  "create invoice",
  "create an invoice",
  "make invoice",
  "make an invoice",
  "invoice for",
  "new invoice",
  "bill bana",
  "bill ban",
  "ke liye bill",
  "ka bill",
  "invoice bana",
  "बिल बनाओ",
  "इनवॉइस बनाओ",
];

const SHOW_INVOICES_KEYWORDS = [
  "show invoices",
  "show invoice",
  "invoice list",
  "invoices list",
  "bill list",
  "bills list",
  "show bills",
  "invoice history",
  "bill history",
  "invoices dikhao",
  "invoice dikhao",
  "bill dikhao",
  "bills dikhao",
  "invoices dikhana",
  "बिल दिखाओ",
  "इनवॉइस दिखाओ",
  "इनवॉइस लिस्ट",
];

const SHOW_CUSTOMERS_KEYWORDS = [
  "show customers",
  "customer list",
  "customers list",
  "show customer",
  "customers dikhao",
  "customer dikhao",
  "grahak list",
  "grahak dikhao",
  "ग्राहक दिखाओ",
  "कस्टमर दिखाओ",
  "ग्राहक सूची",
];

const SHOW_PRODUCTS_KEYWORDS = [
  "show products",
  "show product",
  "products dikhao",
  "product dikhao",
  "product list",
  "products list",
  "प्रोडक्ट दिखाओ",
  "प्रोडक्ट लिस्ट",
];

const NAVIGATE_KEYWORDS = [
  "open",
  "go to",
  "navigate",
  "kholo",
  "khol do",
  "page kholo",
  "le chalo",
  "open page",
];

const resolveNavigationTarget = (message: string) => {
  const normalized = normalizeText(message);

  if (!hasKeyword(normalized, NAVIGATE_KEYWORDS)) {
    return null;
  }

  if (
    /\b(simple\s*bill|new\s*bill|bill\s*page|invoice\s*page)\b/i.test(
      normalized,
    )
  ) {
    return DASHBOARD_ROUTE_TARGETS.simpleBill;
  }

  if (/\b(products?|product\s*page|inventory)\b/i.test(normalized)) {
    return DASHBOARD_ROUTE_TARGETS.products;
  }

  if (/\b(customers?|customer\s*page|grahak)\b/i.test(normalized)) {
    return DASHBOARD_ROUTE_TARGETS.customers;
  }

  if (
    /\b(invoices?|bills?|invoice\s*history|bill\s*history)\b/i.test(normalized)
  ) {
    return DASHBOARD_ROUTE_TARGETS.invoices;
  }

  return null;
};

const ADD_PRODUCT_KEYWORDS = [
  "add product",
  "create product",
  "new product",
  "product add",
  "add item",
  "add karo",
  "item add karo",
  "daal do",
  "dal do",
  "jod do",
  "product banao",
  "product bana",
  "product dalo",
  "product daalo",
  "प्रोडक्ट जोड़ो",
  "प्रोडक्ट बनाओ",
  "प्रोडक्ट डालो",
];

const REMOVE_PRODUCT_KEYWORDS = [
  "remove product",
  "remove item",
  "delete product",
  "delete item",
  "remove",
  "delete",
  "hatao",
  "hata do",
  "hatado",
  "remove karo",
  "delete karo",
  "प्रोडक्ट हटाओ",
  "हटाओ",
  "हटा दो",
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
    "Create a bill for Ravi Kumar",
    "Add product Bread at ₹40 with GST 5",
    "Remove product Bread",
    "Show invoices",
    "Show customers",
    "Show products",
  ],
  hi: [
    "Ravi Kumar के लिए bill बनाओ",
    "Bread product ₹40 पर GST 5 के साथ जोड़ो",
    "Bread product हटा दो",
    "इनवॉइस दिखाओ",
    "ग्राहक दिखाओ",
    "प्रोडक्ट्स दिखाओ",
  ],
  hinglish: [
    "Ravi Kumar ke liye bill banao",
    "Bread product ₹40 par GST 5 ke saath add karo",
    "Bread product hata do",
    "Invoices dikhao",
    "Customers dikhao",
    "Products dikhao",
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

const buildStructuredPayload = (params: {
  intent: AssistantCommandIntent;
  data?: Record<string, unknown>;
  action:
    | "CREATE_BILL"
    | "ADD_PRODUCT"
    | "REMOVE_PRODUCT"
    | "NAVIGATE"
    | "SHOW_PRODUCTS"
    | "SHOW_CUSTOMERS"
    | "SHOW_INVOICES"
    | "NONE";
  target?: string;
  message: string;
}): AssistantStructuredPayload => ({
  intent: params.intent,
  data: params.data ?? {},
  action: params.action,
  target: params.target,
  message: params.message,
});

const toNumber = (value: unknown) => Number(value ?? 0);

const roundMetric = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const TRANSCRIPT_FILLER_PATTERNS = [
  /\b(?:uh+|um+|hmm+|erm+|ah+)\b/gi,
  /\b(?:actually|basically|matlab|acha|accha|arey|arre)\b/gi,
  /\b(?:you\s+know)\b/gi,
];

const sanitizeTranscriptMessage = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) {
    return message;
  }

  let sanitized = trimmed;
  for (const pattern of TRANSCRIPT_FILLER_PATTERNS) {
    sanitized = sanitized.replace(pattern, " ");
  }

  sanitized = sanitized.replace(/\s+/g, " ").trim();
  return sanitized || trimmed;
};

const normalizeForActionKey = (value: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9\u0900-\u097f ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

const stripLeadingProductFillers = (value: string) =>
  value
    .replace(
      /^(?:(?:ek|a|an|the|ye|this|product|item|add|create|new|karo|kar|do|de|please|plz|bhaiya|bhai|sir|madam|didi|ji)\s+)+/i,
      "",
    )
    .replace(
      /^(?:ek|a|an|the|ye|this|product|item|please|plz|bhaiya|bhai|sir|madam|didi|ji)$/i,
      "",
    )
    .trim();

const PRODUCT_NAME_NOISE_WORDS = new Set([
  "ek",
  "naam",
  "name",
  "ka",
  "ki",
  "ke",
  "product",
  "item",
  "add",
  "create",
  "new",
  "karo",
  "kar",
  "do",
  "de",
  "daal",
  "dal",
  "banana",
  "bana",
  "jismein",
  "jisme",
  "uska",
  "uske",
  "uski",
  "price",
  "worth",
  "rs",
  "inr",
  "gst",
  "percent",
  "pct",
  "hai",
  "aur",
  "with",
  "please",
  "plz",
  "bhaiya",
  "bhai",
  "sir",
  "madam",
  "didi",
  "ji",
  "jiska",
  "jis",
  "jiske",
  "jiski",
  "usmein",
  "usme",
]);

const titleCaseLatinToken = (token: string) =>
  /^[a-z][a-z0-9().&\-]*$/i.test(token)
    ? `${token.charAt(0).toUpperCase()}${token.slice(1).toLowerCase()}`
    : token;

const normalizeProductNameForAdd = (rawValue: string) => {
  const tokens = rawValue
    .replace(/["']/g, " ")
    .split(/[^a-z0-9\u0900-\u097f().&\-]+/i)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !/^\d+(?:\.\d+)?$/.test(token))
    .filter((token) => !PRODUCT_NAME_NOISE_WORDS.has(token.toLowerCase()));

  if (tokens.length === 0) {
    return null;
  }

  return tokens.map((token) => titleCaseLatinToken(token)).join(" ");
};

const extractCustomerNameForBill = (message: string) => {
  const compactMessage = message.replace(/\s+/g, " ").trim();
  const customerPatterns = [
    /(?:for|to|customer)\s+["']([^"']{2,80})["']/i,
    /(?:bill|invoice|बिल|इनवॉइस)\s+(?:for|to)\s+["']([^"']{2,80})["']/i,
    /([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s.&\-]{1,80}?)\s+(?:ke\s+liye|के\s*लिए)\s+(?:bill|invoice|बिल|इनवॉइस)/i,
    /([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s.&\-]{1,80}?)\s+(?:ka|ki|ke|का|की|के)\s+(?:bill|invoice|बिल|इनवॉइस)/i,
    /(?:for|to|customer)\s+([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s.&\-]{1,80})/i,
    /(?:bill|invoice|बिल|इनवॉइस)\s+(?:for|to)\s+([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s.&\-]{1,80})/i,
  ];

  for (const pattern of customerPatterns) {
    const candidate = compactMessage.match(pattern)?.[1];
    if (!candidate) {
      continue;
    }

    const cleaned = cleanActionEntity(
      candidate
        .replace(/^(?:please|plz)\s+/i, "")
        .replace(/\s+(?:ji|sir|madam)$/i, ""),
    );

    if (cleaned.length >= 2) {
      return cleaned;
    }
  }

  return null;
};

type AssistantInvoiceItemCandidate = {
  name: string;
  quantity: number;
  price: number;
};

export type AssistantCreateBillParseResult = {
  intent: "CREATE_BILL";
  customerName: string | null;
};

export type AssistantAddProductParseResult = {
  intent: "ADD_PRODUCT";
  productName: string | null;
  price: number | null;
  gst: number | null;
  hasPriceHint: boolean;
  hasGstMention: boolean;
};

export type AssistantRemoveProductParseResult = {
  intent: "REMOVE_PRODUCT";
  productName: string | null;
  hasRemoveKeyword: boolean;
};

type AssistantNumericToken = {
  value: number;
  start: number;
  end: number;
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

export const parseCreateBillMessage = (
  message: string,
): AssistantCreateBillParseResult => ({
  intent: "CREATE_BILL",
  customerName: extractCustomerNameForBill(message),
});

const extractNumericTokens = (message: string): AssistantNumericToken[] => {
  const tokens: AssistantNumericToken[] = [];

  for (const match of message.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?/g)) {
    const raw = match[0] ?? "";
    const index = match.index ?? -1;
    if (!raw || index < 0) {
      continue;
    }

    const start = index;
    const end = start + raw.length;
    const before = message[start - 1] ?? " ";
    const after = message[end] ?? " ";

    // Ignore numbers that are directly attached to letters (e.g. 18w).
    if (/[a-z]/i.test(before) || /[a-z]/i.test(after)) {
      continue;
    }

    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      continue;
    }

    tokens.push({ value, start, end });
  }

  return tokens;
};

const extractRequestedGstRateDetails = (message: string) => {
  const hasGstMention = /\bgst\b/i.test(message);

  if (
    hasKeyword(message, [
      "without gst",
      "no gst",
      "gst free",
      "gst nahi",
      "gst nahin",
    ])
  ) {
    return {
      gst: 0,
      hasGstMention: true,
    };
  }

  const patterns = [
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:%|percent|pct)\s*gst/i,
    /gst(?:\s*(?:of|rate|is|=|:|ke\s*saath|ke\s*liye|ka|ki|ko))?\s*(\d+(?:,\d{3})*(?:\.\d+)?)(?:\s*(?:%|percent|pct))?/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const raw = match?.[1];
    if (!raw) {
      continue;
    }

    const parsed = Number(raw.replace(/,/g, ""));
    if (Number.isFinite(parsed)) {
      return {
        gst: parsed,
        hasGstMention: true,
      };
    }
  }

  const standaloneNumber = extractStandaloneNumberReply(message);
  if (
    standaloneNumber != null &&
    standaloneNumber >= 0 &&
    standaloneNumber <= 28
  ) {
    return {
      gst: standaloneNumber,
      hasGstMention: true,
    };
  }

  return {
    gst: null,
    hasGstMention,
  };
};

const extractPriceForAddProduct = (message: string, gstRate: number | null) => {
  const hasPriceHint =
    /(₹|rs\.?|inr)/i.test(message) ||
    /\b(price|worth|cost|mrp|at|ka)\b/i.test(message);
  const numericTokens = extractNumericTokens(message);

  if (numericTokens.length === 0) {
    return {
      price: null,
      hasPriceHint,
    };
  }

  const priceCandidates = numericTokens.filter(
    (token) =>
      token.value > 0 &&
      (gstRate == null || Math.abs(token.value - gstRate) >= 0.0001),
  );

  if (priceCandidates.length === 0) {
    return {
      price: null,
      hasPriceHint,
    };
  }

  const scored = priceCandidates
    .map((token) => {
      const localWindow = message.slice(
        Math.max(0, token.start - 8),
        Math.min(message.length, token.end + 8),
      );
      const leftWindow = normalizeText(
        message.slice(Math.max(0, token.start - 20), token.start),
      );
      const rightWindow = normalizeText(
        message.slice(token.end, token.end + 20),
      );

      let score = 0;

      if (/(₹|rs\.?|inr)/i.test(localWindow)) {
        score += 5;
      }

      if (/(price|worth|cost|mrp|at|for|ka)\s*$/.test(leftWindow)) {
        score += 4;
      }

      if (/^\s*(₹|rs\.?|inr)/i.test(message.slice(token.end, token.end + 8))) {
        score += 2;
      }

      if (/\bgst\b/.test(normalizeText(localWindow))) {
        score -= 6;
      }

      if (gstRate != null && Math.abs(token.value - gstRate) < 0.0001) {
        score -= 8;
      }

      if (token.value > 28) {
        score += 2;
      }

      if (token.value <= 0) {
        score -= 20;
      }

      if (rightWindow.startsWith("ka")) {
        score += 3;
      }

      return {
        value: token.value,
        score,
      };
    })
    .sort((left, right) => {
      if (right.score === left.score) {
        return right.value - left.value;
      }

      return right.score - left.score;
    });

  const best = scored[0];
  if (best) {
    return {
      price: roundMetric(best.value, 2),
      hasPriceHint,
    };
  }

  return {
    price: null,
    hasPriceHint,
  };
};

const REMOVE_PRODUCT_VERB_PATTERN =
  /(?:\b(?:remove|delete)(?:\s*karo)?\b|\b(?:hatao|hata\s*do|hatado)\b|हटाओ|हटा\s*दो)/i;

const stripLeadingRemoveFillers = (value: string) =>
  value
    .replace(
      /^(?:(?:remove|delete|hatao|hata|hatado|product|item|please|plz|ye|this|the|karo|kar|do|de)\s+)+/i,
      "",
    )
    .trim();

const normalizeRemoveProductName = (value: string) =>
  stripLeadingRemoveFillers(cleanActionEntity(value))
    .replace(/\bas\s+(?:a\s+)?product\b.*$/i, " ")
    .replace(/\bfrom\s+products?\b.*$/i, " ")
    .replace(/\b(?:naam|name)\s*(?:ka|ki|ke)?\b/gi, " ")
    .replace(/\b(?:products?|items?)\b$/i, " ")
    .replace(/\b(?:as|from)\b$/i, " ")
    .replace(/^(?:karo|kar\s*do|kar|do|de)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

const extractProductNameForRemove = (message: string) => {
  const quoted = message.match(/["']([^"']{2,80})["']/);
  if (quoted?.[1]) {
    const cleanedQuoted = normalizeRemoveProductName(quoted[1]);
    if (cleanedQuoted.length >= 2) return cleanedQuoted;
  }

  const beforeAction = message.match(
    /([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,80})\s+(?:(?:remove|delete)(?:\s*karo)?|hatao|hata\s*do|hatado)/i,
  );
  if (beforeAction?.[1]) {
    const cleanedBeforeAction = normalizeRemoveProductName(beforeAction[1]);
    if (cleanedBeforeAction.length >= 2) {
      return cleanedBeforeAction;
    }
  }

  const afterAction = message.match(
    /(?:(?:remove|delete)(?:\s*karo)?|hatao|hata\s*do|hatado)\s+(?:product|item|ye|this|the|please|plz)?\s*(?!product\b|item\b|ye\b|this\b|the\b|please\b|plz\b|karo\b)([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,80})/i,
  );
  if (afterAction?.[1]) {
    const cleanedAfterAction = normalizeRemoveProductName(afterAction[1]);
    if (cleanedAfterAction.length >= 2) {
      return cleanedAfterAction;
    }
  }

  const candidate = message
    .replace(/["']/g, " ")
    .replace(
      /(?:remove|delete|hatao|hata\s*do|hatado|remove\s*karo|delete\s*karo|हटा\s*दो|हटाओ)/gi,
      " ",
    )
    .replace(
      /\b(product|item|ye|this|the|please|plz|karo|kar|do|de|ko)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return null;
  }

  const cleaned = normalizeRemoveProductName(candidate);
  return cleaned.length >= 2 ? cleaned : null;
};

const extractProductNameForCreate = (message: string) => {
  const quoted = message.match(/["']([^"']{2,80})["']/);
  if (quoted?.[1]) {
    const cleanedQuoted = normalizeProductNameForAdd(
      stripLeadingProductFillers(cleanActionEntity(quoted[1])),
    );
    if (cleanedQuoted && cleanedQuoted.length >= 2) return cleanedQuoted;
  }

  const namedBeforeLabel = message.match(
    /([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,80})\s+(?:name|naam)\s*(?:is|:|ka|ki|ke)\b/i,
  );
  if (namedBeforeLabel?.[1]) {
    const cleanedNamedBeforeLabel = normalizeProductNameForAdd(
      stripLeadingProductFillers(cleanActionEntity(namedBeforeLabel[1])),
    );
    if (cleanedNamedBeforeLabel && cleanedNamedBeforeLabel.length >= 2) {
      return cleanedNamedBeforeLabel;
    }
  }

  const namedByLabel = message.match(
    /(?:name|naam)\s*(?:is|:|called|named|ka|ki|ke)\s*(?!\d)([a-z\u0900-\u097f][a-z0-9\u0900-\u097f\s().&\-]{1,80})/i,
  );
  if (namedByLabel?.[1]) {
    const cleanedNamedByLabel = normalizeProductNameForAdd(
      stripLeadingProductFillers(cleanActionEntity(namedByLabel[1])),
    );
    if (
      cleanedNamedByLabel &&
      cleanedNamedByLabel.length >= 2 &&
      !/^(?:ka|ki|ke|karo|kar|do|de|item|product|price|gst|\d)/i.test(
        cleanedNamedByLabel,
      )
    ) {
      return cleanedNamedByLabel;
    }
  }

  let candidate = message
    .replace(/["']/g, " ")
    .replace(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:%|percent|pct)\s*gst/gi, " ")
    .replace(
      /gst(?:\s*(?:of|rate|is|=|:|ke\s*saath|ke\s*liye|ka|ki|ko))?\s*\d+(?:,\d{3})*(?:\.\d+)?(?:\s*(?:%|percent|pct))?/gi,
      " ",
    )
    .replace(/\b(?:without|no)\s+gst\b/gi, " ")
    .replace(
      /\b(?:price|worth|cost|mrp|at|for)\s*(?:is\s*)?(?:₹|rs\.?|inr)?\s*\d+(?:,\d{3})*(?:\.\d+)?/gi,
      " ",
    )
    .replace(/(?:₹|rs\.?|inr)\s*\d+(?:,\d{3})*(?:\.\d+)?/gi, " ")
    .replace(/\d+(?:,\d{3})*(?:\.\d+)?\s*(?:₹|rs\.?|inr)\b/gi, " ")
    .replace(/\b\d+(?:,\d{3})*(?:\.\d+)?\s*ka\b/gi, " ")
    .replace(/\b\d+(?:,\d{3})*(?:\.\d+)?\b/g, " ")
    .replace(
      /\b(add|create|new|product|item|naam|name|called|karo|kar|daal|dal|do|de|with|without|please|plz|ek|a|an|the|ko|ke|ki|ka|saath|mein|me|of|and|aur|gst|price|worth|cost|mrp|rs|inr)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate) {
    return null;
  }

  candidate = cleanActionEntity(candidate)
    .replace(
      /^(?:(?:ek|a|an|the|ye|this|product|item|add|create|new|karo|kar|do|de|please|plz)\s+)+/i,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  const normalizedCandidate = normalizeProductNameForAdd(candidate);
  return normalizedCandidate && normalizedCandidate.length >= 2
    ? normalizedCandidate
    : null;
};

export const parseAddProductMessage = (
  message: string,
): AssistantAddProductParseResult => {
  const gst = extractRequestedGstRateDetails(message);
  const price = extractPriceForAddProduct(message, gst.gst);

  return {
    intent: "ADD_PRODUCT",
    productName: extractProductNameForCreate(message),
    price: price.price,
    gst: gst.gst,
    hasPriceHint: price.hasPriceHint,
    hasGstMention: gst.hasGstMention,
  };
};

export const parseRemoveProductMessage = (
  message: string,
): AssistantRemoveProductParseResult => {
  const normalized = normalizeText(message);

  return {
    intent: "REMOVE_PRODUCT",
    productName: extractProductNameForRemove(message),
    hasRemoveKeyword:
      hasKeyword(message, REMOVE_PRODUCT_KEYWORDS) ||
      REMOVE_PRODUCT_VERB_PATTERN.test(normalized),
  };
};

const looksLikeRemoveProductIntent = (message: string) => {
  const parsed = parseRemoveProductMessage(message);
  if (!parsed.hasRemoveKeyword) {
    return false;
  }

  const normalized = normalizeText(message);
  const referencesOtherEntity =
    /\b(invoice|bill|customer|supplier|purchase|sale|payment)\b/i.test(
      normalized,
    ) && !/\b(product|item)\b/i.test(normalized);

  if (referencesOtherEntity) {
    return false;
  }

  return true;
};

const looksLikeAddProductIntent = (message: string) => {
  const normalized = normalizeText(message);

  if (
    hasKeyword(message, REMOVE_PRODUCT_KEYWORDS) ||
    REMOVE_PRODUCT_VERB_PATTERN.test(normalized)
  ) {
    return false;
  }

  if (hasKeyword(message, ADD_PRODUCT_KEYWORDS)) {
    return true;
  }

  if (
    hasKeyword(message, [
      ...CREATE_BILL_KEYWORDS,
      ...SMART_INSIGHT_KEYWORDS,
      ...AFFORDABILITY_KEYWORDS,
      ...TOP_SPEND_KEYWORDS,
      ...BUDGET_KEYWORDS,
      ...SAVINGS_KEYWORDS,
      ...REMINDER_KEYWORDS,
      ...PENDING_KEYWORDS,
      ...CASHFLOW_KEYWORDS,
      ...PROFIT_KEYWORDS,
      ...SALES_KEYWORDS,
    ])
  ) {
    return false;
  }

  const parsed = parseAddProductMessage(message);
  const hasActionVerb =
    /\b(add|create|new|karo|kar do|daal do|dal do|jodo|banao|banado)\b/i.test(
      normalized,
    );
  const hasProductCue = /\b(product|item|naam|name|sku)\b/i.test(normalized);
  const hasCurrencyCue =
    /(₹|rs\.?|inr)/i.test(message) ||
    /\b(price|worth|cost|mrp|ka)\b/i.test(normalized);

  if (hasActionVerb && (parsed.productName || parsed.price != null)) {
    return true;
  }

  if (parsed.productName && parsed.hasGstMention) {
    return true;
  }

  if (
    parsed.productName &&
    parsed.price != null &&
    (hasCurrencyCue || hasProductCue)
  ) {
    return true;
  }

  if (parsed.productName && parsed.price != null && parsed.gst != null) {
    return true;
  }

  return false;
};

const CREATE_BILL_VERB_PATTERN =
  /\b(create|make|generate|banao|bana|banado|ban do|bana do)\b/i;
const BILL_NOUN_PATTERN = /\b(bill|invoice|बिल|इनवॉइस)\b/i;
const BILL_CONTEXT_PATTERN =
  /(?:ke\s+liye|के\s*लिए|ka\s+bill|ki\s+bill|ke\s+bill)/i;

const looksLikeCreateBillIntent = (message: string) => {
  if (hasKeyword(message, CREATE_BILL_KEYWORDS)) {
    return true;
  }

  const normalized = normalizeText(message);
  const hasBillNoun = BILL_NOUN_PATTERN.test(message);
  if (!hasBillNoun) {
    return false;
  }

  return (
    CREATE_BILL_VERB_PATTERN.test(normalized) ||
    BILL_CONTEXT_PATTERN.test(normalized)
  );
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
  return keywords.some((keyword) =>
    normalized.includes(normalizeText(keyword)),
  );
};

const containsDevanagari = (message: string) =>
  DEVANAGARI_PATTERN.test(message);

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

  return Math.max(
    0,
    toNumber(invoice.total) - resolveInvoicePaidAmount(invoice),
  );
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
  const totalAmount =
    toNumber(purchase.totalAmount) || toNumber(purchase.total);

  if (realizedAmount <= 0 || totalAmount <= 0) {
    return 0;
  }

  return Math.min(1, realizedAmount / totalAmount);
};

const resolveConversationMessage = (
  message: string,
  history: AssistantHistoryMessage[],
) => {
  return {
    conversationMessage: message,
    usedHistory: false,
  };
};

const STANDALONE_NUMBER_REPLY_PATTERN =
  /^(?:₹|rs\.?|inr)?\s*\d+(?:,\d{3})*(?:\.\d+)?\s*%?$/i;

const extractStandaloneNumberReply = (message: string) => {
  const match = message
    .trim()
    .replace(/,/g, "")
    .match(/^(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*%?$/i);
  const raw = match?.[1] ?? null;
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildRecentAddProductContext = (history: AssistantHistoryMessage[]) => {
  const recentUserMessages = [...history]
    .reverse()
    .filter((entry) => entry.role === "user" && entry.content.trim().length > 0)
    .map((entry) => sanitizeTranscriptMessage(entry.content));

  let productName: string | null = null;
  let price: number | null = null;
  let gst: number | null = null;

  for (const userMessage of recentUserMessages) {
    const parsed = parseAddProductMessage(userMessage);
    const hasStrongAddCue =
      looksLikeAddProductIntent(userMessage) ||
      hasKeyword(userMessage, ADD_PRODUCT_KEYWORDS);

    if (!productName && parsed.productName && hasStrongAddCue) {
      productName = parsed.productName;
    }

    if (price == null && parsed.price != null && parsed.price > 0) {
      price = parsed.price;
    }

    if (
      gst == null &&
      parsed.gst != null &&
      parsed.gst >= 0 &&
      parsed.gst <= 28
    ) {
      gst = parsed.gst;
    }

    if (productName && price != null && gst != null) {
      break;
    }
  }

  return {
    productName,
    price,
    gst,
  };
};

const resolveAddProductFollowUpMessage = (
  message: string,
  history: AssistantHistoryMessage[],
) => {
  const normalizedMessage = normalizeText(message);
  const recentAssistantMessage = [...history]
    .reverse()
    .find(
      (entry) => entry.role === "assistant" && entry.content.trim().length > 0,
    )?.content;

  if (!recentAssistantMessage) {
    return null;
  }

  const normalizedAssistantMessage = normalizeText(recentAssistantMessage);
  const assistantAskedForGst =
    /\bgst\b/.test(normalizedAssistantMessage) &&
    /\b(kitna|percent|number|rate|apply|0\s*se\s*28)\b/.test(
      normalizedAssistantMessage,
    );
  const assistantAskedForPrice =
    /\bprice\b/.test(normalizedAssistantMessage) &&
    /\b(bata|share|tell|bolo|required|need)\b/.test(normalizedAssistantMessage);

  const compactFollowUpMessage =
    message.trim().length <= 20 ||
    STANDALONE_NUMBER_REPLY_PATTERN.test(message) ||
    /^(?:gst|price|₹|rs\.?|inr)/i.test(normalizedMessage);

  if (
    !compactFollowUpMessage &&
    !assistantAskedForGst &&
    !assistantAskedForPrice
  ) {
    return null;
  }

  const currentParsed = parseAddProductMessage(message);
  const context = buildRecentAddProductContext(history);
  const standaloneNumber = extractStandaloneNumberReply(message);

  const productName = currentParsed.productName ?? context.productName;
  let price = currentParsed.price;
  let gst = currentParsed.gst;

  if (
    assistantAskedForPrice &&
    price == null &&
    standaloneNumber != null &&
    standaloneNumber > 0
  ) {
    price = standaloneNumber;
  }

  if (
    assistantAskedForGst &&
    (gst == null || gst < 0 || gst > 28) &&
    standaloneNumber != null &&
    standaloneNumber >= 0 &&
    standaloneNumber <= 28
  ) {
    gst = standaloneNumber;
  }

  if (price == null && context.price != null && assistantAskedForGst) {
    price = context.price;
  }

  if (!productName || price == null) {
    return null;
  }

  const rebuiltMessage =
    gst != null && assistantAskedForGst
      ? `Add product ${productName} at ₹${roundMetric(price, 2)} with GST ${roundMetric(gst, 2)}`
      : `Add product ${productName} at ₹${roundMetric(price, 2)}`;

  return {
    conversationMessage: rebuiltMessage,
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

const dedupeProductSuggestionsById = (
  suggestions: AssistantCopilotProductSuggestion[],
) => {
  const seen = new Set<number>();

  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) {
      return false;
    }

    seen.add(suggestion.id);
    return true;
  });
};

const normalizeForFuzzyProductMatch = (value: string) =>
  normalizeText(value).replace(/[^a-z0-9\u0900-\u097f]/g, "");

const levenshteinDistance = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  if (left.length === 0) {
    return right.length;
  }

  if (right.length === 0) {
    return left.length;
  }

  const previousRow = new Array<number>(right.length + 1);
  const currentRow = new Array<number>(right.length + 1);

  for (let column = 0; column <= right.length; column += 1) {
    previousRow[column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    currentRow[0] = row;

    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        currentRow[column - 1] + 1,
        previousRow[column] + 1,
        previousRow[column - 1] + cost,
      );
    }

    for (let column = 0; column <= right.length; column += 1) {
      previousRow[column] = currentRow[column];
    }
  }

  return previousRow[right.length];
};

const rankFuzzyProductMatches = <T extends { name: string }>(
  query: string,
  products: T[],
  limit = 5,
) => {
  const normalizedQuery = normalizeForFuzzyProductMatch(query);
  if (normalizedQuery.length < 2) {
    return [] as T[];
  }

  const ranked = products
    .map((product) => {
      const normalizedName = normalizeForFuzzyProductMatch(product.name);
      if (!normalizedName) {
        return null;
      }

      if (
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      ) {
        return {
          product,
          score: 0,
          lengthDiff: Math.abs(normalizedName.length - normalizedQuery.length),
        };
      }

      const distance = levenshteinDistance(normalizedQuery, normalizedName);
      const threshold = Math.max(
        2,
        Math.floor(
          Math.max(normalizedQuery.length, normalizedName.length) * 0.35,
        ),
      );

      if (distance > threshold) {
        return null;
      }

      return {
        product,
        score: distance,
        lengthDiff: Math.abs(normalizedName.length - normalizedQuery.length),
      };
    })
    .filter(
      (entry): entry is { product: T; score: number; lengthDiff: number } =>
        entry !== null,
    )
    .sort((left, right) => {
      if (left.score === right.score) {
        return left.lengthDiff - right.lengthDiff;
      }

      return left.score - right.score;
    })
    .slice(0, limit)
    .map((entry) => entry.product);

  return ranked;
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

  return dedupeProductSuggestionsById(
    scored.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      price: roundMetric(toNumber(candidate.price), 2),
      gstRate: roundMetric(toNumber(candidate.gst_rate), 2),
    })),
  ).slice(0, params.limit ?? 5);
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
        status: SALE_STATUS.COMPLETED,
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
        group.product_id != null
          ? (productMap.get(group.product_id) ?? null)
          : null;

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

  if (
    primary.stockOnHand != null &&
    primary.stockOnHand <= Math.max(3, primary.quantity)
  ) {
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
  const match = message
    .replace(/,/g, "")
    .match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
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

const detectIntent = (
  message: string,
  amount: number | null,
  entity: string | null,
) => {
  if (looksLikeRemoveProductIntent(message)) {
    return "remove_product" satisfies AssistantIntent;
  }

  if (looksLikeAddProductIntent(message)) {
    return "add_product" satisfies AssistantIntent;
  }

  const navigationTarget = resolveNavigationTarget(message);
  if (navigationTarget) {
    return "navigate" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SHOW_PRODUCTS_KEYWORDS)) {
    return "show_products" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SHOW_INVOICES_KEYWORDS)) {
    return "show_invoices" satisfies AssistantIntent;
  }

  if (hasKeyword(message, SHOW_CUSTOMERS_KEYWORDS)) {
    return "show_customers" satisfies AssistantIntent;
  }

  if (looksLikeCreateBillIntent(message)) {
    return "create_bill" satisfies AssistantIntent;
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
  const [salesSnapshot, purchases, expenseRows, sales, invoices] =
    await Promise.all([
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
          status: SALE_STATUS.COMPLETED,
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

  const purchasePayments = roundMetric(
    purchases.reduce(
      (sum, purchase) => sum + resolvePurchaseRealizedAmount(purchase),
      0,
    ),
  );
  const expenses = roundMetric(
    expenseRows
      .filter((row) => row.day >= period.start && row.day < period.endExclusive)
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const pendingSales = roundMetric(
    sales
      .filter((sale) => !isSyncedInvoiceSale(sale.notes))
      .reduce(
        (sum, sale) => sum + Math.max(0, toNumber(sale.pendingAmount)),
        0,
      ),
  );
  const pendingInvoices = roundMetric(
    invoices.reduce(
      (sum, invoice) => sum + resolveInvoicePendingAmount(invoice),
      0,
    ),
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

    return ["Add product Bread at ₹40 with GST 5", "Add product Milk at ₹60"];
  }

  if (intent === "remove_product") {
    if (language === "hi") {
      return ["Speaker product हटा दो", "Bluetooth speaker delete करो"];
    }

    if (language === "hinglish") {
      return ["Speaker hata do", "Bluetooth speaker delete karo"];
    }

    return ["Remove speaker", "Delete bluetooth speaker"];
  }

  if (intent === "show_invoices") {
    if (language === "hi") {
      return ["इनवॉइस दिखाओ", "बिल history दिखाओ"];
    }

    if (language === "hinglish") {
      return ["Invoices dikhao", "Bill history dikhao"];
    }

    return ["Show invoices", "Open bill history"];
  }

  if (intent === "show_customers") {
    if (language === "hi") {
      return ["ग्राहक दिखाओ", "Customer list खोलो"];
    }

    if (language === "hinglish") {
      return ["Customers dikhao", "Customer list kholo"];
    }

    return ["Show customers", "Open customer list"];
  }

  if (intent === "show_products") {
    if (language === "hi") {
      return ["Products dikhao", "Product list kholo"];
    }

    if (language === "hinglish") {
      return ["Products dikhao", "Products page kholo"];
    }

    return ["Show products", "Open products page"];
  }

  if (intent === "navigate") {
    if (language === "hi") {
      return ["Customers page kholo", "Products page kholo"];
    }

    if (language === "hinglish") {
      return ["Customers page kholo", "Invoices page open karo"];
    }

    return ["Open customers page", "Navigate to invoices"];
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

  const parsedInput = parseAddProductMessage(params.message);
  const { productName, price, gst: gstRate } = parsedInput;

  logAssistantDebug("action.add_product.parsed", {
    userId: params.userId,
    payload: parsedInput,
  });

  const productSuggestions = await searchProductSuggestions({
    userId: params.userId,
    message: params.message,
  });

  if (!productName) {
    return {
      action: {
        type: "create_product",
        status: "failed",
        message:
          params.language === "hi"
            ? "Product ka naam bata do."
            : params.language === "hinglish"
              ? "Product ka naam bata do."
              : "Please share the product name.",
      },
      copilot:
        productSuggestions.length > 0
          ? {
              productSuggestions,
            }
          : undefined,
    };
  }

  const productNameWordCount = productName
    .split(/\s+/)
    .filter((token) => token.trim().length > 0).length;

  if (productNameWordCount > 3 || productName.length > 40) {
    return {
      action: {
        type: "create_product",
        status: "failed",
        message:
          params.language === "en"
            ? "Please confirm the product name only (1-3 words)."
            : "Product ka naam confirm karein? (sirf 1-3 words)",
      },
      copilot:
        productSuggestions.length > 0
          ? {
              productSuggestions,
            }
          : undefined,
    };
  }

  if (price == null || price <= 0) {
    const invalidPriceHint = parsedInput.hasPriceHint;

    return {
      action: {
        type: "create_product",
        status: "failed",
        message:
          params.language === "hi"
            ? invalidPriceHint
              ? `${productName} ka price valid number mein batao (₹ में).`
              : `${productName} ka price bata do (₹ में).`
            : params.language === "hinglish"
              ? invalidPriceHint
                ? `${productName} ka price valid number mein batao (₹ mein).`
                : `${productName} ka price bata do (₹ mein).`
              : invalidPriceHint
                ? `Please share a valid numeric price for ${productName} in INR.`
                : `Please share the price for ${productName} in INR.`,
      },
      copilot:
        productSuggestions.length > 0
          ? {
              productSuggestions,
            }
          : undefined,
    };
  }

  if (gstRate == null) {
    return {
      action: {
        type: "create_product",
        status: "failed",
        message: parsedInput.hasGstMention
          ? params.language === "hi"
            ? "GST percent number mein batao (0 se 28)."
            : params.language === "hinglish"
              ? "GST percent number mein batao (0 se 28)."
              : "Please share GST as a number between 0 and 28."
          : `${productName} ₹${roundMetric(price, 2)} noted. GST kitna apply karna hai?`,
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

  const gstRecommendation: AssistantCopilotGstRecommendation = {
    rate: gstRate,
    confidence: "high",
    reason:
      params.language === "hi"
        ? `आपने GST ${gstRate}% दिया, वही लागू किया गया।`
        : params.language === "hinglish"
          ? `Aapne GST ${gstRate}% diya, wahi apply kiya gaya.`
          : `Using the GST ${gstRate}% you provided.`,
  };

  const resolvedGstRate = gstRate;

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
        productSuggestions: dedupeProductSuggestionsById([
          {
            id: existingProduct.id,
            name: existingProduct.name,
            price: roundMetric(toNumber(existingProduct.price), 2),
            gstRate: roundMetric(toNumber(existingProduct.gst_rate), 2),
          },
          ...productSuggestions,
        ]).slice(0, 5),
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

  emitDashboardUpdate({
    userId: params.userId,
    source: "assistant.product.create",
  });

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
      productSuggestions: dedupeProductSuggestionsById([
        {
          id: createdProduct.id,
          name: createdProduct.name,
          price: roundMetric(toNumber(createdProduct.price), 2),
          gstRate: roundMetric(toNumber(createdProduct.gst_rate), 2),
        },
        ...productSuggestions,
      ]).slice(0, 5),
    },
  };
};

const executeRemoveProductAction = async (params: {
  userId: number;
  language: AssistantLanguage;
  message: string;
}): Promise<AssistantActionExecution> => {
  logAssistantDebug("action.remove_product.started", {
    userId: params.userId,
  });

  const dedupeKey = buildAssistantActionKey(
    params.userId,
    "remove_product",
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
            ? "Yeh product abhi remove kiya gaya hai. Product list refresh karke dekh lo."
            : params.language === "hinglish"
              ? "Yeh product abhi remove kiya gaya hai. Product list refresh karke dekh lo."
              : "This product was removed just now. Please refresh the product list once.",
      },
    };
  }

  const parsedInput = parseRemoveProductMessage(params.message);
  const { productName } = parsedInput;

  logAssistantDebug("action.remove_product.parsed", {
    userId: params.userId,
    payload: parsedInput,
  });

  if (!productName) {
    return {
      action: {
        type: "remove_product",
        status: "failed",
        message:
          params.language === "en"
            ? "Which product should I remove?"
            : "Kaunsa product remove karna hai?",
      },
    };
  }

  const exactProduct = await prisma.product.findFirst({
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

  const similarProducts = await prisma.product.findMany({
    where: {
      user_id: params.userId,
      name: {
        contains: productName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      price: true,
      gst_rate: true,
    },
    orderBy: {
      updated_at: "desc",
    },
    take: 5,
  });

  let fuzzyProducts: Array<{
    id: number;
    name: string;
    price: unknown;
    gst_rate: unknown;
  }> = [];

  if (!exactProduct && similarProducts.length === 0) {
    const fallbackProducts = await prisma.product.findMany({
      where: {
        user_id: params.userId,
      },
      select: {
        id: true,
        name: true,
        price: true,
        gst_rate: true,
      },
      orderBy: {
        updated_at: "desc",
      },
      take: 40,
    });

    fuzzyProducts = rankFuzzyProductMatches(productName, fallbackProducts, 5);
  }

  if (!exactProduct) {
    const candidateProducts =
      similarProducts.length > 0 ? similarProducts : fuzzyProducts;

    if (candidateProducts.length === 0) {
      return {
        action: {
          type: "remove_product",
          status: "failed",
          message:
            params.language === "en"
              ? `I could not find \"${productName}\". It may already be removed.`
              : `Mujhe \"${productName}\" nahi mila. Shayad yeh pehle hi remove ho chuka hai.`,
        },
      };
    }

    if (candidateProducts.length === 1) {
      return {
        action: {
          type: "remove_product",
          status: "failed",
          message:
            params.language === "en"
              ? `I could not find \"${productName}\". Did you mean \"${candidateProducts[0].name}\"?`
              : `Mujhe \"${productName}\" nahi mila. Kya aap \"${candidateProducts[0].name}\" kehna chah rahe the?`,
        },
      };
    }

    const topMatches = candidateProducts
      .slice(0, 3)
      .map((product) => product.name)
      .join(", ");

    return {
      action: {
        type: "remove_product",
        status: "failed",
        message:
          params.language === "en"
            ? `I found ${candidateProducts.length} matching products: ${topMatches}. Which one should I remove?`
            : `Aapke paas ${candidateProducts.length} matching products hain: ${topMatches}. Kaunsa remove karna hai?`,
      },
    };
  }

  try {
    const deleted = await prisma.product.deleteMany({
      where: {
        id: exactProduct.id,
        user_id: params.userId,
      },
    });

    if (!deleted.count) {
      return {
        action: {
          type: "remove_product",
          status: "noop",
          message:
            params.language === "en"
              ? `${exactProduct.name} is already removed.`
              : `${exactProduct.name} pehle hi remove ho chuka hai.`,
          resourceId: exactProduct.id,
          resourceLabel: exactProduct.name,
          route: "/products",
        },
      };
    }
  } catch (error) {
    const isLinkedDataConstraint =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014");

    if (isLinkedDataConstraint) {
      return {
        action: {
          type: "remove_product",
          status: "failed",
          message:
            params.language === "en"
              ? `${exactProduct.name} cannot be removed yet because it is linked to transactions.`
              : `${exactProduct.name} abhi remove nahi ho sakta kyunki yeh transactions se linked hai.`,
          resourceId: exactProduct.id,
          resourceLabel: exactProduct.name,
          route: "/products",
        },
      };
    }

    throw error;
  }

  emitDashboardUpdate({
    userId: params.userId,
    source: "assistant.product.remove",
  });

  logAssistantDebug("action.remove_product.completed", {
    userId: params.userId,
    productId: exactProduct.id,
  });

  const action: AssistantAction = {
    type: "remove_product",
    status: "success",
    message:
      params.language === "en"
        ? `${exactProduct.name} removed. Want to add a new product now?`
        : `${exactProduct.name} remove kar diya. Kya aap naya product add karna chahenge?`,
    resourceId: exactProduct.id,
    resourceLabel: exactProduct.name,
    route: "/products",
  };

  rememberAssistantAction(dedupeKey, action);
  return {
    action,
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
            ? "Main bill page khol raha hoon."
            : params.language === "hinglish"
              ? "Main bill page khol raha hoon."
              : "Opening the billing page.",
      },
      command: {
        intent: "CREATE_BILL",
      },
    };
  }

  const extractedCustomerName = extractCustomerNameForBill(params.message);
  if (!extractedCustomerName) {
    return {
      action: {
        type: "open_simple_bill",
        status: "failed",
        message:
          params.language === "hi"
            ? "Kis customer ke liye bill banana hai?"
            : params.language === "hinglish"
              ? "Kis customer ke liye bill banana hai?"
              : "Which customer should I create the bill for?",
        route: `${DASHBOARD_ROUTE_TARGETS.simpleBill}?new=1`,
      },
      command: {
        intent: "CREATE_BILL",
        customerName: null,
      },
    };
  }

  const customer =
    (await prisma.customer.findFirst({
      where: {
        user_id: params.userId,
        name: {
          equals: extractedCustomerName,
          mode: "insensitive",
        },
      },
      select: { id: true, name: true },
    })) ??
    (await prisma.customer.findFirst({
      where: {
        user_id: params.userId,
        name: {
          contains: extractedCustomerName,
          mode: "insensitive",
        },
      },
      orderBy: { created_at: "desc" },
      select: { id: true, name: true },
    }));

  const resolvedCustomerName = customer?.name ?? extractedCustomerName;
  const action: AssistantAction = {
    type: "open_simple_bill",
    status: "success",
    message: `${resolvedCustomerName} ke liye bill bana raha hoon...`,
    resourceId: customer?.id,
    resourceLabel: resolvedCustomerName,
    route: `${DASHBOARD_ROUTE_TARGETS.simpleBill}?new=1&customer=${encodeURIComponent(
      resolvedCustomerName,
    )}`,
  };

  logAssistantDebug("action.create_bill.completed", {
    userId: params.userId,
    customerId: customer?.id ?? null,
    customerName: resolvedCustomerName,
  });

  rememberAssistantAction(dedupeKey, action);
  return {
    action,
    command: {
      intent: "CREATE_BILL",
      customerName: resolvedCustomerName,
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
        label:
          language === "hi"
            ? "बाकी room"
            : language === "hinglish"
              ? "Safe room"
              : "Safe room",
        value: formatCopilotCurrency(
          Math.max(extra.copilotSummary.budget.remainingSafeToSpend, 0),
          language,
        ),
      },
      {
        label:
          language === "hi"
            ? "Daily pace"
            : language === "hinglish"
              ? "Daily pace"
              : "Daily pace",
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
        label:
          language === "hi"
            ? "Top idea"
            : language === "hinglish"
              ? "Top idea"
              : "Top idea",
        value: extra.copilotSummary.savings.opportunities[0]?.category ?? "--",
      },
    ];
  }

  if (intent === "bill_reminder" && extra?.copilotSummary) {
    return [
      {
        label:
          language === "hi"
            ? "Next bill"
            : language === "hinglish"
              ? "Next bill"
              : "Next bill",
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
        label:
          language === "hi"
            ? "Pattern"
            : language === "hinglish"
              ? "Pattern"
              : "Pattern",
        value: extra.copilotSummary.behaviorInsights.items[0]?.title ?? "--",
      },
      {
        label:
          language === "hi"
            ? "Watch"
            : language === "hinglish"
              ? "Watch"
              : "Watch",
        value: extra.copilotSummary.behaviorInsights.items[1]?.title ?? "--",
      },
    ];
  }

  if (intent === "goal_tracking" && extra?.copilotSummary) {
    return [
      {
        label:
          language === "hi"
            ? "Monthly save"
            : language === "hinglish"
              ? "Monthly save"
              : "Monthly save",
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
    const supplierMatch =
      supplierName && normalizeText(supplierName).includes(normalizedEntity);
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

      const lineAmount = roundMetric(
        toNumber(item.line_total) * allocationRatio,
      );
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
    [...labelTotals.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? entity;

  return {
    name: bestLabel,
    amount: roundMetric(amount),
    purchaseCount,
    shareOfOutflow:
      totalOutflow > 0 ? roundMetric((amount / totalOutflow) * 100, 1) : 0,
  };
};

const findTopSpend = (
  purchases: AssistantPurchaseRecord[],
  totalOutflow: number,
): AssistantTopSpend | null => {
  const categoryTotals = new Map<
    string,
    { amount: number; purchaseIds: Set<number> }
  >();
  const supplierTotals = new Map<
    string,
    { amount: number; purchaseIds: Set<number> }
  >();

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
      const categoryName =
        item.product?.category?.name?.trim() || "Uncategorized";
      const lineAmount = roundMetric(
        toNumber(item.line_total) * allocationRatio,
      );
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
        totalOutflow > 0
          ? roundMetric((value.amount / totalOutflow) * 100, 1)
          : 0,
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
        totalOutflow > 0
          ? roundMetric((value.amount / totalOutflow) * 100, 1)
          : 0,
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
    net >= amount ? "comfortable" : net >= amount * 0.6 ? "tight" : "risky";

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
  return BILLING_ONLY_FALLBACK_MESSAGE;
};

const parseAssistantQuery = (
  message: string,
  history: AssistantHistoryMessage[],
): AssistantParsedQuery => {
  const baseResolution = resolveConversationMessage(message, history);

  let usedHistory = baseResolution.usedHistory;
  let sanitizedMessage = sanitizeTranscriptMessage(
    baseResolution.conversationMessage,
  );
  const languageProfile = detectAssistantLanguage(message);

  let amount = extractAmount(sanitizedMessage);
  let entity = extractEntity(sanitizedMessage);
  let navigationTarget = resolveNavigationTarget(sanitizedMessage);
  let intent: AssistantIntent = detectIntent(sanitizedMessage, amount, entity);
  const currentAddProductParse =
    intent === "add_product" ? parseAddProductMessage(sanitizedMessage) : null;
  const shouldResolveAddProductFollowUp =
    intent === "help" ||
    (intent === "add_product" && currentAddProductParse?.productName == null);

  if (shouldResolveAddProductFollowUp) {
    const followUp = resolveAddProductFollowUpMessage(
      sanitizedMessage,
      history,
    );
    if (followUp) {
      sanitizedMessage = sanitizeTranscriptMessage(
        followUp.conversationMessage,
      );
      usedHistory = true;
      amount = extractAmount(sanitizedMessage);
      entity = extractEntity(sanitizedMessage);
      navigationTarget = resolveNavigationTarget(sanitizedMessage);
      intent = detectIntent(sanitizedMessage, amount, entity);
    }
  }

  return {
    language:
      containsDevanagari(message) && languageProfile.mixed
        ? "hinglish"
        : languageProfile.language,
    intent,
    period: resolveAssistantPeriod(sanitizedMessage),
    amount,
    entity,
    navigationTarget,
    conversationMessage: sanitizedMessage,
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
    const isAllowedBillingIntent =
      parsed.intent === "navigate" ||
      parsed.intent === "create_bill" ||
      parsed.intent === "add_product" ||
      parsed.intent === "remove_product" ||
      parsed.intent === "show_products" ||
      parsed.intent === "show_invoices" ||
      parsed.intent === "show_customers";

    if (!isAllowedBillingIntent) {
      const outOfScopeReply: AssistantReply = {
        language: parsed.language,
        intent: "help",
        answer: BILLING_ONLY_FALLBACK_MESSAGE,
        highlights: [],
        examples: [],
        command: {
          intent: "OUT_OF_SCOPE",
        },
        structured: buildStructuredPayload({
          intent: "OUT_OF_SCOPE",
          action: "NONE",
          message: BILLING_ONLY_FALLBACK_MESSAGE,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
        outOfScope: true,
      });

      return outOfScopeReply;
    }

    if (parsed.intent === "add_product") {
      const addData = parseAddProductMessage(parsed.conversationMessage);
      const result = await executeAddProductAction({
        userId: params.userId,
        language: parsed.language,
        message: parsed.conversationMessage,
      });

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: result.action.message,
        highlights: result.action.resourceLabel
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
        command: result.command ?? {
          intent: "ADD_PRODUCT",
        },
        structured: buildStructuredPayload({
          intent: "ADD_PRODUCT",
          data: {
            productName: addData.productName,
            price: addData.price,
            gst: addData.gst,
          },
          action: "ADD_PRODUCT",
          target: result.action.route,
          message: result.action.message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        actionStatus: result.action.status,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "remove_product") {
      const removeData = parseRemoveProductMessage(parsed.conversationMessage);
      const result = await executeRemoveProductAction({
        userId: params.userId,
        language: parsed.language,
        message: parsed.conversationMessage,
      });

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: result.action.message,
        highlights: result.action.resourceLabel
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
        command: result.command ?? {
          intent: "REMOVE_PRODUCT",
        },
        structured: buildStructuredPayload({
          intent: "REMOVE_PRODUCT",
          data: {
            productName: removeData.productName,
          },
          action: "REMOVE_PRODUCT",
          target: result.action.route,
          message: result.action.message,
        }),
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
      const customerName =
        result.command?.customerName ??
        extractCustomerNameForBill(parsed.conversationMessage) ??
        null;

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: result.action.message,
        highlights: result.action.resourceLabel
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
        command: result.command,
        structured: buildStructuredPayload({
          intent: "CREATE_BILL",
          data: {
            customerName,
          },
          action: "NAVIGATE",
          target: result.action.route,
          message: result.action.message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        actionStatus: result.action.status,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "show_products") {
      const message =
        parsed.language === "en"
          ? "Opening products..."
          : "Products dikha raha hoon...";
      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: message,
        highlights: [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: {
          type: "show_products",
          status: "success",
          message,
          route: DASHBOARD_ROUTE_TARGETS.products,
        },
        command: {
          intent: "SHOW_PRODUCTS",
        },
        structured: buildStructuredPayload({
          intent: "SHOW_PRODUCTS",
          action: "NAVIGATE",
          target: DASHBOARD_ROUTE_TARGETS.products,
          message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "navigate") {
      const route = parsed.navigationTarget ?? "/dashboard";
      const targetLabel =
        route === DASHBOARD_ROUTE_TARGETS.products
          ? "products"
          : route === DASHBOARD_ROUTE_TARGETS.customers
            ? "customers"
            : route === DASHBOARD_ROUTE_TARGETS.invoices
              ? "invoices"
              : route === DASHBOARD_ROUTE_TARGETS.simpleBill
                ? "simple bill"
                : "dashboard";
      const message =
        parsed.language === "en"
          ? `Opening ${targetLabel}...`
          : `${targetLabel} page khol raha hoon...`;

      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: message,
        highlights: [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: {
          type: "navigate",
          status: "success",
          message,
          route,
        },
        command: {
          intent: "NAVIGATE",
        },
        structured: buildStructuredPayload({
          intent: "NAVIGATE",
          data: {
            target: route,
          },
          action: "NAVIGATE",
          target: route,
          message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "show_invoices") {
      const message =
        parsed.language === "en"
          ? "Opening invoices..."
          : "Invoices dikha raha hoon...";
      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: message,
        highlights: [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: {
          type: "show_invoices",
          status: "success",
          message,
          route: DASHBOARD_ROUTE_TARGETS.invoices,
        },
        command: {
          intent: "SHOW_INVOICES",
        },
        structured: buildStructuredPayload({
          intent: "SHOW_INVOICES",
          action: "NAVIGATE",
          target: DASHBOARD_ROUTE_TARGETS.invoices,
          message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
        durationMs: Date.now() - startedAt,
      });

      return reply;
    }

    if (parsed.intent === "show_customers") {
      const message =
        parsed.language === "en"
          ? "Opening customers..."
          : "Customers dikha raha hoon...";
      const reply: AssistantReply = {
        language: parsed.language,
        intent: parsed.intent,
        answer: message,
        highlights: [],
        examples: buildActionExamples(parsed.language, parsed.intent),
        action: {
          type: "show_customers",
          status: "success",
          message,
          route: DASHBOARD_ROUTE_TARGETS.customers,
        },
        command: {
          intent: "SHOW_CUSTOMERS",
        },
        structured: buildStructuredPayload({
          intent: "SHOW_CUSTOMERS",
          action: "NAVIGATE",
          target: DASHBOARD_ROUTE_TARGETS.customers,
          message,
        }),
      };

      logAssistantDebug("query.completed", {
        userId: params.userId,
        intent: parsed.intent,
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
        answer: buildSmartInsightsAnswer(
          parsed.language,
          parsed.period,
          smartInsights,
        ),
        highlights: smartInsights.slice(0, 3).map((insight) => ({
          label: insight.title,
          value: insight.value ?? insight.detail,
        })),
        examples: buildExamples(parsed.language),
        copilot: {
          smartInsights,
        },
        structured: buildStructuredPayload({
          intent: "OUT_OF_SCOPE",
          action: "NONE",
          message: BILLING_ONLY_FALLBACK_MESSAGE,
        }),
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
        examples: [],
        command: {
          intent: "OUT_OF_SCOPE",
        },
        structured: buildStructuredPayload({
          intent: "OUT_OF_SCOPE",
          action: "NONE",
          message: buildHelpAnswer(parsed.language, parsed.usedHistory),
        }),
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
        : Promise.resolve<Awaited<
            ReturnType<typeof buildFinancialCopilot>
          > | null>(null),
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
        ? buildDecisionGuidanceAnswer(
            parsed.language,
            copilotSummary,
            parsed.amount,
          )
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
      structured: buildStructuredPayload({
        intent: "OUT_OF_SCOPE",
        action: "NONE",
        message: answer,
      }),
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
