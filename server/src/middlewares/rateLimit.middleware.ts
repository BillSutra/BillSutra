import { createRedisRateLimiter } from "../redis/rateLimiter.js";

export const authRateLimiter = createRedisRateLimiter({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: {
    success: false,
    message: "Too many requests, please try again after 15 minutes.",
  },
});

export const paymentRateLimiter = createRedisRateLimiter({
  keyPrefix: "payments",
  windowMs: 10 * 60 * 1000,
  limit: 25,
  message: {
    success: false,
    message: "Too many payment requests, please wait a few minutes and try again.",
  },
});

export const adminPaymentRateLimiter = createRedisRateLimiter({
  keyPrefix: "admin-payments",
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: {
    success: false,
    message: "Too many admin payment actions, please try again shortly.",
  },
});
