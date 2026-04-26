import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import {
  logResolvedTokenSource,
  resolveAccessTokenFromRequest,
} from "../lib/authCookies.js";
import {
  getUserSessionVersionIfAvailable,
  resolveAuthUserFromDecoded,
} from "../lib/authSession.js";
import { setObservabilityUser } from "../lib/observability.js";

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

const verifyResolvedToken = async (
  token: string,
  source: "header" | "cookie",
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 401,
        message: "Session expired. Please login again.",
      });
      return true;
    }

    return false;
  }

  try {
    const authUser = await resolveAuthUserFromDecoded(decoded);

    if (!authUser) {
      return false;
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
      return true;
    }

    next();
    return true;
  } catch {
    return false;
  }
};

const AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const { headerToken, cookieToken } = resolveAccessTokenFromRequest(req);

  if (!headerToken && !cookieToken) {
    logResolvedTokenSource("none", { path: req.path });
    unauthorized(res);
    return;
  }

  void (async () => {
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
  })();
};

export default AuthMiddleware;
