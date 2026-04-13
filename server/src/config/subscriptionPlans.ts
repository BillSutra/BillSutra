export type SubscriptionPlanId = "free" | "pro" | "pro-plus";

export type SubscriptionFeatureKey =
  | "INVOICE_CREATE"
  | "PAYMENT_TRACKING"
  | "SMART_SUGGESTIONS"
  | "REPORTS_BASIC"
  | "ANALYTICS_ADVANCED"
  | "REPORTS_ADVANCED"
  | "WORKERS_MANAGEMENT"
  | "DATA_EXPORT";

export type SubscriptionPlanConfig = {
  id: SubscriptionPlanId;
  name: string;
  invoiceLimitPerMonth: number | null;
  features: Record<SubscriptionFeatureKey, boolean>;
};

export const SUBSCRIPTION_PLAN_CONFIG: Record<
  SubscriptionPlanId,
  SubscriptionPlanConfig
> = {
  free: {
    id: "free",
    name: "Free",
    invoiceLimitPerMonth: 50,
    features: {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: false,
      SMART_SUGGESTIONS: false,
      REPORTS_BASIC: false,
      ANALYTICS_ADVANCED: false,
      REPORTS_ADVANCED: false,
      WORKERS_MANAGEMENT: false,
      DATA_EXPORT: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    invoiceLimitPerMonth: null,
    features: {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: true,
      SMART_SUGGESTIONS: true,
      REPORTS_BASIC: true,
      ANALYTICS_ADVANCED: false,
      REPORTS_ADVANCED: false,
      WORKERS_MANAGEMENT: false,
      DATA_EXPORT: false,
    },
  },
  "pro-plus": {
    id: "pro-plus",
    name: "Pro Plus",
    invoiceLimitPerMonth: null,
    features: {
      INVOICE_CREATE: true,
      PAYMENT_TRACKING: true,
      SMART_SUGGESTIONS: true,
      REPORTS_BASIC: true,
      ANALYTICS_ADVANCED: true,
      REPORTS_ADVANCED: true,
      WORKERS_MANAGEMENT: true,
      DATA_EXPORT: true,
    },
  },
};

const PLAN_ORDER: SubscriptionPlanId[] = ["free", "pro", "pro-plus"];

export const normalizeSubscriptionPlanId = (
  value: string | null | undefined,
): SubscriptionPlanId => {
  if (value === "pro-plus") return "pro-plus";
  if (value === "pro") return "pro";
  return "free";
};

export const getPlanConfig = (planId: SubscriptionPlanId) =>
  SUBSCRIPTION_PLAN_CONFIG[planId];

export const isPlanAtLeast = (
  planId: SubscriptionPlanId,
  minimumPlan: SubscriptionPlanId,
) => PLAN_ORDER.indexOf(planId) >= PLAN_ORDER.indexOf(minimumPlan);

export const featureRequiredPlan: Record<
  Exclude<SubscriptionFeatureKey, "INVOICE_CREATE">,
  SubscriptionPlanId
> = {
  PAYMENT_TRACKING: "pro",
  SMART_SUGGESTIONS: "pro",
  REPORTS_BASIC: "pro",
  ANALYTICS_ADVANCED: "pro-plus",
  REPORTS_ADVANCED: "pro-plus",
  WORKERS_MANAGEMENT: "pro-plus",
  DATA_EXPORT: "pro-plus",
};

export const toPrismaPlanEnum = (planId: SubscriptionPlanId) => {
  if (planId === "pro-plus") return "PRO_PLUS";
  if (planId === "pro") return "PRO";
  return "FREE";
};

export const fromPrismaPlanEnum = (
  value: "FREE" | "PRO" | "PRO_PLUS",
): SubscriptionPlanId => {
  if (value === "PRO_PLUS") return "pro-plus";
  if (value === "PRO") return "pro";
  return "free";
};

export const toPrismaBillingCycleEnum = (billingCycle: "monthly" | "yearly") =>
  billingCycle === "yearly" ? "YEARLY" : "MONTHLY";
