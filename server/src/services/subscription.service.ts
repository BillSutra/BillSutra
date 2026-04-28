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

type UserSubscriptionPlan = "free" | "pro" | "pro_plus";
type UserSubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

const CACHE_TTL_MS = Math.max(
  Number(process.env.SUBSCRIPTION_CACHE_TTL_MS ?? 30_000),
  1_000,
);
const LEGACY_BUSINESS_PREFIX = "legacy-business-";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

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

export type UserSubscriptionRecord = {
  isSubscribed: boolean;
  plan: UserSubscriptionPlan;
  status: UserSubscriptionStatus;
  trialEndsAt?: Date;
  endDate?: Date;
};

export type SubscriptionFeatureAccess = {
  maxInvoices: number | "unlimited";
  analytics: boolean | "advanced";
  teamAccess: boolean;
  export: boolean;
};

export type UserPermissions = {
  plan: UserSubscriptionPlan;
  isSubscribed: boolean;
  features: SubscriptionFeatureAccess;
  usage: {
    invoicesUsed: number;
  };
  limitsReached: {
    invoicesLimitReached: boolean;
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

const snapshotCache = new Map<number, CacheEntry<SubscriptionSnapshot>>();
const snapshotInFlightLoads = new Map<number, Promise<SubscriptionSnapshot>>();
const businessOwnerCache = new Map<string, CacheEntry<number | null>>();
const userSubscriptionCache = new Map<
  string,
  CacheEntry<UserSubscriptionRecord>
>();
const permissionsCache = new Map<string, CacheEntry<UserPermissions>>();
const businessIdsByOwnerUser = new Map<number, Set<string>>();

const getCached = <K extends string | number, T>(
  cache: Map<K, CacheEntry<T>>,
  key: K,
): T | undefined => {
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
};

const setCached = <K extends string | number, T>(
  cache: Map<K, CacheEntry<T>>,
  key: K,
  value: T,
) => {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const clearBusinessScopedCaches = (businessId: string) => {
  userSubscriptionCache.delete(businessId);
  permissionsCache.delete(businessId);
};

const rememberBusinessOwner = (
  businessId: string,
  ownerUserId: number | null,
) => {
  if (!ownerUserId) {
    return;
  }

  let ownedBusinessIds = businessIdsByOwnerUser.get(ownerUserId);
  if (!ownedBusinessIds) {
    ownedBusinessIds = new Set<string>();
    businessIdsByOwnerUser.set(ownerUserId, ownedBusinessIds);
  }

  ownedBusinessIds.add(businessId);
};

const invalidateCachesForOwnerUser = (ownerUserId: number) => {
  snapshotCache.delete(ownerUserId);

  const businessIds = businessIdsByOwnerUser.get(ownerUserId);
  if (!businessIds) {
    return;
  }

  for (const businessId of businessIds) {
    clearBusinessScopedCaches(businessId);
  }
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
    return status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
  }

  if (status === "EXPIRED") {
    return "EXPIRED";
  }

  if (currentPeriodEnd && now > currentPeriodEnd) {
    return "EXPIRED";
  }

  return status;
};

const toExternalPlan = (plan: SubscriptionPlanId): UserSubscriptionPlan =>
  plan === "pro-plus" ? "pro_plus" : plan;

const toExternalStatus = (status: SubscriptionStatus): UserSubscriptionStatus =>
  status.toLowerCase() as UserSubscriptionStatus;

const toInternalPlan = (plan: UserSubscriptionPlan): SubscriptionPlanId =>
  plan === "pro_plus" ? "pro-plus" : plan;

const parseOwnerUserId = (ownerId: string | null | undefined) => {
  if (!ownerId) {
    return null;
  }

  const parsed = Number.parseInt(ownerId, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveOwnerUserIdFromLegacyBusinessId = (businessId: string) => {
  if (!businessId.startsWith(LEGACY_BUSINESS_PREFIX)) {
    return null;
  }

  const raw = businessId.slice(LEGACY_BUSINESS_PREFIX.length).trim();
  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveOwnerUserIdFromBusinessId = async (businessId: string) => {
  const normalizedBusinessId = businessId.trim();
  if (!normalizedBusinessId) {
    return null;
  }

  const cached = getCached(businessOwnerCache, normalizedBusinessId);
  if (cached !== undefined) {
    return cached;
  }

  const legacyOwner =
    resolveOwnerUserIdFromLegacyBusinessId(normalizedBusinessId);
  if (legacyOwner) {
    setCached(businessOwnerCache, normalizedBusinessId, legacyOwner);
    rememberBusinessOwner(normalizedBusinessId, legacyOwner);
    return legacyOwner;
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: normalizedBusinessId },
      select: { ownerId: true },
    });

    const ownerUserId = parseOwnerUserId(business?.ownerId);
    setCached(businessOwnerCache, normalizedBusinessId, ownerUserId);
    rememberBusinessOwner(normalizedBusinessId, ownerUserId);
    return ownerUserId;
  } catch {
    setCached(businessOwnerCache, normalizedBusinessId, null);
    return null;
  }
};

const buildDefaultSnapshot = (): SubscriptionSnapshot => {
  const { key, start, nextStart } = getMonthWindow();
  const freePlan = getPlanConfig("free");

  return {
    planId: "free",
    planName: freePlan.name,
    status: "ACTIVE",
    billingCycle: null,
    startedAt: start.toISOString(),
    trialEndsAt: null,
    currentPeriodStart: start.toISOString(),
    currentPeriodEnd: null,
    cancelledAt: null,
    expiresAt: null,
    usage: {
      periodKey: key,
      periodStart: start.toISOString(),
      periodEnd: nextStart.toISOString(),
      invoicesCreated: 0,
      productsCreated: 0,
      customersCreated: 0,
    },
    limits: {
      invoicesPerMonth: freePlan.invoiceLimitPerMonth,
    },
  };
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

  if (nextStatus === "EXPIRED" && subscription.plan_id !== "FREE") {
    const expiredAt =
      subscription.current_period_end ?? subscription.expires_at ?? now;

    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        plan_id: "FREE",
        status: "EXPIRED",
        billing_cycle: null,
        trial_starts_at: null,
        trial_ends_at: null,
        current_period_start: now,
        current_period_end: null,
        expires_at: expiredAt,
      },
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

const loadSnapshotForUser = async (userId: number) => {
  const cached = getCached(snapshotCache, userId);
  if (cached !== undefined) {
    return cached;
  }

  const inFlight = snapshotInFlightLoads.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const loadPromise = toSnapshot(userId)
    .then(({ snapshot }) => {
      setCached(snapshotCache, userId, snapshot);
      return snapshot;
    })
    .finally(() => {
      snapshotInFlightLoads.delete(userId);
    });

  snapshotInFlightLoads.set(userId, loadPromise);
  return loadPromise;
};

const buildUserSubscriptionRecord = (
  snapshot: SubscriptionSnapshot,
): UserSubscriptionRecord => {
  const plan = toExternalPlan(snapshot.planId);
  const status = toExternalStatus(snapshot.status);
  const trialEndsAt = snapshot.trialEndsAt
    ? new Date(snapshot.trialEndsAt)
    : undefined;
  const endDate = snapshot.currentPeriodEnd
    ? new Date(snapshot.currentPeriodEnd)
    : snapshot.expiresAt
      ? new Date(snapshot.expiresAt)
      : undefined;

  const isSubscribed =
    plan !== "free" &&
    (status === "trial" || status === "active" || status === "cancelled");

  return {
    isSubscribed,
    plan,
    status,
    ...(trialEndsAt ? { trialEndsAt } : {}),
    ...(endDate ? { endDate } : {}),
  };
};

export const getSubscriptionSnapshot = async (
  userId: number,
): Promise<SubscriptionSnapshot> => {
  return loadSnapshotForUser(userId);
};

export const getUserSubscription = async (
  businessId: string,
): Promise<UserSubscriptionRecord> => {
  const normalizedBusinessId = businessId.trim();
  if (!normalizedBusinessId) {
    return buildUserSubscriptionRecord(buildDefaultSnapshot());
  }

  const cached = getCached(userSubscriptionCache, normalizedBusinessId);
  if (cached !== undefined) {
    return cached;
  }

  const ownerUserId =
    await resolveOwnerUserIdFromBusinessId(normalizedBusinessId);
  if (!ownerUserId) {
    const fallback = buildUserSubscriptionRecord(buildDefaultSnapshot());
    setCached(userSubscriptionCache, normalizedBusinessId, fallback);
    return fallback;
  }

  const snapshot = await loadSnapshotForUser(ownerUserId);
  const result = buildUserSubscriptionRecord(snapshot);
  setCached(userSubscriptionCache, normalizedBusinessId, result);
  return result;
};

export const getFeatureAccess = (
  plan: UserSubscriptionPlan,
): SubscriptionFeatureAccess => {
  const internalPlan = toInternalPlan(plan);

  if (internalPlan === "free") {
    return {
      maxInvoices: 50,
      analytics: false,
      teamAccess: false,
      export: false,
    };
  }

  if (internalPlan === "pro") {
    return {
      maxInvoices: "unlimited",
      analytics: true,
      teamAccess: false,
      export: true,
    };
  }

  return {
    maxInvoices: "unlimited",
    analytics: "advanced",
    teamAccess: true,
    export: true,
  };
};

export const getUserPermissions = async (
  businessId: string,
): Promise<UserPermissions> => {
  const normalizedBusinessId = businessId.trim();
  if (!normalizedBusinessId) {
    const features = getFeatureAccess("free");
    return {
      plan: "free",
      isSubscribed: false,
      features,
      usage: { invoicesUsed: 0 },
      limitsReached: { invoicesLimitReached: false },
    };
  }

  const cached = getCached(permissionsCache, normalizedBusinessId);
  if (cached !== undefined) {
    return cached;
  }

  const [subscription, ownerUserId] = await Promise.all([
    getUserSubscription(normalizedBusinessId),
    resolveOwnerUserIdFromBusinessId(normalizedBusinessId),
  ]);

  const snapshot = ownerUserId
    ? await loadSnapshotForUser(ownerUserId)
    : buildDefaultSnapshot();
  const features = getFeatureAccess(subscription.plan);
  const invoicesUsed = snapshot.usage.invoicesCreated;
  const invoicesLimitReached =
    typeof features.maxInvoices === "number" &&
    invoicesUsed >= features.maxInvoices;

  const permissions: UserPermissions = {
    plan: subscription.plan,
    isSubscribed: subscription.isSubscribed,
    features,
    usage: {
      invoicesUsed,
    },
    limitsReached: {
      invoicesLimitReached,
    },
  };

  setCached(permissionsCache, normalizedBusinessId, permissions);
  return permissions;
};

export const checkFeatureAccess = async (
  userId: number,
  feature: SubscriptionFeatureKey,
): Promise<FeatureAccessResult> => {
  const snapshot = await loadSnapshotForUser(userId);

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

  invalidateCachesForOwnerUser(userId);
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

  const result = await prisma.subscription.upsert({
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

  invalidateCachesForOwnerUser(userId);
  return result;
};

export const cancelCurrentSubscription = async (userId: number) => {
  const existing = await ensureSubscriptionRow(userId);

  if (existing.plan_id === "FREE") {
    invalidateCachesForOwnerUser(userId);
    return existing;
  }

  const result = await prisma.subscription.update({
    where: { id: existing.id },
    data: {
      status: "CANCELLED",
      cancelled_at: new Date(),
    },
  });

  invalidateCachesForOwnerUser(userId);
  return result;
};

export const switchToFreePlan = async (userId: number) => {
  const now = new Date();
  const result = await prisma.subscription.upsert({
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

  invalidateCachesForOwnerUser(userId);
  return result;
};

export const hasPaidAccess = async (userId: number) => {
  const snapshot = await getSubscriptionSnapshot(userId);
  if (snapshot.planId === "free") {
    return false;
  }

  return (
    snapshot.status === "ACTIVE" ||
    snapshot.status === "TRIAL" ||
    snapshot.status === "CANCELLED"
  );
};
