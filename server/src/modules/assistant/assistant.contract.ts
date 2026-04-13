export type AssistantContractLanguage = "en" | "hi" | "hinglish";

export type AssistantIntent =
  | "profit"
  | "total_sales"
  | "pending_payments"
  | "cashflow"
  | "navigate"
  | "create_bill"
  | "show_products"
  | "show_invoices"
  | "show_customers"
  | "add_product"
  | "remove_product"
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

export type AssistantHistoryMessage = {
  role: "assistant" | "user";
  content: string;
};

export type AssistantActionType =
  | "create_invoice"
  | "create_product"
  | "remove_product"
  | "navigate"
  | "open_simple_bill"
  | "show_products"
  | "show_invoices"
  | "show_customers";

export type AssistantActionStatus = "success" | "failed" | "noop";

export type AssistantAction = {
  type: AssistantActionType;
  status: AssistantActionStatus;
  message: string;
  resourceId?: number;
  resourceLabel?: string;
  route?: string;
};

export type AssistantCopilotProductSuggestion = {
  id: number;
  name: string;
  price: number;
  gstRate: number;
};

export type AssistantCopilotInvoiceItem = {
  name: string;
  quantity: number;
  price: number;
  gstRate: number | null;
  source: "explicit" | "catalog" | "top_seller";
};

export type AssistantCopilotInvoiceAutocomplete = {
  customerName: string;
  autoCompleted: boolean;
  items: AssistantCopilotInvoiceItem[];
};

export type AssistantCopilotGstRecommendation = {
  rate: number;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type AssistantCopilotInsight = {
  title: string;
  detail: string;
  value?: string;
};

export type AssistantCopilotPayload = {
  productSuggestions?: AssistantCopilotProductSuggestion[];
  invoiceAutocomplete?: AssistantCopilotInvoiceAutocomplete;
  gstRecommendation?: AssistantCopilotGstRecommendation;
  smartInsights?: AssistantCopilotInsight[];
};

export type AssistantCommandIntent =
  | "CREATE_BILL"
  | "ADD_PRODUCT"
  | "REMOVE_PRODUCT"
  | "NAVIGATE"
  | "SHOW_PRODUCTS"
  | "SHOW_INVOICES"
  | "SHOW_CUSTOMERS"
  | "OUT_OF_SCOPE";

export type AssistantCommand = {
  intent: AssistantCommandIntent;
  customerName?: string | null;
};

export type AssistantStructuredAction =
  | "CREATE_BILL"
  | "ADD_PRODUCT"
  | "REMOVE_PRODUCT"
  | "NAVIGATE"
  | "SHOW_PRODUCTS"
  | "SHOW_CUSTOMERS"
  | "SHOW_INVOICES"
  | "NONE";

export type AssistantStructuredPayload = {
  intent: AssistantCommandIntent;
  data: Record<string, unknown>;
  action: AssistantStructuredAction;
  target?: string;
  message: string;
};

export type AssistantReply = {
  language: AssistantContractLanguage;
  intent: AssistantIntent;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  examples: string[];
  action?: AssistantAction;
  copilot?: AssistantCopilotPayload;
  command?: AssistantCommand;
  structured: AssistantStructuredPayload;
};
