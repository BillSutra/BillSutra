"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type DashboardCustomers,
  fetchDashboardCustomers,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersRound } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const getSegmentColor = (segment: string): string => {
  switch (segment) {
    case "PREMIUM":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    case "REGULAR":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    case "NEW_LOW":
      return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getSegmentLabel = (segment: string): string => {
  switch (segment) {
    case "PREMIUM":
      return "Premium";
    case "REGULAR":
      return "Regular";
    case "NEW_LOW":
      return "New / Low";
    default:
      return "Unknown";
  }
};

type CustomerClvEntry =
  DashboardCustomers["clvAnalytics"]["premiumCustomers"][number];

const CustomerInsights = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "customers"],
    queryFn: fetchDashboardCustomers,
    ...dashboardQueryDefaults,
  });

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col gap-0 rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#0f766e]">
            <UsersRound size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
              Customer pulse
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              Customer insights
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#8a6d56]">
          Loyalty, churn risk, and visit cadence across your customer base.
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
          <p className="text-sm text-[#b45309]">Unable to load customers.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total Registered Customers",
                  value: formatNumber(data.totalRegisteredCustomers),
                },
                { label: "Top customers", value: formatNumber(data.topCustomers.length) },
                {
                  label: "Pending payments",
                  value: formatCurrency(data.pendingPayments),
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

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-green-200 bg-[linear-gradient(135deg,rgba(220,252,231,0.9),rgba(255,255,255,0.95))] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                  Premium
                </p>
                <p className="mt-2 text-2xl font-semibold text-green-900 dark:text-green-100">
                  {formatNumber(data.clvAnalytics.premiumCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,rgba(224,242,254,0.9),rgba(255,255,255,0.95))] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                  Regular
                </p>
                <p className="mt-2 text-2xl font-semibold text-blue-900 dark:text-blue-100">
                  {formatNumber(data.clvAnalytics.regularCount)}
                </p>
              </div>
              <div className="rounded-2xl border border-[#e7ddd2] bg-[linear-gradient(135deg,rgba(255,249,242,0.96),rgba(255,255,255,0.95))] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                  New / Low
                </p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {formatNumber(data.clvAnalytics.newLowCount)}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Top 5 customers by total purchase amount
              </p>
              {data.topCustomers.length === 0 ? (
                <p className="mt-3 text-sm text-[#8a6d56]">
                  No customer data available yet.
                </p>
              ) : (
                <div className="mt-3 grid gap-2">
                  {data.topCustomers.map((customer) => {
                    let clvData: CustomerClvEntry | null = null;
                    let segment: "PREMIUM" | "REGULAR" | "NEW_LOW" = "NEW_LOW";

                    const premium = data.clvAnalytics.premiumCustomers.find(
                      (c) => c.customerName === customer.name,
                    );
                    const regular = data.clvAnalytics.regularCustomers.find(
                      (c) => c.customerName === customer.name,
                    );
                    const newLow = data.clvAnalytics.newLowCustomers.find(
                      (c) => c.customerName === customer.name,
                    );

                    if (premium) {
                      segment = "PREMIUM";
                      clvData = premium;
                    } else if (regular) {
                      segment = "REGULAR";
                      clvData = regular;
                    } else if (newLow) {
                      segment = "NEW_LOW";
                      clvData = newLow;
                    }

                    return (
                      <div
                        key={customer.name}
                        className="flex items-start justify-between rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-3 text-sm shadow-[0_14px_30px_-24px_rgba(31,27,22,0.28)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {customer.name}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${getSegmentColor(
                                segment,
                              )}`}
                            >
                              {getSegmentLabel(segment)}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#8a6d56]">
                            <p>
                              Lifetime Value:{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {clvData
                                  ? formatCurrency(clvData.lifetimeValue)
                                  : formatCurrency(customer.totalPurchaseAmount)}
                              </span>
                            </p>
                            <p>
                              Predicted (6mo):{" "}
                              <span className="font-semibold text-[#1f1b16]">
                                {clvData
                                  ? formatCurrency(clvData.predicatedFutureValue)
                                  : "N/A"}
                              </span>
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            Orders: {formatNumber(customer.numberOfOrders)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {data.churnAnalytics && (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Customers at risk
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-red-200 bg-[linear-gradient(135deg,rgba(254,226,226,0.9),rgba(255,255,255,0.95))] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
                      High Risk
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-red-900 dark:text-red-100">
                      {formatNumber(data.churnAnalytics.highRiskCount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-yellow-200 bg-[linear-gradient(135deg,rgba(254,249,195,0.78),rgba(255,255,255,0.95))] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-yellow-700 dark:text-yellow-400">
                      Medium Risk
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-yellow-900 dark:text-yellow-100">
                      {formatNumber(data.churnAnalytics.mediumRiskCount)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-green-200 bg-[linear-gradient(135deg,rgba(220,252,231,0.9),rgba(255,255,255,0.95))] p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                      Low Risk
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-green-900 dark:text-green-100">
                      {formatNumber(data.churnAnalytics.lowRiskCount)}
                    </p>
                  </div>
                </div>

                {data.churnAnalytics.topAtRiskCustomers.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {data.churnAnalytics.topAtRiskCustomers.map((customer) => (
                      <div
                        key={customer.customerId}
                        className="flex items-start justify-between rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-3 text-sm shadow-[0_14px_30px_-24px_rgba(31,27,22,0.28)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {customer.customerName}
                            </p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${
                                customer.riskLevel === "HIGH_RISK"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                  : customer.riskLevel === "MEDIUM_RISK"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                                    : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              }`}
                            >
                              {(customer.churnProbability * 100).toFixed(0)}% churn
                              risk
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            Last Purchase: {formatNumber(customer.daysSinceLastPurchase)} days
                            ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Daily / Weekly / Monthly customers
              </p>
              <div className="mt-3 grid gap-2">
                {[
                  { label: "Daily", value: data.customerVisits.daily },
                  { label: "Weekly", value: data.customerVisits.weekly },
                  { label: "Monthly", value: data.customerVisits.monthly },
                ].map((period) => (
                  <div
                    key={period.label}
                    className="dashboard-chart-metric rounded-2xl px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[#1f1b16]">
                      {period.label}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Registered: {formatNumber(period.value.registeredCustomers)} | Walk-in:{" "}
                      {formatNumber(period.value.walkInCustomers)} | Total:{" "}
                      {formatNumber(period.value.totalCustomers)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerInsights;
