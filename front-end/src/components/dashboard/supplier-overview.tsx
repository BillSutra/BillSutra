"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardSuppliers } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

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

const SupplierOverview = ({ className }: { className?: string }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "suppliers"],
    queryFn: fetchDashboardSuppliers,
  });

  return (
    <Card className={`border-[#ecdccf] bg-white/90 flex flex-col ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Supplier Overview</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-4 overflow-auto min-h-0">
        {isLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load suppliers.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            {/* Summary counters */}
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Total Suppliers", value: data.total },
                { label: "Recent Purchases", value: data.recentPurchases },
                {
                  label: "Outstanding Payables",
                  value: formatCurrency(data.outstandingPayables),
                },
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

            {/* Supplier Segmentation Badges */}
            {data.supplierAnalytics && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
                  <p className="text-xs uppercase tracking-[0.2em] text-green-700 dark:text-green-400">
                    High Value
                  </p>
                  <p className="mt-2 text-2xl font-bold text-green-900 dark:text-green-100">
                    {data.supplierAnalytics.highValueCount}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-700 dark:text-gray-400">
                    Low Value
                  </p>
                  <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {data.supplierAnalytics.lowValueCount}
                  </p>
                </div>
              </div>
            )}

            {/* Top Suppliers with LTV Analysis */}
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
                    let segment: "HIGH_VALUE" | "LOW_VALUE" =
                      "LOW_VALUE";
                    let ltvData: any = null;

                    const highValue =
                      data.supplierAnalytics?.highValueSuppliers?.find(
                        (s) => s.supplierName === supplier.name
                      );
                    const lowValue =
                      data.supplierAnalytics?.lowValueSuppliers?.find(
                        (s) => s.supplierName === supplier.name
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
                        className="flex items-start justify-between rounded-xl border border-[#f2e6dc] bg-white px-4 py-3 text-sm"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#1f1b16]">
                              {supplier.name}
                            </p>
                            <span
                              className={`text-xs font-medium px-2 py-1 rounded-full ${getSegmentColor(
                                segment,
                              )}`}
                            >
                              {segment === "HIGH_VALUE"
                                ? "High Value"
                                : "Low Value"}
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
                            Orders: {supplier.numberOfOrders}
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
