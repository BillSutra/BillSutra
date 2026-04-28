import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { parseCookies } from "../lib/authCookies.js";
import { isAllowedCorsOrigin } from "../lib/corsOrigins.js";

export const CSRF_COOKIE_NAME = "bill_sutra_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

const isProd = process.env.NODE_ENV === "production";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/payments/access/webhooks/razorpay"]);
const AUTH_COOKIE_NAMES = new Set([
  "bill_sutra_access_token",
  "accessToken",
  "bill_sutra_refresh_token",
  "refreshToken",
  "bill_sutra_admin_session",
]);

const createCsrfToken = () => crypto.randomBytes(24).toString("base64url");

const getOriginFromRequest = (req: Request) => {
  const originHeader = req.headers.origin;
  if (typeof originHeader === "string" && originHeader.trim()) {
    return originHeader.trim();
  }

  const refererHeader = req.headers.referer;
  if (typeof refererHeader === "string" && refererHeader.trim()) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
};

const hasProtectedSessionCookie = (req: Request) => {
  const cookies = parseCookies(req.headers.cookie);

  for (const cookieName of AUTH_COOKIE_NAMES) {
    if (cookies.get(cookieName)) {
      return true;
    }
  }

  return false;
};

const setCsrfCookie = (res: Response, token: string) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: "strict",
    path: "/",
  });
};

const getHeaderToken = (req: Request) => {
  const rawHeader = req.headers[CSRF_HEADER_NAME];
  if (typeof rawHeader === "string") {
    return rawHeader.trim();
  }

  if (Array.isArray(rawHeader)) {
    return rawHeader[0]?.trim() ?? "";
  }

  return "";
};

const tokensMatch = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const ensureCsrfCookie = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const existing = parseCookies(req.headers.cookie).get(CSRF_COOKIE_NAME);
  if (!existing || existing.length < 24) {
    setCsrfCookie(res, createCsrfToken());
  }

  next();
};

const csrfProtectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const requestOrigin = getOriginFromRequest(req);
  if (requestOrigin && !isAllowedCorsOrigin(requestOrigin)) {
    res.status(403).json({
      status: 403,
      message: "Origin not allowed",
      code: "CSRF_ORIGIN_REJECTED",
    });
    return;
  }

  if (!hasProtectedSessionCookie(req)) {
    next();
    return;
  }

  const cookieToken = parseCookies(req.headers.cookie).get(CSRF_COOKIE_NAME) ?? "";
  const headerToken = getHeaderToken(req);

  if (cookieToken.length < 24) {
    setCsrfCookie(res, createCsrfToken());
    next();
    return;
  }

  if (
    headerToken.length < 24 ||
    !tokensMatch(cookieToken, headerToken)
  ) {
    res.status(403).json({
      status: 403,
      message: "CSRF validation failed",
      code: "CSRF_VALIDATION_FAILED",
    });
    return;
  }

  next();
};

export default csrfProtectionMiddleware;
