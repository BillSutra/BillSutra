import { getRedisClient, isRedisCacheEnabled } from "./redisClient.js";

const CACHE_LOG_PREFIX = "[redis.cache]";

export const getCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisCacheEnabled()) {
    return null;
  }

  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const raw = await client.get(key);
    if (!raw) {
      console.info(`${CACHE_LOG_PREFIX} miss`, { key });
      return null;
    }

    console.info(`${CACHE_LOG_PREFIX} hit`, { key });
    return JSON.parse(raw) as T;
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
) => {
  if (!isRedisCacheEnabled()) {
    return false;
  }

  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
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
    const deleted = await client.del(key);
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
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await client.del(...keys);
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
