import { EventEmitter } from "events";
import { invalidateMetricsCacheByUser } from "./dashboardMetricsCache.js";
import { emitRealtimeDashboardUpdate } from "./realtimeSocket.service.js";
import {
  buildAnalyticsCachePrefix,
  buildReportsCachePrefix,
} from "../redis/cacheKeys.js";
import { deleteCacheByPrefix } from "../redis/cache.js";

type DashboardUpdatePayload = {
  userId: number;
  source?: string;
  at: number;
};

const dashboardEmitter = new EventEmitter();
dashboardEmitter.setMaxListeners(0);

export const emitDashboardUpdate = (payload: Omit<DashboardUpdatePayload, "at">) => {
  invalidateMetricsCacheByUser(payload.userId);
  void Promise.all([
    deleteCacheByPrefix(buildReportsCachePrefix(payload.userId)),
    deleteCacheByPrefix(buildAnalyticsCachePrefix(payload.userId)),
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
