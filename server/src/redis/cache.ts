import { getRedisClient, isRedisCacheEnabled } from "./redisClient.js";
import { recordRequestCacheEvent } from "../lib/requestPerformance.js";

const CACHE_LOG_PREFIX = "[redis.cache]";
const CACHE_INDEX_PREFIX = "cache-index:";
const REDIS_READ_TIMEOUT_MS = Math.max(
  Number(process.env.REDIS_CACHE_READ_TIMEOUT_MS ?? 150),
  50,
);
const REDIS_WRITE_TIMEOUT_MS = Math.max(
  Number(process.env.REDIS_CACHE_WRITE_TIMEOUT_MS ?? 250),
  50,
);

const buildIndexKey = (prefix: string) => `${CACHE_INDEX_PREFIX}${prefix}`;

type SetCacheOptions = {
  invalidationPrefixes?: string[];
};

const withRedisTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  label: string,
  key: string,
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const safeJsonParse = <T>(raw: string, fallback: T): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

export const getOrSetCache = async <T>(
  key: string,
  ttlSeconds: number,
  resolver: () => Promise<T>,
  options?: SetCacheOptions,
) => {
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const resolved = await resolver();
  void setCache(key, resolved, ttlSeconds, options);
  return resolved;
};

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisCacheEnabled()) {
    return null;
  }

  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const startedAt = Date.now();
    const raw = await withRedisTimeout(
      client.get(key),
      REDIS_READ_TIMEOUT_MS,
      "get",
      key,
    );
    if (!raw) {
      recordRequestCacheEvent({
        layer: "redis",
        key,
        hit: false,
        durationMs: Date.now() - startedAt,
      });
      console.info(`${CACHE_LOG_PREFIX} miss`, { key });
      return null;
    }

    recordRequestCacheEvent({
      layer: "redis",
      key,
      hit: true,
      durationMs: Date.now() - startedAt,
    });
    console.info(`${CACHE_LOG_PREFIX} hit`, { key });
    return safeJsonParse<T | null>(raw, null);
  } catch (error) {
    console.warn(`${CACHE_LOG_PREFIX} get failed`, {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const setCache = async (
  key: string,
  value: unknown,
  ttlSeconds: number,
  options?: SetCacheOptions,
) => {
  if (!isRedisCacheEnabled()) {
    return false;
  }

  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    const serialized = safeJsonStringify(value);
    if (serialized === null) {
      console.warn(`${CACHE_LOG_PREFIX} set skipped`, {
        key,
        message: "Unable to serialize cache value",
      });
      return false;
    }

    await withRedisTimeout(
      client.set(key, serialized, { ex: ttlSeconds }),
      REDIS_WRITE_TIMEOUT_MS,
      "set",
      key,
    );
    if (options?.invalidationPrefixes?.length) {
      await Promise.all(
        options.invalidationPrefixes.map(async (prefix) => {
          const indexKey = buildIndexKey(prefix);
          await withRedisTimeout(
            client.sAdd(indexKey, key),
            REDIS_WRITE_TIMEOUT_MS,
            "sAdd",
            indexKey,
          );
          await withRedisTimeout(
            client.expire(indexKey, Math.max(ttlSeconds, 60)),
            REDIS_WRITE_TIMEOUT_MS,
            "expire",
            indexKey,
          );
        }),
      );
    }
    console.info(`${CACHE_LOG_PREFIX} set`, { key, ttlSeconds });
    return true;
  } catch (error) {
    console.warn(`${CACHE_LOG_PREFIX} set failed`, {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const deleteCache = async (key: string) => {
  if (!isRedisCacheEnabled()) {
    return 0;
  }

  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  try {
    const deleted = await withRedisTimeout(
      client.del(key),
      REDIS_WRITE_TIMEOUT_MS,
      "delete",
      key,
    );
    console.info(`${CACHE_LOG_PREFIX} delete`, { key, deleted });
    return deleted;
  } catch (error) {
    console.warn(`${CACHE_LOG_PREFIX} delete failed`, {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};

export const deleteCacheByPrefix = async (prefix: string) => {
  if (!isRedisCacheEnabled()) {
    return 0;
  }

  const client = await getRedisClient();
  if (!client) {
    return 0;
  }

  let cursor = "0";
  let deleted = 0;

  try {
    const indexKey = buildIndexKey(prefix);
    const indexedKeys = await withRedisTimeout(
      client.sMembers(indexKey),
      REDIS_READ_TIMEOUT_MS,
      "sMembers",
      indexKey,
    );
    if (indexedKeys.length > 0) {
      deleted += await withRedisTimeout(
        client.del(...indexedKeys),
        REDIS_WRITE_TIMEOUT_MS,
        "delete-prefix-index",
        prefix,
      );
      await withRedisTimeout(
        client.del(indexKey),
        REDIS_WRITE_TIMEOUT_MS,
        "delete-index",
        indexKey,
      );
      console.info(`${CACHE_LOG_PREFIX} delete-prefix-index`, {
        prefix,
        deleted,
      });
      return deleted;
    }

    do {
      const [nextCursor, keys] = await withRedisTimeout(
        client.scan(cursor, {
          match: `${prefix}*`,
          count: 100,
        }),
        REDIS_READ_TIMEOUT_MS,
        "scan",
        prefix,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await withRedisTimeout(
          client.del(...keys),
          REDIS_WRITE_TIMEOUT_MS,
          "delete-prefix",
          prefix,
        );
      }
    } while (cursor !== "0");

    console.info(`${CACHE_LOG_PREFIX} delete-prefix`, {
      prefix,
      deleted,
    });

    return deleted;
  } catch (error) {
    console.warn(`${CACHE_LOG_PREFIX} delete-prefix failed`, {
      prefix,
      message: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};
