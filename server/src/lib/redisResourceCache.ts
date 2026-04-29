import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { getCache, setCache, deleteCache, deleteCacheByPrefix } from "../redis/cache.js";
import { sendResponse } from "../utils/sendResponse.js";
import { recordRequestCacheEvent } from "./requestPerformance.js";

const CACHE_LOG_PREFIX = "[redis.resource-cache]";

type RedisResourceCacheEntry<T> = {
  value: T;
  etag: string;
  lastModified: string;
  staleAt: number;
  expiresAt: number;
};

type CacheDurations = {
  ttlSeconds: number;
  staleWhileRevalidateSeconds?: number;
};

type SetRedisResourceCacheOptions<T> = CacheDurations & {
  invalidationPrefixes?: string[];
  updatedAt?: Date;
  value: T;
};

type RespondWithRedisCachedDataOptions<T> = CacheDurations & {
  req: Request;
  res: Response;
  key: string;
  invalidationPrefixes?: string[];
  resolver: () => Promise<T>;
  label?: string;
};

const inFlightRevalidations = new Map<string, Promise<void>>();

const buildEtag = (value: unknown) => {
  const hash = createHash("sha1")
    .update(JSON.stringify(value))
    .digest("base64url");

  return `W/"${hash}"`;
};

const buildEntry = <T>(
  value: T,
  options: CacheDurations & { updatedAt?: Date },
): RedisResourceCacheEntry<T> => {
  const now = Date.now();
  const staleWhileRevalidateSeconds = Math.max(
    options.staleWhileRevalidateSeconds ?? 0,
    0,
  );
  const updatedAt = options.updatedAt ?? new Date(now);

  return {
    value,
    etag: buildEtag(value),
    lastModified: updatedAt.toUTCString(),
    staleAt: now + Math.max(options.ttlSeconds, 1) * 1000,
    expiresAt:
      now + Math.max(options.ttlSeconds + staleWhileRevalidateSeconds, 1) * 1000,
  };
};

const applyCacheHeaders = <T>(
  res: Response,
  entry: RedisResourceCacheEntry<T>,
) => {
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("ETag", entry.etag);
  res.setHeader("Last-Modified", entry.lastModified);
};

const isRequestFresh = <T>(
  req: Request,
  entry: RedisResourceCacheEntry<T>,
) => {
  const ifNoneMatch = req.headers["if-none-match"];
  if (typeof ifNoneMatch === "string" && ifNoneMatch.trim() === entry.etag) {
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (typeof ifModifiedSince === "string") {
    const requestDate = Date.parse(ifModifiedSince);
    const cachedDate = Date.parse(entry.lastModified);

    if (Number.isFinite(requestDate) && Number.isFinite(cachedDate)) {
      return cachedDate <= requestDate;
    }
  }

  return false;
};

const triggerBackgroundRevalidation = async <T>(
  key: string,
  options: Omit<RespondWithRedisCachedDataOptions<T>, "req" | "res">,
) => {
  if (inFlightRevalidations.has(key)) {
    return;
  }

  const task = (async () => {
    try {
      const nextValue = await options.resolver();
      await setRedisResourceCache(key, {
        value: nextValue,
        ttlSeconds: options.ttlSeconds,
        staleWhileRevalidateSeconds: options.staleWhileRevalidateSeconds,
        invalidationPrefixes: options.invalidationPrefixes,
      });
      console.info(`${CACHE_LOG_PREFIX} rebuilt`, {
        key,
        label: options.label ?? null,
      });
    } catch (error) {
      console.warn(`${CACHE_LOG_PREFIX} rebuild failed`, {
        key,
        label: options.label ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      inFlightRevalidations.delete(key);
    }
  })();

  inFlightRevalidations.set(key, task);
};

export const setRedisResourceCache = async <T>(
  key: string,
  options: SetRedisResourceCacheOptions<T>,
) => {
  const entry = buildEntry(options.value, options);
  const totalTtlSeconds = Math.max(
    options.ttlSeconds + Math.max(options.staleWhileRevalidateSeconds ?? 0, 0),
    1,
  );

  return setCache(key, entry, totalTtlSeconds, {
    invalidationPrefixes: options.invalidationPrefixes,
  });
};

export const invalidateRedisResourceCache = async (key: string) => {
  return deleteCache(key);
};

export const invalidateRedisResourceCacheByPrefix = async (prefix: string) => {
  console.info(`${CACHE_LOG_PREFIX} invalidate-prefix`, { prefix });
  return deleteCacheByPrefix(prefix);
};

export const respondWithRedisCachedData = async <T>(
  options: RespondWithRedisCachedDataOptions<T>,
) => {
  const startedAt = Date.now();
  const cachedEntry = await getCache<RedisResourceCacheEntry<T>>(options.key);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    const stale = cachedEntry.staleAt <= Date.now();
    applyCacheHeaders(options.res, cachedEntry);
    recordRequestCacheEvent({
      layer: stale ? "redis-resource-stale" : "redis-resource",
      key: options.key,
      hit: true,
      durationMs: Date.now() - startedAt,
    });

    if (isRequestFresh(options.req, cachedEntry)) {
      if (stale) {
        void triggerBackgroundRevalidation(options.key, {
          key: options.key,
          resolver: options.resolver,
          ttlSeconds: options.ttlSeconds,
          staleWhileRevalidateSeconds: options.staleWhileRevalidateSeconds,
          invalidationPrefixes: options.invalidationPrefixes,
          label: options.label,
        });
      }
      options.res.status(304).end();
      return;
    }

    if (stale) {
      console.info(`${CACHE_LOG_PREFIX} stale-hit`, {
        key: options.key,
        label: options.label ?? null,
      });
      void triggerBackgroundRevalidation(options.key, {
        key: options.key,
        resolver: options.resolver,
        ttlSeconds: options.ttlSeconds,
        staleWhileRevalidateSeconds: options.staleWhileRevalidateSeconds,
        invalidationPrefixes: options.invalidationPrefixes,
        label: options.label,
      });
    }

    return sendResponse(options.res, 200, { data: cachedEntry.value });
  }

  recordRequestCacheEvent({
    layer: "redis-resource",
    key: options.key,
    hit: false,
    durationMs: Date.now() - startedAt,
  });

  const value = await options.resolver();
  const entry = buildEntry(value, options);
  applyCacheHeaders(options.res, entry);

  void setRedisResourceCache(options.key, {
    value,
    ttlSeconds: options.ttlSeconds,
    staleWhileRevalidateSeconds: options.staleWhileRevalidateSeconds,
    invalidationPrefixes: options.invalidationPrefixes,
  });

  return sendResponse(options.res, 200, { data: value });
};
