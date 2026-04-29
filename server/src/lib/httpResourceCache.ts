import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import { recordRequestCacheEvent } from "./requestPerformance.js";

type CacheEntry<T> = {
  value: T;
  etag: string;
  lastModified: string;
  expiresAt: number;
};

const resourceCache = new Map<string, CacheEntry<unknown>>();

const buildEtag = (value: unknown) => {
  const hash = createHash("sha1")
    .update(JSON.stringify(value))
    .digest("base64url");

  return `W/"${hash}"`;
};

const isRequestFresh = (req: Request, entry: CacheEntry<unknown>) => {
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

const applyCacheHeaders = (res: Response, entry: CacheEntry<unknown>) => {
  res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
  res.setHeader("ETag", entry.etag);
  res.setHeader("Last-Modified", entry.lastModified);
};

export const setHttpResourceCache = <T>(
  key: string,
  value: T,
  ttlMs: number,
  updatedAt = new Date(),
) => {
  resourceCache.set(key, {
    value,
    etag: buildEtag(value),
    lastModified: updatedAt.toUTCString(),
    expiresAt: Date.now() + ttlMs,
  });
};

export const invalidateHttpResourceCache = (key: string) => {
  resourceCache.delete(key);
};

export const invalidateHttpResourceCacheByPrefix = (prefix: string) => {
  for (const key of resourceCache.keys()) {
    if (key.startsWith(prefix)) {
      resourceCache.delete(key);
    }
  }
};

export const serveHttpResourceCache = (
  req: Request,
  res: Response,
  key: string,
) => {
  const startedAt = Date.now();
  const entry = resourceCache.get(key);
  if (!entry) {
    recordRequestCacheEvent({
      layer: "http-resource",
      key,
      hit: false,
      durationMs: Date.now() - startedAt,
    });
    return false;
  }

  if (entry.expiresAt <= Date.now()) {
    resourceCache.delete(key);
    recordRequestCacheEvent({
      layer: "http-resource",
      key,
      hit: false,
      durationMs: Date.now() - startedAt,
    });
    return false;
  }

  applyCacheHeaders(res, entry);
  recordRequestCacheEvent({
    layer: "http-resource",
    key,
    hit: true,
    durationMs: Date.now() - startedAt,
  });

  if (isRequestFresh(req, entry)) {
    res.status(304).end();
    return true;
  }

  sendResponse(res, 200, { data: entry.value });
  return true;
};
