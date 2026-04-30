import { EventEmitter } from "events";
import { invalidateMetricsCacheByUser } from "./dashboardMetricsCache.js";
import { emitRealtimeDashboardUpdate } from "./realtimeSocket.service.js";
import {
  addDaysUtc,
  buildDateKey,
  getAnalyticsRecentRefreshWindowDays,
  markAnalyticsStatsDirty,
} from "./analyticsDailyStats.service.js";
import {
  buildAnalyticsCachePrefix,
  buildReportsCachePrefix,
} from "../redis/cacheKeys.js";
import { deleteCacheByPrefix } from "../redis/cache.js";
import { enqueueAnalyticsWindowRefresh } from "../queues/jobs/analytics.jobs.js";

type DashboardUpdatePayload = {
  userId: number;
  source?: string;
  at: number;
};

const dashboardEmitter = new EventEmitter();
dashboardEmitter.setMaxListeners(0);

export const emitDashboardUpdate = (payload: Omit<DashboardUpdatePayload, "at">) => {
  invalidateMetricsCacheByUser(payload.userId);
  const today = new Date();
  const refreshStart = addDaysUtc(today, -getAnalyticsRecentRefreshWindowDays());
  const refreshEnd = addDaysUtc(today, 1);
  void Promise.all([
    deleteCacheByPrefix(buildReportsCachePrefix(payload.userId)),
    deleteCacheByPrefix(buildAnalyticsCachePrefix(payload.userId)),
    markAnalyticsStatsDirty({
      userId: payload.userId,
      source: payload.source,
    }),
    enqueueAnalyticsWindowRefresh({
      userId: payload.userId,
      startDate: buildDateKey(refreshStart),
      endDate: buildDateKey(refreshEnd),
      source: payload.source,
      context: {
        userId: payload.userId,
        metadata: {
          source: payload.source ?? "dashboard_update",
        },
      },
    }),
  ]);
  const eventPayload = { ...payload, at: Date.now() };
  dashboardEmitter.emit("update", eventPayload);
  emitRealtimeDashboardUpdate(payload);
};

export const onDashboardUpdate = (
  listener: (payload: DashboardUpdatePayload) => void,
) => {
  dashboardEmitter.on("update", listener);
  return () => dashboardEmitter.off("update", listener);
};
