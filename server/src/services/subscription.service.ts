import prisma from "../config/db.config.js";
import {
  featureRequiredPlan,
  fromPrismaPlanEnum,
  getPlanConfig,
  isPlanAtLeast,
  type SubscriptionFeatureKey,
  type SubscriptionPlanId,
  toPrismaBillingCycleEnum,
  toPrismaPlanEnum,
} from "../config/subscriptionPlans.js";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "EXPIRED" | "CANCELLED";

type UsageSnapshot = {
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  invoicesCreated: number;
  productsCreated: number;
  customersCreated: number;
};

export type SubscriptionSnapshot = {
  planId: SubscriptionPlanId;
  planName: string;
  status: SubscriptionStatus;
  billingCycle: "monthly" | "yearly" | null;
  startedAt: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  expiresAt: string | null;
  usage: UsageSnapshot;
  limits: {
    invoicesPerMonth: number | null;
  };
};

export type FeatureAccessResult = {
  allowed: boolean;
  code: "OK" | "SUBSCRIPTION_REQUIRED" | "PLAN_LIMIT_REACHED";
  message: string;
  feature: SubscriptionFeatureKey;
  requiredPlan: SubscriptionPlanId | null;
  snapshot: SubscriptionSnapshot;
};

const getMonthWindow = (now = new Date()) => {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const nextStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;

  return { start, nextStart, key };
};

const toLifecycleStatus = (
  status: SubscriptionStatus,
  planId: SubscriptionPlanId,
  currentPeriodEnd: Date | null,
  now: Date,
): SubscriptionStatus => {
  if (planId === "free") {
    return "ACTIVE";
  }

  if (status === "EXPIRED") {
    return "EXPIRED";
  }

  if (currentPeriodEnd && now > currentPeriodEnd) {
    return "EXPIRED";
  }

  return status;
};

const ensureSubscriptionRow = async (userId: number) => {
  const existing = await prisma.subscription.findUnique({
    where: { user_id: userId },
  });

  if (existing) {
    return existing;
  }

  const { start } = getMonthWindow();
  const trialDays = Number(process.env.SUBSCRIPTION_TRIAL_DAYS ?? 0);
  const hasTrial = Number.isFinite(trialDays) && trialDays > 0;
  const now = new Date();
  const trialEndsAt = hasTrial
    ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
    : null;

  return prisma.subscription.create({
    data: {
      user_id: userId,
      plan_id: hasTrial ? "PRO" : "FREE",
      status: hasTrial ? "TRIAL" : "ACTIVE",
      started_at: now,
      trial_starts_at: hasTrial ? now : null,
      trial_ends_at: trialEndsAt,
      current_period_start: start,
      current_period_end: hasTrial ? trialEndsAt : null,
    },
  });
};

const resolveCurrentUsage = async ({
  userId,
  subscriptionId,
}: {
  userId: number;
  subscriptionId: string;
}) => {
  const { key, start, nextStart } = getMonthWindow();

  const usage = await prisma.subscriptionUsage.upsert({
    where: {
      subscription_id_period_key: {
        subscription_id: subscriptionId,
        period_key: key,
      },
    },
    update: {},
    create: {
      subscription_id: subscriptionId,
      user_id: userId,
      period_key: key,
      period_start: start,
      period_end: nextStart,
      invoices_created: 0,
      products_created: 0,
      customers_created: 0,
    },
  });

  return usage;
};

const toSnapshot = async (userId: number) => {
  let subscription = await ensureSubscriptionRow(userId);
  const now = new Date();

  if (
    subscription.status === "TRIAL" &&
    subscription.trial_ends_at &&
    now > subscription.trial_ends_at
  ) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan_id: "FREE",
        status: "ACTIVE",
        billing_cycle: null,
        trial_starts_at: null,
        trial_ends_at: null,
        current_period_start: now,
        current_period_end: null,
        expires_at: null,
      },
    });
  }

  const nextStatus = toLifecycleStatus(
    subscription.status,
    fromPrismaPlanEnum(subscription.plan_id),
    subscription.current_period_end,
    now,
  );

  if (nextStatus !== subscription.status) {
    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: nextStatus },
    });
  }

  const usage = await resolveCurrentUsage({
    userId,
    subscriptionId: subscription.id,
  });

  const plan = getPlanConfig(fromPrismaPlanEnum(subscription.plan_id));

  return {
    subscription,
    usage,
    snapshot: {
      planId: fromPrismaPlanEnum(subscription.plan_id),
      planName: plan.name,
      status: subscription.status,
      billingCycle:
        subscription.billing_cycle === "YEARLY"
          ? "yearly"
          : subscription.billing_cycle === "MONTHLY"
            ? "monthly"
            : null,
      startedAt: subscription.started_at.toISOString(),
      trialEndsAt: subscription.trial_ends_at?.toISOString() ?? null,
      currentPeriodStart:
        subscription.current_period_start?.toISOString() ?? null,
      currentPeriodEnd: subscription.current_period_end?.toISOString() ?? null,
      cancelledAt: subscription.cancelled_at?.toISOString() ?? null,
      expiresAt: subscription.expires_at?.toISOString() ?? null,
      usage: {
        periodKey: usage.period_key,
        periodStart: usage.period_start.toISOString(),
        periodEnd: usage.period_end.toISOString(),
        invoicesCreated: usage.invoices_created,
        productsCreated: usage.products_created,
        customersCreated: usage.customers_created,
      },
      limits: {
        invoicesPerMonth: plan.invoiceLimitPerMonth,
      },
    } satisfies SubscriptionSnapshot,
  };
};

