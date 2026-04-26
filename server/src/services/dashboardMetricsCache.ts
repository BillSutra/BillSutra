import { buildDashboardCachePrefix } from "../redis/cacheKeys.js";
import { deleteCacheByPrefix } from "../redis/cache.js";

type MetricsCacheEntry = { expiresAt: number; payload: unknown };

const metricsCache = new Map<string, MetricsCacheEntry>();
const METRICS_CACHE_MS = Number(process.env.DASHBOARD_METRICS_CACHE_MS ?? 0);

const isMetricsCacheEnabled = () =>
  Number.isFinite(METRICS_CACHE_MS) && METRICS_CACHE_MS > 0;

export const getCachedMetrics = (cacheKey: string) => {
  if (!isMetricsCacheEnabled()) {
    return null;
  }

  const cached = metricsCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    metricsCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
};

export const setCachedMetrics = (cacheKey: string, payload: unknown) => {
  if (!isMetricsCacheEnabled()) {
    return;
  }

  metricsCache.set(cacheKey, {
    expiresAt: Date.now() + METRICS_CACHE_MS,
    payload,
  });
};

export const invalidateMetricsCacheByUser = (userId: number) => {
  const prefix = `${userId}|`;
  for (const key of metricsCache.keys()) {
    if (key.startsWith(prefix)) {
      metricsCache.delete(key);
    }
  }

  void deleteCacheByPrefix(buildDashboardCachePrefix(userId));
};
