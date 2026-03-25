export type BillingCycle = "monthly" | "yearly";

export const PRICING_CURRENCY = "INR";

export type PricingPlan = {
  id: "free" | "pro" | "pro-plus";
  name: string;
  kicker: string;
  badge?: string;
  monthlyPrice: number;
  yearlyPrice?: number | null;
  description: string;
  ctaLabel: string;
  trialLabel?: string;
  highlight?: boolean;
  accentClassName: string;
  limits: {
    invoicesPerMonth: number | null;
    products: number | null;
    customers: number | null;
  };
  features: string[];
  limitations?: string[];
  upgradeHighlights: string[];
};

export const FREE_PLAN_LIMITS = {
  invoicesPerMonth: 50,
  products: 100,
  customers: 100,
} as const;

export const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    kicker: "Starter",
    monthlyPrice: 0,
    yearlyPrice: null,
    description:
      "A low-risk starting point for retailers, local shops, and freelancers who want fast GST-friendly billing without setup stress.",
    ctaLabel: "Start Free",
    accentClassName:
      "border-emerald-200/80 bg-white/95 shadow-[0_24px_60px_-42px_rgba(16,185,129,0.45)]",
    limits: {
      invoicesPerMonth: FREE_PLAN_LIMITS.invoicesPerMonth,
      products: FREE_PLAN_LIMITS.products,
      customers: FREE_PLAN_LIMITS.customers,
    },
    features: [
      "Cart-style POS billing",
      "50 invoices per month",
      "Paid and pending payment status",
      "Simple invoice PDF template",
      "Up to 100 products and 100 customers",
    ],
    limitations: [
      "No advanced analytics",
      "No smart suggestions",
      "No invoice branding customization",
    ],
    upgradeHighlights: [
      "Upgrade when billing volume grows past your monthly cap.",
      "Best for getting started before daily billing volume picks up.",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    kicker: "Most popular",
    badge: "Best Value",
    monthlyPrice: 499,
    yearlyPrice: 4790,
    description:
      "The no-brainer plan for active small businesses that want faster checkout, smarter upsells, and polished customer-facing invoices.",
    ctaLabel: "Upgrade to Pro",
    trialLabel: "14-day free trial",
    highlight: true,
    accentClassName:
      "border-violet-300/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(243,240,255,0.96))] shadow-[0_30px_90px_-42px_rgba(99,102,241,0.45)]",
    limits: {
      invoicesPerMonth: null,
      products: 2500,
      customers: 2500,
    },
    features: [
      "Unlimited invoices",
      "Paid, pending, and partial payments with history",
      "Smart Suggestions for upsells and quick reorders",
      "Professional invoice PDF with logo, GST, and branding",
      "Basic analytics for sales and top products",
      "Higher product and customer limits",
    ],
    upgradeHighlights: [
      "Save about 20% on annual billing.",
      "Built to pay for itself with faster checkout and better order value.",
    ],
  },
  {
    id: "pro-plus",
    name: "Pro Plus",
    kicker: "Power users",
    monthlyPrice: 999,
    yearlyPrice: 9590,
    description:
      "A business growth toolkit for teams that need deeper visibility, staff access, and premium control over their billing experience.",
    ctaLabel: "Go Pro Plus",
    accentClassName:
      "border-sky-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,255,0.96))] shadow-[0_30px_90px_-46px_rgba(14,165,233,0.4)]",
    limits: {
      invoicesPerMonth: null,
      products: null,
      customers: null,
    },
    features: [
      "Everything in Pro",
      "Advanced analytics and downloadable reports",
      "Multi-user staff accounts",
      "Priority support",
      "Backups and full data export",
      "Advanced invoice themes, branding, and future integrations",
    ],
    upgradeHighlights: [
      "Best for serious operators running multiple counters or staff.",
      "Adds the control and reporting needed to scale with confidence.",
    ],
  },
];

export const formatPlanPrice = (
  plan: PricingPlan,
  billingCycle: BillingCycle,
) => {
  if (plan.monthlyPrice === 0) {
    return "Free";
  }

  const amount =
    billingCycle === "yearly" && plan.yearlyPrice ? plan.yearlyPrice : plan.monthlyPrice;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: PRICING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatPricingAmount = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: PRICING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

export const formatPlanPeriodLabel = (
  plan: PricingPlan,
  billingCycle: BillingCycle,
) => {
  if (plan.monthlyPrice === 0) {
    return "No credit card required";
  }

  return billingCycle === "yearly" ? "/year" : "/month";
};

export const getAnnualSavings = (plan: PricingPlan) => {
  if (!plan.yearlyPrice || plan.monthlyPrice === 0) {
    return 0;
  }

  const fullYearPrice = plan.monthlyPrice * 12;
  return Math.max(0, Number((fullYearPrice - plan.yearlyPrice).toFixed(2)));
};

export const getMonthlyEquivalent = (plan: PricingPlan) => {
  if (!plan.yearlyPrice || plan.monthlyPrice === 0) {
    return null;
  }

  return Number((plan.yearlyPrice / 12).toFixed(2));
};

export const getUsageProgress = (value: number, limit: number | null) => {
  if (!limit || limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((value / limit) * 100));
};

export const getUpgradeUrgency = (progress: number) => {
  if (progress >= 100) {
    return "critical";
  }

  if (progress >= 80) {
    return "warning";
  }

  return "healthy";
};
