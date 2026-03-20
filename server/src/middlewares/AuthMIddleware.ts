import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { resolveAuthUserFromDecoded } from "../lib/authSession.js";

const workerAllowedRoutes = [
  { prefix: "/sales" },
  { prefix: "/invoices" },
  { prefix: "/customers", methods: ["GET", "POST"] },
  { prefix: "/clients", methods: ["GET", "POST"] },
  { prefix: "/products", methods: ["GET"] },
  { prefix: "/warehouses", methods: ["GET"] },
  { prefix: "/business-profile", methods: ["GET"] },
  { prefix: "/users/me", methods: ["GET"] },
  { prefix: "/users/password", methods: ["PUT"] },
];

const isWorkerRequestAllowed = (path: string, method: string) =>
  workerAllowedRoutes.some((route) => {
    if (!(path === route.prefix || path.startsWith(`${route.prefix}/`))) {
      return false;
    }

    if (!route.methods) return true;
    return route.methods.includes(method.toUpperCase());
  });

const AuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers?.authorization;

  if (!authHeader) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

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

      if (
        authUser.role === "WORKER" &&
        !isWorkerRequestAllowed(req.path, req.method)
      ) {
        res.status(403).json({
          status: 403,
          message: "Workers can only access sales and invoices",
        });
        return;
      }

      next();
    } catch {
      res.status(401).json({ status: 401, message: "Unauthorized" });
    }
  });
};

export default AuthMiddleware;
