"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardResponsiveChart from "@/components/dashboard/DashboardResponsiveChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useDashboardForecast } from "@/components/dashboard/use-dashboard-forecast";

const formatTooltipValue = (value: unknown) => {
  if (typeof value === "number") return formatCurrency(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
  }
  return formatCurrency(0);
};

const ProfitForecast = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const historical = data?.profit.historicalMonthly ?? [];
  const projected = data?.profit.projectedMonthly ?? [];
  const projected30 = data?.profit.projected30Days;

  const chartData = useMemo(
    () => [
      ...historical.map((item) => ({
        month: item.month,
        actualProfit: item.profit,
        projectedProfit: 0,
      })),
      ...projected.map((item) => ({
        month: item.month,
        actualProfit: 0,
        projectedProfit: item.profit,
      })),
    ],
    [historical, projected],
  );

  const stats = projected30
    ? [
        {
          label: "Projected sales",
          value: formatCurrency(projected30.sales),
        },
        {
          label: "Projected costs",
          value: formatCurrency(projected30.purchases + projected30.expenses),
        },
        {
          label: "Projected profit",
          value: formatCurrency(projected30.profit),
        },
      ]
    : [];

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className ?? ""}`}
    >
      <CardHeader className="dashboard-chart-content">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
          Profit projection
        </p>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
          Expected profit outlook
        </CardTitle>
        <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
          Projected profit is based on receipt-driven sales, purchase payouts, and
          recorded expenses.
        </p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-6">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-[#fdf7f1]" />
        ) : isError ? (
          <p className="text-sm text-[#b45309]">Unable to load profit projection.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {stats.map((item) => (
                <div key={item.label} className="dashboard-chart-metric rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex min-h-[320px] flex-1 flex-col">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Historical vs projected profit
              </p>
              <div className="mt-3 min-h-0 min-w-0 flex-1">
                <DashboardResponsiveChart>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={formatTooltipValue} />
                    <Tooltip formatter={(value) => formatTooltipValue(value)} />
                    <Bar
                      dataKey="actualProfit"
                      name="Actual profit"
                      fill="#0f766e"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="projectedProfit"
                      name="Projected profit"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </DashboardResponsiveChart>
              </div>
              {projected30 ? (
                <p className="mt-2 text-xs text-[#8a6d56]">
                  Projected 30-day margin: {formatPercent(projected30.margin)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfitForecast;
