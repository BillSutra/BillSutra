export type AccessPlanId = "pro" | "pro-plus";
export type AccessBillingCycle = "monthly" | "yearly";

type AccessPlanConfig = {
  id: AccessPlanId;
  name: string;
  description: string;
  amounts: Record<AccessBillingCycle, number>;
};

export const ACCESS_PLANS: Record<AccessPlanId, AccessPlanConfig> = {
  pro: {
    id: "pro",
    name: "Pro",
    description:
      "Unlimited billing, worker management, smart suggestions, and branded invoices.",
    amounts: {
      monthly: 499,
      yearly: 4790,
    },
  },
  "pro-plus": {
    id: "pro-plus",
    name: "Pro Plus",
    description: "Advanced analytics, exports, and premium operational controls.",
    amounts: {
      monthly: 999,
      yearly: 9590,
    },
  },
};

export const ACCESS_PLAN_IDS = Object.keys(ACCESS_PLANS) as AccessPlanId[];
export const ACCESS_BILLING_CYCLES = ["monthly", "yearly"] as const;

export const resolveAccessPlanQuote = (
  planId: AccessPlanId,
  billingCycle: AccessBillingCycle,
) => {
  const plan = ACCESS_PLANS[planId];

  return {
    planId,
    billingCycle,
    name: plan.name,
    description: plan.description,
    amount: plan.amounts[billingCycle],
    amountPaise: Math.round(plan.amounts[billingCycle] * 100),
    currency: "INR" as const,
  };
};

export const listAccessPlans = () =>
  ACCESS_PLAN_IDS.map((planId) => ({
    id: planId,
    name: ACCESS_PLANS[planId].name,
    description: ACCESS_PLANS[planId].description,
    amounts: ACCESS_PLANS[planId].amounts,
    currency: "INR" as const,
  }));
