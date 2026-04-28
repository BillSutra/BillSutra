import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import {
  countUnreadNotifications,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  serializeNotification,
  syncNotificationsIfStale,
} from "../services/notification.service.js";

class NotificationsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();

    if (!userId || !businessId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const limitRaw =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 10;

    void syncNotificationsIfStale({ userId, businessId });

    const [notifications, unreadCount] = await Promise.all([
      listNotifications(userId, limit),
      countUnreadNotifications(userId),
    ]);

    return sendResponse(res, 200, {
      data: {
        notifications: notifications.map(serializeNotification),
        unreadCount,
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

    const updated = await markNotificationAsRead(userId, id);

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Notification not found" });
    }

    return sendResponse(res, 200, { message: "Notification marked as read" });
  }

  static async markAllRead(req: Request, res: Response) {
    const userId = req.user?.id;

    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    await markAllNotificationsAsRead(userId);
    return sendResponse(res, 200, { message: "All notifications marked as read" });
  }
}

export default NotificationsController;
