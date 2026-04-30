import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  cancelCurrentSubscription,
  getUserPermissions,
  getSubscriptionSnapshot,
  switchToFreePlan,
} from "../services/subscription.service.js";
import { respondWithRedisCachedData } from "../lib/redisResourceCache.js";
import {
  buildSubscriptionPermissionsCachePrefix,
  buildSubscriptionPermissionsRedisKey,
} from "../redis/cacheKeys.js";

const SUBSCRIPTION_PERMISSIONS_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.SUBSCRIPTION_PERMISSIONS_CACHE_TTL_SECONDS ?? 300),
  15,
);
const SUBSCRIPTION_PERMISSIONS_CACHE_SWR_SECONDS = Math.max(
  Number(process.env.SUBSCRIPTION_PERMISSIONS_CACHE_SWR_SECONDS ?? 60),
  0,
);

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

  static async permissions(req: Request, res: Response) {
    const businessId = req.user?.businessId?.trim();
    if (!businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    return respondWithRedisCachedData({
      req,
      res,
      key: buildSubscriptionPermissionsRedisKey(businessId),
      label: "subscription-permissions",
      ttlSeconds: SUBSCRIPTION_PERMISSIONS_CACHE_TTL_SECONDS,
      staleWhileRevalidateSeconds: SUBSCRIPTION_PERMISSIONS_CACHE_SWR_SECONDS,
      invalidationPrefixes: [buildSubscriptionPermissionsCachePrefix(businessId)],
      resolver: () => getUserPermissions(businessId),
    });
  }
}

export default SubscriptionController;
