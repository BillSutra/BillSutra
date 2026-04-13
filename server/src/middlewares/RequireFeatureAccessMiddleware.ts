import type { NextFunction, Request, Response } from "express";
import {
  checkFeatureAccess,
  type FeatureAccessResult,
} from "../services/subscription.service.js";
import type { SubscriptionFeatureKey } from "../config/subscriptionPlans.js";

const sendFeatureError = (res: Response, result: FeatureAccessResult) => {
  res.status(402).json({
    status: 402,
    code: result.code,
    message: result.message,
    feature: result.feature,
    requiredPlan: result.requiredPlan,
    currentPlan: result.snapshot.planId,
    usage: result.snapshot.usage,
    limits: result.snapshot.limits,
  });
};

const RequireFeatureAccessMiddleware = (feature: SubscriptionFeatureKey) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ status: 401, message: "Unauthorized" });
      return;
    }

    const result = await checkFeatureAccess(userId, feature);
    if (!result.allowed) {
      sendFeatureError(res, result);
      return;
    }

    next();
  };
};

export default RequireFeatureAccessMiddleware;
