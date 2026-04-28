import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import {
  getCookieValue,
  ACCESS_TOKEN_COOKIE_NAME,
} from "../lib/authCookies.js";
import {
  hasSupportedAccessTokenType,
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";

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
  const headerToken = normalizeToken(req.headers?.authorization);
  const queryToken = normalizeToken(req.query.token);
  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  const token = headerToken ?? queryToken ?? cookieToken ?? undefined;

  if (!token) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, async (err, decoded) => {
    if (err) {
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    if (!hasSupportedAccessTokenType(decoded)) {
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    try {
      const authUser = await resolveAuthUserFromDecoded(decoded);

      if (!authUser) {
        res.status(401).json({ status: 401, message: "Unauthorized" });
        return;
      }

      req.user = authUser;

      const latestSessionVersion = await getUserSessionVersionIfAvailable(
        authUser.ownerUserId,
      );
      if (
        latestSessionVersion !== null &&
        latestSessionVersion !== authUser.sessionVersion
      ) {
        res.status(401).json({
          status: 401,
          message: "Session expired. Please login again.",
        });
        return;
      }

      if (authUser.accountType === "OWNER" && !authUser.isEmailVerified) {
        res.status(403).json({
          status: 403,
          message: "Please verify your email to continue.",
          code: "EMAIL_VERIFICATION_REQUIRED",
        });
        return;
      }

      if (authUser.role === "WORKER") {
        res.status(403).json({
          status: 403,
          message: "Workers cannot access dashboard streams",
        });
        return;
      }

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
    }
  });
};

export default AuthSseMiddleware;
