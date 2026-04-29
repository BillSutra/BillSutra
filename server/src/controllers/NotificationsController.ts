import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  countUnreadNotifications,
  deleteNotification,
  invalidateNotificationCaches,
  listNotifications,
  markAllNotificationsAsRead,
  serializeNotification,
  syncNotificationsIfStale,
  updateNotificationReadState,
} from "../services/notification.service.js";
import type { AppNotificationType } from "../services/notification.service.js";
import { measureRequestPhase } from "../lib/requestPerformance.js";
import { respondWithRedisCachedData } from "../lib/redisResourceCache.js";
import {
  buildNotificationsCachePrefix,
  buildNotificationsRedisKey,
} from "../redis/cacheKeys.js";

const notificationTypes = new Set<AppNotificationType>([
  "payment",
  "inventory",
  "customer",
  "subscription",
  "worker",
]);

const NOTIFICATIONS_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.NOTIFICATIONS_CACHE_TTL_SECONDS ?? 30),
  10,
);
const NOTIFICATIONS_CACHE_SWR_SECONDS = Math.max(
  Number(process.env.NOTIFICATIONS_CACHE_SWR_SECONDS ?? 30),
  0,
);

class NotificationsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();

    if (!userId || !businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const limitRaw =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
    const pageRaw =
      typeof req.query.page === "string" ? Number(req.query.page) : 1;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 10;
    const page = Number.isFinite(pageRaw) ? pageRaw : 1;
    const rawType =
      typeof req.query.type === "string" ? req.query.type.trim().toLowerCase() : "";
    const type = notificationTypes.has(rawType as AppNotificationType)
      ? (rawType as AppNotificationType)
      : null;
    const isRead =
      typeof req.query.isRead === "string"
        ? req.query.isRead.trim().toLowerCase() === "true"
        : typeof req.query.unreadOnly === "string"
          ? req.query.unreadOnly.trim().toLowerCase() === "true"
            ? false
            : null
          : null;

    return respondWithRedisCachedData({
      req,
      res,
      key: buildNotificationsRedisKey({
        businessId,
        userId,
        page,
        limit,
        type,
        isRead,
      }),
      label: "notifications",
      ttlSeconds: NOTIFICATIONS_CACHE_TTL_SECONDS,
      staleWhileRevalidateSeconds: NOTIFICATIONS_CACHE_SWR_SECONDS,
      invalidationPrefixes: [
        buildNotificationsCachePrefix({ businessId, userId }),
      ],
      resolver: async () => {
        const syncPromise = syncNotificationsIfStale({ userId, businessId });

        let [notificationResult, unreadCount] = await measureRequestPhase(
          "notifications.db.index",
          () =>
            Promise.all([
              listNotifications({
                userId,
                page,
                limit,
                type,
                isRead,
              }),
              countUnreadNotifications(userId),
            ]),
        );

        if (notificationResult.notifications.length === 0 && unreadCount === 0) {
          await syncPromise;
          [notificationResult, unreadCount] = await measureRequestPhase(
            "notifications.db.resync",
            () =>
              Promise.all([
                listNotifications({
                  userId,
                  page,
                  limit,
                  type,
                  isRead,
                }),
                countUnreadNotifications(userId),
              ]),
          );
        }

        return measureRequestPhase("notifications.serialize.index", async () => ({
          notifications: notificationResult.notifications.map(serializeNotification),
          unreadCount,
          total: notificationResult.total,
          page: notificationResult.page,
          limit: notificationResult.limit,
        }));
      },
    });
  }

  static async markRead(req: Request, res: Response) {
    const userId = req.user?.id;
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!id) {
      return sendResponse(res, 422, { message: "Notification id is required" });
    }

    const isRead =
      typeof req.body?.isRead === "boolean" ? req.body.isRead : true;
    const updated = await updateNotificationReadState(userId, id, isRead);

    if (!updated) {
      return sendResponse(res, 404, { message: "Notification not found" });
    }
    void invalidateNotificationCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, {
      message: isRead
        ? "Notification marked as read"
        : "Notification marked as unread",
      data: serializeNotification(updated),
    });
  }

  static async markAllRead(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    await markAllNotificationsAsRead(userId);
    void invalidateNotificationCaches(req.user?.businessId?.trim(), userId);
    return sendResponse(res, 200, { message: "All notifications marked as read" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";

    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!id) {
      return sendResponse(res, 422, { message: "Notification id is required" });
    }

    const deleted = await deleteNotification(userId, id);
    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Notification not found" });
    }
    void invalidateNotificationCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, { message: "Notification deleted" });
  }
}

export default NotificationsController;
