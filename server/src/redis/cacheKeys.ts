const serializeQueryValue = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(",");
  }

  return "";
};

export const buildDashboardMetricsRedisKey = (
  userId: number,
  query: Record<string, unknown>,
) =>
  `dashboard:${userId}:metrics:${[
    serializeQueryValue(query.range),
    serializeQueryValue(query.startDate),
    serializeQueryValue(query.endDate),
    serializeQueryValue(query.granularity),
  ].join("|")}`;

export const buildDashboardOverviewRedisKey = (
  userId: number,
  query: Record<string, unknown>,
) =>
  `dashboard:${userId}:overview:${[
    serializeQueryValue(query.range),
    serializeQueryValue(query.startDate),
    serializeQueryValue(query.endDate),
    serializeQueryValue(query.granularity),
  ].join("|")}`;

export const buildDashboardCachePrefix = (userId: number) =>
  `dashboard:${userId}:`;

export const buildReportsSummaryRedisKey = (userId: number) =>
  `reports:${userId}:summary`;

export const buildReportsCachePrefix = (userId: number) => `reports:${userId}:`;

export const buildAnalyticsOverviewRedisKey = (userId: number) =>
  `analytics:${userId}:overview`;

export const buildAnalyticsCachePrefix = (userId: number) =>
  `analytics:${userId}:`;

export const buildInventoryInsightsRedisKey = (
  userId: number,
  warehouseId?: number,
) => `inventory-insights:${userId}:${warehouseId ?? "all"}`;

export const buildInventoryInsightsCachePrefix = (userId: number) =>
  `inventory-insights:${userId}:`;
