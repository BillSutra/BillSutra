"use client";

import { clamp } from "@/lib/dashboardUtils";

const DEFAULT_REFRESH_MS = 45_000;
const MIN_REFRESH_MS = 10_000;
const MAX_REFRESH_MS = 300_000;
const DEFAULT_REALTIME_ENABLED = true;

const resolveRealtimeEnabled = () => {
  const raw = process.env.NEXT_PUBLIC_DASHBOARD_REALTIME;
  if (!raw) return DEFAULT_REALTIME_ENABLED;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false;
  }
  return true;
};

const parseRefreshInterval = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const resolveRefreshInterval = () => {
  const parsed = parseRefreshInterval(process.env.NEXT_PUBLIC_DASHBOARD_REFRESH_MS);
  if (parsed === undefined) return DEFAULT_REFRESH_MS;
  return clamp(parsed, MIN_REFRESH_MS, MAX_REFRESH_MS);
};

export const DASHBOARD_REFRESH_INTERVAL_MS = resolveRefreshInterval();
export const DASHBOARD_REALTIME_ENABLED = resolveRealtimeEnabled();

export const dashboardRetryDelay = (attempt: number) =>
  Math.min(1000 * 2 ** attempt, 30_000);

export const dashboardQueryDefaults = {
  refetchInterval: (DASHBOARD_REALTIME_ENABLED
    ? false
    : DASHBOARD_REFRESH_INTERVAL_MS) as false | number,
  refetchIntervalInBackground: true,
  staleTime: 30_000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  retry: 3,
  retryDelay: dashboardRetryDelay,
};
