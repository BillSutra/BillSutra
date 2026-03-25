"use client";

import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useForecastSales, forecastSalesQueryKey } from "@/hooks/usePredictionQueries";

export const dashboardForecastQueryKey = forecastSalesQueryKey;

export const useDashboardForecast = () => useForecastSales();

export { DASHBOARD_REFRESH_INTERVAL_MS };
