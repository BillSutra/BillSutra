import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

const AdminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (error, decoded) => {
    if (error || !decoded || typeof decoded === "string") {
      res.status(401).json({ status: 401, message: "Unauthorized" });
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

export default AdminAuthMiddleware;
