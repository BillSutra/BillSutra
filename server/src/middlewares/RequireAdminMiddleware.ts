import type { NextFunction, Request, Response } from "express";

const RequireAdminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  if (req.user.accountType !== "OWNER" || req.user.role !== "ADMIN") {
    res.status(403).json({ status: 403, message: "Admin access required" });
    return;
  }

  next();
};

export default RequireAdminMiddleware;
