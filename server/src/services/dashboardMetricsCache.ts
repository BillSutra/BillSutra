type MetricsCacheEntry = { expiresAt: number; payload: unknown };

const metricsCache = new Map<string, MetricsCacheEntry>();
const METRICS_CACHE_MS = Number(process.env.DASHBOARD_METRICS_CACHE_MS ?? 10_000);

export const getCachedMetrics = (cacheKey: string) => {
  const cached = metricsCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    metricsCache.delete(cacheKey);
    return null;
  }
  return cached.payload;
};

export const setCachedMetrics = (cacheKey: string, payload: unknown) => {
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
};
