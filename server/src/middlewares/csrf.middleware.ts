import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { parseCookies } from "../lib/authCookies.js";
import { isAllowedCorsOrigin } from "../lib/corsOrigins.js";
import {
  CSRF_TOKEN_MIN_LENGTH,
  hasValidCsrfToken,
  readCsrfCookieToken,
  readCsrfHeaderToken,
  resolveOrSetCsrfToken,
} from "../lib/csrf.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/payments/access/webhooks/razorpay"]);
const SESSIONLESS_PUBLIC_PATHS = new Set([
  "/api/auth/signup",
  "/api/auth/login",
  "/api/auth/logincheck",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-otp",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/worker/login",
  "/api/auth/otp/send",
  "/api/auth/otp/verify",
  "/api/auth/passkeys/authenticate/options",
  "/api/auth/passkeys/authenticate/verify",
  "/api/auth/session/bootstrap",
  "/api/auth/csrf",
]);
const OWNER_AUTH_COOKIE_NAMES = new Set([
  "bill_sutra_access_token",
  "accessToken",
  "bill_sutra_refresh_token",
  "refreshToken",
]);
const ADMIN_AUTH_COOKIE_NAMES = new Set(["bill_sutra_admin_session"]);
const csrfDiagnosticsEnabled =
  process.env.AUTH_DIAGNOSTICS_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" &&
    process.env.AUTH_DIAGNOSTICS_ENABLED !== "false");

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

const logCsrfDiagnostic = (
  event: string,
  detail?: Record<string, unknown>,
  level: "info" | "warn" = "info",
) => {
  if (!csrfDiagnosticsEnabled) {
    return;
  }

  const logger = level === "warn" ? console.warn : console.info;
  logger(`[csrf] ${event}`, detail ?? {});
};

const getProtectionScope = (req: Request) => {
  if (CSRF_EXEMPT_PATHS.has(req.path) || SESSIONLESS_PUBLIC_PATHS.has(req.path)) {
    return "none" as const;
  }

  if (req.path.startsWith("/api/admin")) {
    return "admin" as const;
  }

  return "owner" as const;
};

const hasProtectedSessionCookie = (
  req: Request,
  cookieNames: ReadonlySet<string>,
) => {
  const cookies = parseCookies(req.headers.cookie);

  for (const cookieName of cookieNames) {
    if (cookies.get(cookieName)) {
      return true;
    }
  }

  return false;
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
  resolveOrSetCsrfToken(req, res);
  next();
};

const csrfProtectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const protectionScope = getProtectionScope(req);
  const ownerSessionCookiePresent = hasProtectedSessionCookie(
    req,
    OWNER_AUTH_COOKIE_NAMES,
  );
  const adminSessionCookiePresent = hasProtectedSessionCookie(
    req,
    ADMIN_AUTH_COOKIE_NAMES,
  );
  const cookieToken = readCsrfCookieToken(req);
  const headerToken = readCsrfHeaderToken(req);
  const requestOrigin = getOriginFromRequest(req);

  logCsrfDiagnostic("middleware_entered", {
    method: req.method,
    path: req.path,
    protectionScope,
    origin: requestOrigin,
    hasOwnerSessionCookie: ownerSessionCookiePresent,
    hasAdminSessionCookie: adminSessionCookiePresent,
    hasCsrfCookie: hasValidCsrfToken(cookieToken),
    hasCsrfHeader: hasValidCsrfToken(headerToken),
  });

  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    logCsrfDiagnostic("skipped_safe_method", {
      method: req.method,
      path: req.path,
    });
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    logCsrfDiagnostic("skipped_exempt_path", {
      method: req.method,
      path: req.path,
    });
    next();
    return;
  }

  if (requestOrigin && !isAllowedCorsOrigin(requestOrigin)) {
    logCsrfDiagnostic(
      "rejected_origin",
      {
        method: req.method,
        path: req.path,
        origin: requestOrigin,
      },
      "warn",
    );
    res.status(403).json({
      status: 403,
      message: "Origin not allowed",
      code: "CSRF_ORIGIN_REJECTED",
    });
    return;
  }

  logCsrfDiagnostic("origin_validated", {
    method: req.method,
    path: req.path,
    origin: requestOrigin,
  });

  if (protectionScope === "none") {
    logCsrfDiagnostic("skipped_sessionless_route", {
      method: req.method,
      path: req.path,
    });
    next();
    return;
  }

  const relevantSessionCookiePresent =
    protectionScope === "admin"
      ? adminSessionCookiePresent
      : ownerSessionCookiePresent;

  if (!relevantSessionCookiePresent) {
    logCsrfDiagnostic("skipped_no_relevant_session_cookie", {
      method: req.method,
      path: req.path,
      protectionScope,
    });
    next();
    return;
  }

  if (!hasValidCsrfToken(cookieToken)) {
    resolveOrSetCsrfToken(req, res);
    logCsrfDiagnostic(
      "rejected_missing_cookie_token",
      {
        method: req.method,
        path: req.path,
        protectionScope,
      },
      "warn",
    );
    res.status(403).json({
      status: 403,
      message: "CSRF validation failed",
      code: "CSRF_TOKEN_ISSUED_RETRY_REQUIRED",
    });
    return;
  }

  if (
    !hasValidCsrfToken(headerToken) ||
    cookieToken.length < CSRF_TOKEN_MIN_LENGTH ||
    !tokensMatch(cookieToken, headerToken)
  ) {
    logCsrfDiagnostic(
      "rejected_header_mismatch",
      {
        method: req.method,
        path: req.path,
        protectionScope,
        headerLength: headerToken.length,
        cookieLength: cookieToken.length,
      },
      "warn",
    );
    res.status(403).json({
      status: 403,
      message: "CSRF validation failed",
      code: "CSRF_VALIDATION_FAILED",
    });
    return;
  }

  logCsrfDiagnostic("validated", {
    method: req.method,
    path: req.path,
    protectionScope,
  });
  next();
};

export default csrfProtectionMiddleware;
