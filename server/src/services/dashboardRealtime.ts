import { EventEmitter } from "events";
import { invalidateMetricsCacheByUser } from "./dashboardMetricsCache.js";

type DashboardUpdatePayload = {
  userId: number;
  source?: string;
  at: number;
};

const dashboardEmitter = new EventEmitter();
dashboardEmitter.setMaxListeners(0);

export const emitDashboardUpdate = (payload: Omit<DashboardUpdatePayload, "at">) => {
  invalidateMetricsCacheByUser(payload.userId);
  dashboardEmitter.emit("update", { ...payload, at: Date.now() });
};

export const onDashboardUpdate = (
  listener: (payload: DashboardUpdatePayload) => void,
) => {
  dashboardEmitter.on("update", listener);
  return () => dashboardEmitter.off("update", listener);
};
