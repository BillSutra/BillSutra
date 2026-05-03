import { createRedisRateLimiter } from "../redis/rateLimiter.js";

export const apiRateLimiter = createRedisRateLimiter({
  keyPrefix: "api",
  windowMs: 60 * 1000,
  limit: 240,
  message: {
    success: false,
    message: "Too many API requests. Please slow down and try again.",
  },
});

export const authRateLimiter = createRedisRateLimiter({
  keyPrefix: "auth",
  windowMs: 15 * 60 * 1000,
  limit: 100,
  message: {
    success: false,
    message: "Too many requests, please try again after 15 minutes.",
  },
});

export const loginRateLimiter = createRedisRateLimiter({
  keyPrefix: "auth-login",
  windowMs: 15 * 60 * 1000,
  limit: 25,
  message: {
    success: false,
    message: "Too many login attempts. Please try again after 15 minutes.",
  },
});

export const otpResendRateLimiter = createRedisRateLimiter({
  keyPrefix: "otp-resend",
  windowMs: 10 * 60 * 1000,
  limit: 8,
  message: {
    success: false,
    message: "Too many OTP resend attempts. Please wait before trying again.",
  },
});

export const passwordResetRequestRateLimiter = createRedisRateLimiter({
  keyPrefix: "password-reset-request",
  windowMs: 15 * 60 * 1000,
  limit: 6,
  message: {
    success: false,
    message: "Too many password reset requests. Please try again after 15 minutes.",
  },
});

export const passwordResetAttemptRateLimiter = createRedisRateLimiter({
  keyPrefix: "password-reset-attempt",
  windowMs: 15 * 60 * 1000,
  limit: 12,
  message: {
    success: false,
    message: "Too many password reset attempts. Please try again after 15 minutes.",
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

export const faceAuthRateLimiter = createRedisRateLimiter({
  keyPrefix: "face-auth",
  windowMs: 10 * 60 * 1000,
  limit: 15,
  message: {
    success: false,
    message: "Too many face verification attempts. Please wait a few minutes and try again.",
  },
});

export const uploadRateLimiter = createRedisRateLimiter({
  keyPrefix: "uploads",
  windowMs: 10 * 60 * 1000,
  limit: 30,
  message: {
    success: false,
    message: "Too many upload attempts. Please wait a few minutes and try again.",
  },
});

export const exportRateLimiter = createRedisRateLimiter({
  keyPrefix: "exports",
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: {
    success: false,
    message: "Too many export requests. Please wait a few minutes and try again.",
  },
});

export const assistantRateLimiter = createRedisRateLimiter({
  keyPrefix: "assistant",
  windowMs: 5 * 60 * 1000,
  limit: 40,
  message: {
    success: false,
    message: "Too many assistant requests. Please slow down and try again.",
  },
});
