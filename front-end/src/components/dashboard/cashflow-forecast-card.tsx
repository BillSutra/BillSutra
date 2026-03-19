"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardResponsiveChart from "@/components/dashboard/DashboardResponsiveChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useDashboardForecast } from "@/components/dashboard/use-dashboard-forecast";
import { formatCurrency } from "@/lib/dashboardUtils";

const formatTooltipValue = (value: unknown) => {
  if (typeof value === "number") return formatCurrency(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return formatCurrency(Number.isFinite(parsed) ? parsed : 0);
  }
  return formatCurrency(0);
};

const CashflowForecastCard = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const chartData = useMemo(
    () =>
      (data?.cashflow.predictedMonthly ?? []).map((item) => ({
        month: item.month,
        inflow: item.inflow,
        outflow: item.outflow,
        net: item.net,
      })),
    [data],
  );

  const projected30 = data?.cashflow.projected30Days;

  const stats = projected30
    ? [
        {
          label: "Expected inflow",
          value: formatCurrency(projected30.inflow),
        },
        {
          label: "Expected outflow",
          value: formatCurrency(projected30.outflow),
        },
        {
          label: "Closing balance",
          value: formatCurrency(projected30.closingBalanceEstimate),
        },
      ]
    : [];

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className ?? ""}`}
    >
      <CardHeader className="dashboard-chart-content">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
          Cashflow forecast
        </p>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
          Expected cash movement
        </CardTitle>
        <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
          Forecasted inflow, outflow, and net cash position based on recent payment
          behavior.
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
          <p className="text-sm text-[#b45309]">Unable to load cashflow forecast.</p>
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
                Projected monthly cashflow
              </p>
              <div className="mt-3 min-h-0 min-w-0 flex-1">
                <DashboardResponsiveChart>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fill: "#8a6d56", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#8a6d56", fontSize: 12 }} tickFormatter={formatTooltipValue} />
                    <Tooltip formatter={(value) => formatTooltipValue(value)} />
                    <Legend wrapperStyle={{ paddingTop: "1rem" }} iconType="line" />
                    <Line
                      type="monotone"
                      dataKey="inflow"
                      name="Inflow"
                      stroke="#15803d"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="outflow"
                      name="Outflow"
                      stroke="#f97316"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net cashflow"
                      stroke="#1d4ed8"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </DashboardResponsiveChart>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CashflowForecastCard;
