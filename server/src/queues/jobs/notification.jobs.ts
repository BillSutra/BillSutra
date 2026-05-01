import { createHash } from "node:crypto";
import type { AppNotificationType } from "../../services/notification.service.js";
import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

const hashValue = (value: string) =>
  createHash("sha1").update(value).digest("hex").slice(0, 16);

export const enqueueNotificationCreation = async (params: {
  userId: number;
  businessId: string;
  type: AppNotificationType;
  title?: string | null;
  message: string;
  actionUrl?: string | null;
  priority?: "critical" | "warning" | "info" | "success" | null;
  referenceKey?: string | null;
  context?: AppQueueContextInput;
}) => {
  const dedupeSource =
    params.referenceKey?.trim() ||
    `${params.userId}:${params.businessId}:${params.type}:${params.message}`;

  return enqueueQueueJob({
    jobName: "createNotification",
    payload: {
      businessId: params.businessId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
      priority: params.priority,
      referenceKey: params.referenceKey,
    },
    context: {
      businessId: params.businessId,
      userId: params.userId,
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        type: params.type,
        referenceKey: params.referenceKey ?? null,
        task: "notification_creation",
      },
    },
    jobId: `notification:${params.businessId}:${hashValue(dedupeSource)}`,
  });
};
