"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardCustomers } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

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

const CustomerInsights = ({ className }: { className?: string }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "customers"],
    queryFn: fetchDashboardCustomers,
  });

  return (
    <Card className={`border-[#ecdccf] bg-white/90 flex flex-col ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Customer Insights</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-4 overflow-auto min-h-0">
        {isLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load customers.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            {/* Summary counters */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total Registered Customers",
                  value: data.totalRegisteredCustomers,
                },
                { label: "Top customers", value: data.topCustomers.length },
                { label: "Pending payments", value: data.pendingPayments },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
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

            {/* CLV Summary Badges */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                  Premium
                </p>
                <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-100">
                  {data.clvAnalytics.premiumCount}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
                <p className="text-xs uppercase tracking-[0.2em] text-blue-700 dark:text-blue-400">
                  Regular
                </p>
                <p className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {data.clvAnalytics.regularCount}
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                  New / Low
                </p>
                <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {data.clvAnalytics.newLowCount}
                </p>
              </div>
            </div>

            {/* Top Customers by Lifetime Value - with full details */}
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
                    // Find CLV data for this customer
                    let clvData: any = null;
                    let segment: "PREMIUM" | "REGULAR" | "NEW_LOW" = "NEW_LOW";

                    const premium = data.clvAnalytics.premiumCustomers.find(
                      (c) => c.customerName === customer.name
                    );
                    const regular = data.clvAnalytics.regularCustomers.find(
                      (c) => c.customerName === customer.name
                    );
                    const newLow = data.clvAnalytics.newLowCustomers.find(
                      (c) => c.customerName === customer.name
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
                        className="flex items-start justify-between rounded-xl border border-[#f2e6dc] bg-white px-4 py-3 text-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {customer.name}
                            </p>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${getSegmentColor(
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
                            Orders: {customer.numberOfOrders}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customers at Risk */}
            {data.churnAnalytics && (
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Customers at risk
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
                    <p className="text-xs uppercase tracking-[0.2em] text-red-700 dark:text-red-400">
                      High Risk
                    </p>
                    <p className="mt-2 text-2xl font-bold text-red-900 dark:text-red-100">
                      {data.churnAnalytics.highRiskCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-900/20">
                    <p className="text-xs uppercase tracking-[0.2em] text-yellow-700 dark:text-yellow-400">
                      Medium Risk
                    </p>
                    <p className="mt-2 text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                      {data.churnAnalytics.mediumRiskCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                    <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                      Low Risk
                    </p>
                    <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-100">
                      {data.churnAnalytics.lowRiskCount}
                    </p>
                  </div>
                </div>

                {data.churnAnalytics.topAtRiskCustomers.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {data.churnAnalytics.topAtRiskCustomers.map((customer) => (
                      <div
                        key={customer.customerId}
                        className="flex items-start justify-between rounded-xl border border-[#f2e6dc] bg-white px-4 py-3 text-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {customer.customerName}
                            </p>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${
                                customer.riskLevel === "HIGH_RISK"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                                  : customer.riskLevel === "MEDIUM_RISK"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                              }`}
                            >
                              {(customer.churnProbability * 100).toFixed(0)}% churn risk
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            Last Purchase: {customer.daysSinceLastPurchase} days ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Daily / Weekly / Monthly customers */}
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
                    className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3 text-sm"
                  >
                    <p className="font-semibold text-[#1f1b16]">
                      {period.label}
                    </p>
                    <p className="text-xs text-[#8a6d56]">
                      Registered: {period.value.registeredCustomers} | Walk-in:{" "}
                      {period.value.walkInCustomers} | Total:{" "}
                      {period.value.totalCustomers}
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
