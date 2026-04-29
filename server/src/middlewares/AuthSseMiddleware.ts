import jwt from "jsonwebtoken";
import { performance } from "node:perf_hooks";
import type { Request, Response, NextFunction } from "express";
import {
  getCookieValue,
  ACCESS_TOKEN_COOKIE_NAME,
} from "../lib/authCookies.js";
import { getAccessTokenSecret } from "../lib/authSecrets.js";
import {
  hasSupportedAccessTokenType,
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import { recordRequestAuthSummary } from "../lib/requestPerformance.js";

const normalizeToken = (raw?: unknown) => {
  if (!raw) return null;
  const token = Array.isArray(raw) ? raw[0] : raw;
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice("bearer ".length).trim();
  }
  return trimmed;
};

const AuthSseMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const startedAt = performance.now();
  const headerToken = normalizeToken(req.headers?.authorization);
  const queryToken = normalizeToken(req.query.token);
  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  const token = headerToken ?? queryToken ?? cookieToken ?? undefined;

  if (!token) {
    recordRequestAuthSummary({
      source: "none",
      durationMs: performance.now() - startedAt,
      outcome: "rejected",
    });
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  jwt.verify(token, getAccessTokenSecret(), async (err, decoded) => {
    if (err) {
      recordRequestAuthSummary({
        source: headerToken ? "header" : queryToken ? "query" : "cookie",
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    if (!hasSupportedAccessTokenType(decoded)) {
      recordRequestAuthSummary({
        source: headerToken ? "header" : queryToken ? "query" : "cookie",
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    try {
      const authUser = await resolveAuthUserFromDecoded(decoded);

      if (!authUser) {
        recordRequestAuthSummary({
          source: headerToken ? "header" : queryToken ? "query" : "cookie",
          durationMs: performance.now() - startedAt,
          outcome: "rejected",
        });
        res.status(401).json({ status: 401, message: "Unauthorized" });
        return;
      }

      req.user = authUser;

      const latestSessionVersion =
        typeof authUser.latestSessionVersion === "number"
          ? authUser.latestSessionVersion
          : await getUserSessionVersionIfAvailable(authUser.ownerUserId);
      if (
        latestSessionVersion !== null &&
        latestSessionVersion !== authUser.sessionVersion
      ) {
        recordRequestAuthSummary({
          source: headerToken ? "header" : queryToken ? "query" : "cookie",
          durationMs: performance.now() - startedAt,
          outcome: "rejected",
        });
        res.status(401).json({
          status: 401,
          message: "Session expired. Please login again.",
        });
        return;
      }

      if (authUser.accountType === "OWNER" && !authUser.isEmailVerified) {
        recordRequestAuthSummary({
          source: headerToken ? "header" : queryToken ? "query" : "cookie",
          durationMs: performance.now() - startedAt,
          outcome: "rejected",
        });
        res.status(403).json({
          status: 403,
          message: "Please verify your email to continue.",
          code: "EMAIL_VERIFICATION_REQUIRED",
        });
        return;
      }

      if (authUser.role === "WORKER") {
        recordRequestAuthSummary({
          source: headerToken ? "header" : queryToken ? "query" : "cookie",
          durationMs: performance.now() - startedAt,
          outcome: "rejected",
        });
        res.status(403).json({
          status: 403,
          message: "Workers cannot access dashboard streams",
        });
        return;
      }

      recordRequestAuthSummary({
        source: headerToken ? "header" : queryToken ? "query" : "cookie",
        durationMs: performance.now() - startedAt,
        outcome: "granted",
      });
      next();
    } catch (error) {
      console.warn("[auth] sse_verification_failed", {
        path: req.path,
        message: error instanceof Error ? error.message : String(error),
      });
      res.status(503).json({
        status: 503,
        message: "Authentication service temporarily unavailable",
        code: "AUTH_SERVICE_UNAVAILABLE",
      });
      recordRequestAuthSummary({
        source: headerToken ? "header" : queryToken ? "query" : "cookie",
        durationMs: performance.now() - startedAt,
        outcome: "service_unavailable",
      });
    }
  });
};

export default AuthSseMiddleware;
