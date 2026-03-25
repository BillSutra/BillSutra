"use client";

import type { QueryClient } from "@tanstack/react-query";

export const dashboardQueryKeys = [
  ["dashboard", "metrics"],
  ["dashboard", "overview"],
  ["dashboard", "recentInvoices"],
  ["dashboard", "sales"],
  ["dashboard", "transactions"],
  ["dashboard", "cashflow"],
  ["dashboard", "customers"],
  ["dashboard", "suppliers"],
  ["dashboard", "inventory"],
  ["dashboard", "productSales"],
  ["dashboard", "paymentMethods"],
  ["dashboard", "forecast"],
  ["inventory-demand", "alerts"],
  ["inventory-demand", "predictions"],
] as const;

export const invalidateDashboardQueries = (queryClient: QueryClient) =>
  Promise.all(
    dashboardQueryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
