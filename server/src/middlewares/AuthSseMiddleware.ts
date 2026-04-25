import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import {
  getCookieValue,
  ACCESS_TOKEN_COOKIE_NAME,
} from "../lib/authCookies.js";
import { resolveAuthUserFromDecoded } from "../lib/authSession.js";

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

    try {
      const authUser = await resolveAuthUserFromDecoded(decoded);

      if (!authUser) {
        res.status(401).json({ status: 401, message: "Unauthorized" });
        return;
      }

      req.user = authUser;

      if (authUser.role === "WORKER") {
        res.status(403).json({
          status: 403,
          message: "Workers cannot access dashboard streams",
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({ status: 401, message: "Unauthorized" });
    }
  });
};

export default AuthSseMiddleware;
