"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type DashboardSuppliers,
  fetchDashboardSuppliers,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const getSegmentColor = (segment: string): string => {
  switch (segment) {
    case "HIGH_VALUE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    case "LOW_VALUE":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

type SupplierLtvEntry =
  DashboardSuppliers["supplierAnalytics"] extends infer T
    ? T extends { highValueSuppliers: Array<infer U> }
      ? U
      : never
    : never;

const SupplierOverview = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "suppliers"],
    queryFn: fetchDashboardSuppliers,
    ...dashboardQueryDefaults,
  });

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col gap-0 rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#8b5e34]">
            <Truck size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
              Vendor desk
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              Supplier overview
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#8a6d56]">
          Purchase concentration, payables, and top supplier relationships.
        </p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5 overflow-auto">
        {isLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load suppliers.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Suppliers", value: formatNumber(data.total) },
                {
                  label: "Recent Purchases",
                  value: formatNumber(data.recentPurchases),
                },
                {
                  label: "Outstanding Payables",
                  value: formatCurrency(data.outstandingPayables),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="dashboard-chart-metric rounded-2xl p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {data.supplierAnalytics && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-green-200 bg-[linear-gradient(135deg,rgba(220,252,231,0.9),rgba(255,255,255,0.95))] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                    High Value
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-green-900 dark:text-green-100">
                    {formatNumber(data.supplierAnalytics.highValueCount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#e7ddd2] bg-[linear-gradient(135deg,rgba(255,249,242,0.96),rgba(255,255,255,0.95))] p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                    Low Value
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {formatNumber(data.supplierAnalytics.lowValueCount)}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Top 5 suppliers by total purchase amount
              </p>
              {data.topSuppliers && data.topSuppliers.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a6d56]">
                  No supplier data available yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {data.topSuppliers?.map((supplier) => {
                    let segment: "HIGH_VALUE" | "LOW_VALUE" = "LOW_VALUE";
                    let ltvData: SupplierLtvEntry | null = null;

                    const highValue =
                      data.supplierAnalytics?.highValueSuppliers?.find(
                        (s) => s.supplierName === supplier.name,
                      );
                    const lowValue =
                      data.supplierAnalytics?.lowValueSuppliers?.find(
                        (s) => s.supplierName === supplier.name,
                      );

                    if (highValue) {
                      segment = "HIGH_VALUE";
                      ltvData = highValue;
                    } else if (lowValue) {
                      segment = "LOW_VALUE";
                      ltvData = lowValue;
                    }

                    return (
                      <div
                        key={supplier.name}
                        className="flex items-start justify-between rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-3 text-sm shadow-[0_14px_30px_-24px_rgba(31,27,22,0.28)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {supplier.name}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${getSegmentColor(
                                segment,
                              )}`}
                            >
                              {segment === "HIGH_VALUE" ? "High Value" : "Low Value"}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#8a6d56]">
                            <p>
                              Lifetime Value:{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {ltvData
                                  ? formatCurrency(ltvData.lifetimeValue)
                                  : formatCurrency(supplier.totalPurchaseAmount)}
                              </span>
                            </p>
                            <p>
                              Predicted (6mo):{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {ltvData
                                  ? formatCurrency(ltvData.predictedFutureValue)
                                  : "N/A"}
                              </span>
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            Orders: {formatNumber(supplier.numberOfOrders)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SupplierOverview;
