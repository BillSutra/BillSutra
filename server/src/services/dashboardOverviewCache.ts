type OverviewCacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const overviewCache = new Map<string, OverviewCacheEntry>();
const OVERVIEW_CACHE_MS = Number(
  process.env.DASHBOARD_OVERVIEW_CACHE_MS ?? 30_000,
);

const isOverviewCacheEnabled = () =>
  Number.isFinite(OVERVIEW_CACHE_MS) && OVERVIEW_CACHE_MS > 0;

export const getCachedDashboardOverview = (cacheKey: string) => {
  if (!isOverviewCacheEnabled()) {
    return null;
  }

  const cached = overviewCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    overviewCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
};

export const setCachedDashboardOverview = (
  cacheKey: string,
  payload: unknown,
) => {
  if (!isOverviewCacheEnabled()) {
    return;
  }

  overviewCache.set(cacheKey, {
    expiresAt: Date.now() + OVERVIEW_CACHE_MS,
    payload,
  });
};
