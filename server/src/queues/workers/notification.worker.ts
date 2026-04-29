import { createNotification } from "../../services/notification.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const notificationJobHandlers: Pick<
  AppQueueJobHandlerMap,
  "createNotification"
> = {
  createNotification: async (job) =>
    createNotification({
      userId: job.data.context.userId as number,
      businessId: job.data.payload.businessId,
      type: job.data.payload.type,
      title: job.data.payload.title,
      message: job.data.payload.message,
      actionUrl: job.data.payload.actionUrl,
      priority: job.data.payload.priority ?? undefined,
      referenceKey: job.data.payload.referenceKey,
    }),
};
