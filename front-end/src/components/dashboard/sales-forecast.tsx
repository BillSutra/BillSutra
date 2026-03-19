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
import { formatCurrency, formatNumber } from "@/lib/dashboardUtils";
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

const SalesForecast = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const chartData = useMemo(() => {
    const historical = data?.sales.historicalMonthly ?? [];
    const projected = data?.sales.predictedMonthly ?? [];

    return [
      ...historical.map((item) => ({
        month: item.month,
        actualReceipts: item.receipts,
        projectedReceipts: undefined,
      })),
      ...projected.map((item) => ({
        month: item.month,
        actualReceipts: undefined,
        projectedReceipts: item.receipts,
      })),
    ];
  }, [data]);

  const stats = data
    ? [
        {
          label: "Avg daily receipts",
          value: formatCurrency(data.sales.trailing30Days.averageDailyReceipts),
        },
        {
          label: "Projected next 30 days",
          value: formatCurrency(data.sales.projectedNext30Days),
        },
        {
          label: "Trend vs last period",
          value: `${data.sales.trailing30Days.trendPercent >= 0 ? "+" : ""}${formatNumber(
            data.sales.trailing30Days.trendPercent,
          )}%`,
        },
      ]
    : [];

  return (
    <div
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] p-5 ${className ?? ""}`}
    >
      <div className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
            Forecast studio
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#1f1b16]">
            Sales forecast
          </p>
          <p className="mt-2 text-sm text-[#8a6d56]">
            Monthly sales forecast uses real cash receipts from paid sales and invoice
            collections.
          </p>
        </div>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="dashboard-chart-metric rounded-2xl p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                {stat.label}
              </p>
              <p className="mt-2 text-sm font-semibold text-[#1f1b16]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-[320px] min-w-0">
          {isLoading ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
              <p className="text-sm text-[#8a6d56]">Loading forecast...</p>
            </div>
          ) : isError ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
              <p className="text-sm text-[#b45309]">Failed to load forecast data</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
              <p className="text-sm text-[#8a6d56]">No receipt history available yet</p>
            </div>
          ) : (
            <DashboardResponsiveChart>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f2e6dc" />
                <XAxis dataKey="month" tick={{ fill: "#8a6d56", fontSize: 12 }} />
                <YAxis tick={{ fill: "#8a6d56", fontSize: 12 }} tickFormatter={formatTooltipValue} />
                <Tooltip formatter={(value) => formatTooltipValue(value)} />
                <Legend wrapperStyle={{ paddingTop: "1rem" }} iconType="line" />
                <Line
                  type="monotone"
                  dataKey="actualReceipts"
                  name="Actual receipts"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="projectedReceipts"
                  name="Projected receipts"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </DashboardResponsiveChart>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesForecast;
