import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { parseCookies } from "../lib/authCookies.js";
import { getAccessTokenSecret } from "../lib/authSecrets.js";

const ADMIN_AUTH_COOKIE_NAME = "bill_sutra_admin_session";

const getAdminTokenFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;
  const headerToken =
    typeof authHeader === "string" &&
    authHeader.trim().toLowerCase().startsWith("bearer ")
      ? authHeader.trim().slice("bearer ".length).trim()
      : null;

  const cookieToken =
    parseCookies(req.headers.cookie).get(ADMIN_AUTH_COOKIE_NAME) ?? null;

  return {
    headerToken,
    cookieToken,
  };
};

const verifyAdminToken = (
  token: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  jwt.verify(token, getAccessTokenSecret(), (error, decoded) => {
    if (error || !decoded || typeof decoded === "string") {
      res.status(401).json({
        status: 401,
        message:
          error instanceof jwt.TokenExpiredError
            ? "Session expired. Please login again."
            : "Unauthorized",
      });
      return;
    }

    const payload = decoded as Record<string, unknown>;
    const adminId =
      typeof payload.adminId === "string" ? payload.adminId.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim() : "";
    const role =
      payload.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : undefined;

    if (!adminId || !email || role !== "SUPER_ADMIN") {
      res.status(403).json({ status: 403, message: "Super admin access required" });
      return;
    }

    req.admin = {
      adminId,
      email,
      role,
    };

    next();
  });
};

const AdminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { headerToken, cookieToken } = getAdminTokenFromRequest(req);

  if (cookieToken) {
    verifyAdminToken(cookieToken, req, res, next);
    return;
  }

  if (headerToken) {
    verifyAdminToken(headerToken, req, res, next);
    return;
  }

  res.status(401).json({ status: 401, message: "Unauthorized" });
};

export default AdminAuthMiddleware;
