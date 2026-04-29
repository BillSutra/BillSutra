import type { NextFunction, Request, Response } from "express";
import { hasPaidAccess } from "../services/subscription.service.js";
import { measureRequestPhase } from "../lib/requestPerformance.js";

const RequirePaymentAccessMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 401, message: "Unauthorized" });
    return;
  }

  const allowed = await measureRequestPhase(
    "subscription.payment_access_check",
    () => hasPaidAccess(userId),
  );

  if (!allowed) {
    res.status(403).json({
      status: 403,
      message:
        "Payment access is required. Complete a verified payment to continue.",
    });
    return;
  }

  next();
};

export default RequirePaymentAccessMiddleware;
