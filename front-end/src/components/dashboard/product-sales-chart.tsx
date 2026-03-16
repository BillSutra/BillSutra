"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  fetchDashboardProductSales,
  type DashboardProductSales,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber, sumBy } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DashboardProductSales["products"][number];
    return (
      <div className="rounded-lg border border-[#ecdccf] bg-white p-3 shadow-sm">
        <p className="mb-1 font-semibold text-[#1f1b16]">{label}</p>
        <p className="text-sm text-[#0f766e]">
          Units Sold: <span className="font-medium">{formatNumber(data.quantity)}</span>
        </p>
        <p className="text-sm text-[#8a6d56]">
          Revenue: <span className="font-medium">{formatCurrency(data.revenue)}</span>
        </p>
      </div>
    );
  }
  return null;
};

const ProductSalesChart = ({ className }: { className?: string }) => {
  const [period, setPeriod] = useState<"lifetime" | "month" | "week" | "year">(
    "lifetime",
  );

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "productSales", period],
    queryFn: () => fetchDashboardProductSales(period),
    ...dashboardQueryDefaults,
  });

  const totals = useMemo(() => {
    const products = data?.products ?? [];
    return {
      totalUnits: sumBy(products, (item) => item.quantity),
      totalRevenue: sumBy(products, (item) => item.revenue),
    };
  }, [data]);

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content pb-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
              Product momentum
            </p>
            <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
              Product sales performance
            </CardTitle>
            <p className="mt-2 text-sm text-[#8a6d56]">
              Best-selling products ranked by units sold for the selected window.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <DashboardCardStatus
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
              className="sm:text-right"
            />
            <div className="flex rounded-lg border border-[#ecdccf] bg-[#fdf7f1] p-1">
              {(
                [
                  { id: "week", label: "This Week" },
                  { id: "month", label: "This Month" },
                  { id: "year", label: "This Year" },
                  { id: "lifetime", label: "Lifetime" },
                ] as const
              ).map((option) => (
                <Button
                  key={option.id}
                  variant={period === option.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPeriod(option.id)}
                  className={`h-7 px-3 text-xs ${
                    period === option.id
                      ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                      : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
                  }`}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="dashboard-chart-content flex flex-col flex-1 min-h-0 gap-5">
        {!isLoading && !isError && data && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="dashboard-chart-metric rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Units sold
              </p>
              <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                {formatNumber(totals.totalUnits)}
              </p>
            </div>
            <div className="dashboard-chart-metric rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Revenue captured
              </p>
              <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                {formatCurrency(totals.totalRevenue)}
              </p>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="h-64 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <div className="flex h-64 items-center justify-center rounded-xl bg-[#fdf7f1]">
            <p className="text-sm text-[#b45309]">Unable to load sales data.</p>
          </div>
        )}
        {!isLoading && !isError && data && (
          <>
            {data.products.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-[#ecdccf] bg-[#fdf7f1]">
                <p className="text-sm text-[#8a6d56]">
                  No products sold during this period.
                </p>
              </div>
            ) : (
              <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.products}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#f2e6dc"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#8a6d56" }}
                      tickLine={false}
                      axisLine={{ stroke: "#ecdccf" }}
                      interval={0}
                      tickFormatter={(value) =>
                        value.length > 10 ? `${value.substring(0, 10)}...` : value
                      }
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8a6d56" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "#fdf7f1" }} />
                    <Bar
                      dataKey="quantity"
                      fill="#0f766e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-[#8a6d56]">
              Showing top {Math.min(15, data.products.length)} products by units sold
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductSalesChart;
