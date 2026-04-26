import { createHash } from "node:crypto";
import type { AppNotificationType } from "../../services/notification.service.js";
import { enqueueDefaultJob } from "../queue.js";

const hashValue = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 16);

export const enqueueNotificationCreation = async (params: {
  userId: number;
  businessId: string;
  type: AppNotificationType;
  message: string;
  referenceKey?: string | null;
}) => {
  const dedupeSource =
    params.referenceKey?.trim() ||
    `${params.userId}:${params.businessId}:${params.type}:${params.message}`;

  return enqueueDefaultJob({
    jobName: "createNotification",
    data: params,
    jobId: `notification:${params.businessId}:${hashValue(dedupeSource)}`,
  });
};
