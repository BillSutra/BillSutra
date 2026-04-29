import { invalidateRedisResourceCacheByPrefix } from "./redisResourceCache.js";
import {
  buildCustomerListCachePrefix,
  buildProductOptionsCachePrefix,
} from "../redis/cacheKeys.js";

export const invalidateCustomerListCaches = (
  businessId: string | undefined,
  userId: number,
) =>
  invalidateRedisResourceCacheByPrefix(
    buildCustomerListCachePrefix({ businessId, userId }),
  );

export const invalidateProductOptionCaches = (
  businessId: string | undefined,
  userId: number,
) =>
  invalidateRedisResourceCacheByPrefix(
    buildProductOptionsCachePrefix({ businessId, userId }),
  );
