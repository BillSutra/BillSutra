"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardForecast,
  type DashboardForecastResponse,
} from "@/lib/apiClient";
import {
  DASHBOARD_REFRESH_INTERVAL_MS,
  dashboardQueryDefaults,
} from "@/lib/dashboardRefresh";

export const dashboardForecastQueryKey = ["dashboard", "forecast"] as const;

export const useDashboardForecast = () =>
  useQuery<DashboardForecastResponse>({
    queryKey: dashboardForecastQueryKey,
    queryFn: fetchDashboardForecast,
    ...dashboardQueryDefaults,
    refetchInterval: dashboardQueryDefaults.refetchInterval,
    staleTime: dashboardQueryDefaults.staleTime,
  });

export { DASHBOARD_REFRESH_INTERVAL_MS };
