"use client";

import React from "react";
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
import { fetchDashboardForecast } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const formatTooltipValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return formatTooltipValue(value[0]);
  }

  if (typeof value === "number") {
    return formatCurrency(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
  }

  return formatCurrency(0);
};

const ProfitForecast = ({ className }: { className?: string }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "forecast"],
    queryFn: fetchDashboardForecast,
  });

  const monthlyProfit = data?.profit.monthly ?? [];

  const totalRevenue = monthlyProfit.reduce(
    (sum, item) => sum + item.revenue,
    0,
  );
  const totalCost = monthlyProfit.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );
  const totalProfit = monthlyProfit.reduce((sum, item) => sum + item.profit, 0);
  const avgMargin = totalRevenue === 0 ? 0 : (totalProfit / totalRevenue) * 100;

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
          Profit radar
        </p>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
          Profit analytics
        </CardTitle>
        <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
          Revenue, operating cost, and net profit across the latest six-month
          window.
        </p>
      </CardHeader>
      <CardContent className="dashboard-chart-content flex flex-col flex-1 gap-6 min-h-0">
        {isLoading && (
          <div className="h-40 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">
            Unable to load profit data.
          </p>
        )}
        {!isLoading && !isError && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Total revenue",
                  value: formatCurrency(totalRevenue),
                },
                {
                  label: "Total cost",
                  value: formatCurrency(totalCost),
                },
                {
                  label: "Net profit",
                  value: formatCurrency(totalProfit),
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

            <div className="flex flex-col flex-1 min-h-[300px]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Monthly profit trend
              </p>
              <div className="mt-3 flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyProfit}>
                    <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => formatTooltipValue(value)}
                    />
                    <Bar
                      dataKey="profit"
                      fill={totalProfit >= 0 ? "#16a34a" : "#dc2626"}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-[#8a6d56] mt-2">
                Avg margin: {avgMargin.toFixed(1)}%
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfitForecast;
