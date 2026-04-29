import {
  clearAnalyticsStatsDirty,
  rebuildAnalyticsDailyStatsRange,
} from "../../services/analyticsDailyStats.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const analyticsJobHandlers = {
  refreshAnalyticsWindow: async (job) => {
    const userId = job.data.context.userId;
    if (!userId) {
      throw new Error("Analytics refresh job is missing userId");
    }

    await rebuildAnalyticsDailyStatsRange({
      userId,
      start: new Date(job.data.payload.startDate),
      endExclusive: new Date(job.data.payload.endDate),
    });
    await clearAnalyticsStatsDirty(userId);

    return {
      refreshed: true,
      userId,
      startDate: job.data.payload.startDate,
      endDate: job.data.payload.endDate,
    };
  },
} satisfies Pick<AppQueueJobHandlerMap, "refreshAnalyticsWindow">;
