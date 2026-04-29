import jwt from "jsonwebtoken";
import { performance } from "node:perf_hooks";
import type { Request, Response, NextFunction } from "express";
import {
  logResolvedTokenSource,
  resolveAccessTokenFromRequest,
} from "../lib/authCookies.js";
import { getAccessTokenSecret } from "../lib/authSecrets.js";
import {
  hasSupportedAccessTokenType,
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import { setObservabilityUser } from "../lib/observability.js";
import { recordRequestAuthSummary } from "../lib/requestPerformance.js";

const workerAllowedRoutes = [
  { prefix: "/sales" },
  { prefix: "/invoices" },
  { prefix: "/worker" },
  { prefix: "/customers", methods: ["GET", "POST"] },
  { prefix: "/clients", methods: ["GET", "POST"] },
  { prefix: "/products", methods: ["GET"] },
  { prefix: "/warehouses", methods: ["GET"] },
  { prefix: "/business-profile", methods: ["GET"] },
  { prefix: "/users/me", methods: ["GET"] },
  { prefix: "/users/password", methods: ["PUT"] },
];

const unverifiedAllowedRoutes = [
  { prefix: "/users/me", methods: ["GET"] },
  { prefix: "/users/password", methods: ["PUT"] },
  { prefix: "/auth/resend-verification", methods: ["POST"] },
];

const isWorkerRequestAllowed = (path: string, method: string) =>
  workerAllowedRoutes.some((route) => {
    if (!(path === route.prefix || path.startsWith(`${route.prefix}/`))) {
      return false;
    }

    if (!route.methods) return true;
    return route.methods.includes(method.toUpperCase());
  });

const isUnverifiedRequestAllowed = (path: string, method: string) =>
  unverifiedAllowedRoutes.some((route) => {
    if (!(path === route.prefix || path.startsWith(`${route.prefix}/`))) {
      return false;
    }

    if (!route.methods) return true;
    return route.methods.includes(method.toUpperCase());
  });

const unauthorized = (res: Response) => {
  res.status(401).json({ status: 401, message: "Unauthorized" });
};

const authServiceUnavailable = (res: Response) => {
  res.status(503).json({
    status: 503,
    message: "Authentication service temporarily unavailable",
    code: "AUTH_SERVICE_UNAVAILABLE",
  });
};

const verifyResolvedToken = async (
  token: string,
  source: "header" | "cookie",
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const startedAt = performance.now();
  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, getAccessTokenSecret());
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 401,
        message: "Session expired. Please login again.",
      });
      recordRequestAuthSummary({
        source,
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      return true;
    }

    return false;
  }

  if (!hasSupportedAccessTokenType(decoded)) {
    recordRequestAuthSummary({
      source,
      durationMs: performance.now() - startedAt,
      outcome: "rejected",
    });
    return false;
  }

  try {
    const authUser = await resolveAuthUserFromDecoded(decoded);

    if (!authUser) {
      recordRequestAuthSummary({
        source,
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      return false;
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
      res.status(401).json({
        status: 401,
        message: "Session expired. Please login again.",
      });
      recordRequestAuthSummary({
        source,
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      return true;
    }

    setObservabilityUser(authUser);
    logResolvedTokenSource(source, {
      path: req.path,
      accountType: authUser.accountType,
      role: authUser.role,
    });

    if (
      authUser.accountType === "OWNER" &&
      !authUser.isEmailVerified &&
      !isUnverifiedRequestAllowed(req.path, req.method)
    ) {
      res.status(403).json({
        status: 403,
        message: "Please verify your email to continue.",
        code: "EMAIL_VERIFICATION_REQUIRED",
      });
      recordRequestAuthSummary({
        source,
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      return true;
    }

    if (
      authUser.role === "WORKER" &&
      !isWorkerRequestAllowed(req.path, req.method)
    ) {
      res.status(403).json({
        status: 403,
        message: "Workers can only access sales and invoices",
      });
      recordRequestAuthSummary({
        source,
        durationMs: performance.now() - startedAt,
        outcome: "rejected",
      });
      return true;
    }

    recordRequestAuthSummary({
      source,
      durationMs: performance.now() - startedAt,
      outcome: "granted",
    });
    next();
    return true;
  } catch (error) {
    console.warn("[auth] request_verification_failed", {
      path: req.path,
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    recordRequestAuthSummary({
      source,
      durationMs: performance.now() - startedAt,
      outcome: "service_unavailable",
    });
    authServiceUnavailable(res);
    return true;
  }
};

const AuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authStartedAt = performance.now();

  try {
    const { headerToken, cookieToken } = resolveAccessTokenFromRequest(req);

    if (!headerToken && !cookieToken) {
      logResolvedTokenSource("none", { path: req.path });
      recordRequestAuthSummary({
        source: "none",
        durationMs: performance.now() - authStartedAt,
        outcome: "rejected",
      });
      unauthorized(res);
      return;
    }

    if (headerToken) {
      const accepted = await verifyResolvedToken(
        headerToken,
        "header",
        req,
        res,
        next,
      );

      if (accepted) {
        return;
      }
    }

    if (cookieToken) {
      const accepted = await verifyResolvedToken(
        cookieToken,
        "cookie",
        req,
        res,
        next,
      );

      if (accepted) {
        return;
      }
    }

    unauthorized(res);
  } catch (error) {
    console.warn("[auth] middleware_failed", {
      path: req.path,
      message: error instanceof Error ? error.message : String(error),
    });
    recordRequestAuthSummary({
      source: "none",
      durationMs: performance.now() - authStartedAt,
      outcome: "service_unavailable",
    });
    authServiceUnavailable(res);
  }
};

export default AuthMiddleware;
