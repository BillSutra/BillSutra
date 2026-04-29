const normalizeSegment = (
  value: string | number | null | undefined,
): string => {
  const stringValue = String(value ?? "")
    .trim()
    .replace(/\s+/g, "_");

  return encodeURIComponent(stringValue || "none");
};

const CACHE_ENV = normalizeSegment(
  process.env.CACHE_ENV?.trim() || process.env.NODE_ENV?.trim() || "development",
);

const APP_PREFIX = `app:${CACHE_ENV}`;

const serializePrimitive = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? normalizeSegment(trimmed) : "all";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => serializePrimitive(item)).join(",")
      : "all";
  }

  return "all";
};

const buildKey = (
  ...parts: Array<string | number | null | undefined>
): string =>
  [APP_PREFIX, ...parts.map((part) => normalizeSegment(part))].join(":");

const buildOwnerScope = (userId: number) => ["owner", userId] as const;

const buildTenantScope = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => {
  if (params.businessId?.trim()) {
    return ["biz", params.businessId.trim()] as const;
  }

  if (typeof params.userId === "number" && Number.isFinite(params.userId)) {
    return ["user", params.userId] as const;
  }

  return ["scope", "unknown"] as const;
};

const buildScopedPrefix = (
  scope: readonly [string, string | number],
  ...parts: Array<string | number | null | undefined>
): string => `${buildKey(scope[0], scope[1], ...parts)}:`;

export const buildDashboardMetricsRedisKey = (
  userId: number,
  query: Record<string, unknown>,
) =>
  buildKey(
    ...buildOwnerScope(userId),
    "dashboard",
    "metrics",
    serializePrimitive(query.range),
    serializePrimitive(query.startDate),
    serializePrimitive(query.endDate),
    serializePrimitive(query.granularity),
  );

export const buildDashboardOverviewRedisKey = (
  userId: number,
  query: Record<string, unknown>,
) =>
  buildKey(
    ...buildOwnerScope(userId),
    "dashboard",
    "overview",
    serializePrimitive(query.range),
    serializePrimitive(query.startDate),
    serializePrimitive(query.endDate),
    serializePrimitive(query.granularity),
  );

export const buildDashboardEndpointRedisKey = (
  userId: number,
  endpoint: string,
  query: Record<string, unknown> = {},
) =>
  buildKey(
    ...buildOwnerScope(userId),
    "dashboard",
    endpoint,
    serializePrimitive(query.range),
    serializePrimitive(query.startDate),
    serializePrimitive(query.endDate),
    serializePrimitive(query.granularity),
    serializePrimitive(query.period),
    serializePrimitive(query.mode),
  );

export const buildDashboardCachePrefix = (userId: number) =>
  buildScopedPrefix(buildOwnerScope(userId), "dashboard");

export const buildReportsSummaryRedisKey = (userId: number) =>
  buildKey(...buildOwnerScope(userId), "reports", "summary");

export const buildReportsCachePrefix = (userId: number) =>
  buildScopedPrefix(buildOwnerScope(userId), "reports");

export const buildAnalyticsOverviewRedisKey = (userId: number) =>
  buildKey(...buildOwnerScope(userId), "analytics", "overview");

export const buildAnalyticsCachePrefix = (userId: number) =>
  buildScopedPrefix(buildOwnerScope(userId), "analytics");

export const buildAnalyticsStatsDirtyRedisKey = (userId: number) =>
  buildKey(...buildOwnerScope(userId), "analytics", "daily-stats", "dirty");

export const buildInventoryInsightsRedisKey = (
  userId: number,
  warehouseId?: number,
) =>
  buildKey(
    ...buildOwnerScope(userId),
    "inventory_insights",
    warehouseId ?? "all",
  );

export const buildInventoryInsightsCachePrefix = (userId: number) =>
  buildScopedPrefix(buildOwnerScope(userId), "inventory_insights");

export const buildBusinessProfileRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildKey(...buildTenantScope(params), "profile");

export const buildBusinessProfileCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "profile");

export const buildSettingsPreferencesRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildKey(...buildTenantScope(params), "settings");

export const buildSettingsPreferencesCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "settings");

export const buildCategoriesRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildKey(...buildTenantScope(params), "categories");

export const buildCategoriesCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "categories");

export const buildSubscriptionPermissionsRedisKey = (businessId: string) =>
  buildKey("biz", businessId.trim(), "permissions");

export const buildSubscriptionPermissionsCachePrefix = (businessId: string) =>
  buildScopedPrefix(["biz", businessId.trim()], "permissions");

export const buildProductOptionsRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
  page: number;
  limit: number;
  search?: string | null;
  category?: string | null;
}) =>
  buildKey(
    ...buildTenantScope(params),
    "products",
    "options",
    params.page,
    params.limit,
    serializePrimitive(params.search),
    serializePrimitive(params.category),
  );

export const buildProductOptionsCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "products", "options");

export const buildCustomerListRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
  page: number;
  limit: number;
  search?: string | null;
}) =>
  buildKey(
    ...buildTenantScope(params),
    "customers",
    params.page,
    params.limit,
    serializePrimitive(params.search),
  );

export const buildCustomerListCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "customers");

export const buildNotificationsRedisKey = (params: {
  businessId?: string | null;
  userId?: number | null;
  page: number;
  limit: number;
  type?: string | null;
  isRead?: boolean | null;
}) =>
  buildKey(
    ...buildTenantScope(params),
    "notifications",
    params.page,
    params.limit,
    serializePrimitive(params.type),
    serializePrimitive(params.isRead),
  );

export const buildNotificationsCachePrefix = (params: {
  businessId?: string | null;
  userId?: number | null;
}) => buildScopedPrefix(buildTenantScope(params), "notifications");

export const getCacheEnvironmentPrefix = () => APP_PREFIX;
