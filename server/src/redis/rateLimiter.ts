import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import {
  getRedisClient,
  isRedisRateLimitEnabled,
} from "./redisClient.js";

type RedisRateLimiterOptions = {
  keyPrefix: string;
  windowMs: number;
  limit: number;
  message: {
    success: boolean;
    message: string;
  };
};

export const createRedisRateLimiter = (
  options: RedisRateLimiterOptions,
): RequestHandler => {
  const fallbackLimiter = rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: options.message,
  });

  return async (req, res, next) => {
    if (!isRedisRateLimitEnabled()) {
      return fallbackLimiter(req, res, next);
    }

    const client = await getRedisClient();
    if (!client) {
      return fallbackLimiter(req, res, next);
    }

    const identity =
      typeof req.user?.id === "number"
        ? `user:${req.user.id}`
        : `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const key = `rate-limit:${options.keyPrefix}:${identity}`;

    try {
      const current = await client.incr(key);
      if (current === 1) {
        await client.pexpire(key, options.windowMs);
      }

      const ttlMs = await client.pttl(key);
      res.setHeader("RateLimit-Limit", String(options.limit));
      res.setHeader(
        "RateLimit-Remaining",
        String(Math.max(0, options.limit - current)),
      );

      if (ttlMs > 0) {
        res.setHeader(
          "RateLimit-Reset",
          String(Math.ceil((Date.now() + ttlMs) / 1000)),
        );
      }

      if (current > options.limit) {
        if (ttlMs > 0) {
          res.setHeader("Retry-After", String(Math.ceil(ttlMs / 1000)));
        }

        return res.status(429).json(options.message);
      }

      return next();
    } catch (error) {
      console.warn("[redis.rate-limit] fallback to memory limiter", {
        keyPrefix: options.keyPrefix,
        message: error instanceof Error ? error.message : String(error),
      });
      return fallbackLimiter(req, res, next);
    }
  };
};
