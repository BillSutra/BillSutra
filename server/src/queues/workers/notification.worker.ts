import { createNotification } from "../../services/notification.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const notificationJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  "createNotification"
> = {
  createNotification: async (job) =>
    createNotification({
      userId: job.data.userId,
      businessId: job.data.businessId,
      type: job.data.type,
      message: job.data.message,
      referenceKey: job.data.referenceKey,
    }),
};
