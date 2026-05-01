import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

export const enqueueAnalyticsWindowRefresh = async (params: {
  userId: number;
  startDate: string;
  endDate: string;
  source?: string | null;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "refreshAnalyticsWindow",
    payload: {
      startDate: params.startDate,
      endDate: params.endDate,
      source: params.source ?? null,
    },
    context: {
      ...params.context,
      userId: params.userId,
      metadata: {
        ...(params.context?.metadata ?? {}),
        task: "analytics_refresh",
        startDate: params.startDate,
        endDate: params.endDate,
        source: params.source ?? "dashboard_update",
      },
    },
    jobId: `analytics:${params.userId}:${params.startDate}:${params.endDate}`,
  });