export const getSubscriptionSnapshot = async (
  userId: number,
): Promise<SubscriptionSnapshot> => {
  const { snapshot } = await toSnapshot(userId);
  return snapshot;
};

export const checkFeatureAccess = async (
  userId: number,
  feature: SubscriptionFeatureKey,
): Promise<FeatureAccessResult> => {
  const { snapshot } = await toSnapshot(userId);

  if (feature === "INVOICE_CREATE") {
    const invoiceLimit = snapshot.limits.invoicesPerMonth;
    if (
      invoiceLimit !== null &&
      snapshot.usage.invoicesCreated >= invoiceLimit
    ) {
      return {
        allowed: false,
        code: "PLAN_LIMIT_REACHED",
        message: `You have reached your ${snapshot.planName} monthly invoice limit of ${invoiceLimit}. Upgrade to continue creating invoices.`,
        feature,
        requiredPlan: "pro",
        snapshot,
      };
    }

    return {
      allowed: true,
      code: "OK",
      message: "Invoice creation is available.",
      feature,
      requiredPlan: null,
      snapshot,
    };
  }

  const requiredPlan = featureRequiredPlan[feature];
  if (!isPlanAtLeast(snapshot.planId, requiredPlan)) {
    return {
      allowed: false,
      code: "SUBSCRIPTION_REQUIRED",
      message: `${snapshot.planName} does not include this feature. Upgrade to ${getPlanConfig(requiredPlan).name}.`,
      feature,
      requiredPlan,
      snapshot,
    };
  }

  return {
    allowed: true,
    code: "OK",
    message: "Feature access granted.",
    feature,
    requiredPlan: null,
    snapshot,
  };
};

export const incrementInvoiceUsage = async (userId: number, by = 1) => {
  if (by <= 0) {
    return;
  }

  const { subscription, usage } = await toSnapshot(userId);

  await prisma.subscriptionUsage.update({
    where: {
      subscription_id_period_key: {
        subscription_id: subscription.id,
        period_key: usage.period_key,
      },
    },
    data: {
      invoices_created: {
        increment: by,
      },
    },
  });
};

export const applySubscriptionGrant = async ({
  userId,
  planId,
  billingCycle,
  paymentId,
  metadata,
}: {
  userId: number;
  planId: SubscriptionPlanId;
  billingCycle: "monthly" | "yearly";
  paymentId?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const now = new Date();
  const periodEnd = new Date(now);
  if (billingCycle === "yearly") {
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  } else {
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  }

  return prisma.subscription.upsert({
    where: { user_id: userId },
    update: {
      plan_id: toPrismaPlanEnum(planId),
      status: "ACTIVE",
      billing_cycle: toPrismaBillingCycleEnum(billingCycle),
      started_at: now,
      trial_starts_at: null,
      trial_ends_at: null,
      current_period_start: now,
      current_period_end: periodEnd,
      cancelled_at: null,
      expires_at: null,
      latest_payment_id: paymentId ?? null,
      metadata: metadata ? (metadata as any) : null,
    },
    create: {
      user_id: userId,
      plan_id: toPrismaPlanEnum(planId),
      status: "ACTIVE",
      billing_cycle: toPrismaBillingCycleEnum(billingCycle),
      started_at: now,
      current_period_start: now,
      current_period_end: periodEnd,
      latest_payment_id: paymentId ?? null,
      metadata: metadata ? (metadata as any) : null,
    },
  });
};

export const cancelCurrentSubscription = async (userId: number) => {
  const existing = await ensureSubscriptionRow(userId);

  if (existing.plan_id === "FREE") {
    return existing;
  }

  return prisma.subscription.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelled_at: new Date(),
    },
  });
};

export const switchToFreePlan = async (userId: number) => {
  const now = new Date();
  return prisma.subscription.upsert({
    where: { user_id: userId },
    update: {
      plan_id: "FREE",
      status: "ACTIVE",
      billing_cycle: null,
      started_at: now,
      trial_starts_at: null,
      trial_ends_at: null,
      current_period_start: now,
      current_period_end: null,
      cancelled_at: null,
      expires_at: null,
      latest_payment_id: null,
    },
    create: {
      user_id: userId,
      plan_id: "FREE",
      status: "ACTIVE",
      started_at: now,
      current_period_start: now,
    },
  });
};

export const hasPaidAccess = async (userId: number) => {
  const snapshot = await getSubscriptionSnapshot(userId);
  if (snapshot.planId === "free") {
    return false;
  }

  return snapshot.status !== "EXPIRED";
};
