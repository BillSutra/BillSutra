import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  cancelCurrentSubscription,
  getSubscriptionSnapshot,
  switchToFreePlan,
} from "../services/subscription.service.js";

class SubscriptionController {
  static async me(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const data = await getSubscriptionSnapshot(userId);
    return sendResponse(res, 200, { data });
  }

  static async cancel(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    await cancelCurrentSubscription(userId);
    const data = await getSubscriptionSnapshot(userId);
    return sendResponse(res, 200, {
      message: "Subscription cancelled",
      data,
    });
  }

  static async switchToFree(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    await switchToFreePlan(userId);
    const data = await getSubscriptionSnapshot(userId);
    return sendResponse(res, 200, {
      message: "Plan switched to Free",
      data,
    });
  }
}

export default SubscriptionController;
