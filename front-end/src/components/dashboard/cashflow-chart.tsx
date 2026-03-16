"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { fetchDashboardCashflow } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
} from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const INFLOW_COLOR = "#15803d";
const OUTFLOW_COLOR = "#f97316";

type CashflowTooltipEntry = {
  color?: string;
  name?: string;
  value?: number;
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: CashflowTooltipEntry[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#ecdccf] bg-white p-3 shadow-xl ring-1 ring-black/5">
        <p className="mb-2 font-semibold text-[#1f1b16]">
          {label ? formatDateLabel(label) : ""}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div
              key={`${entry.name}-${index}`}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs capitalize text-[#8a6d56]">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold text-[#1f1b16]">
                {formatCurrency(entry.value ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const legendFormatter = (value: string) => (
  <span className="text-sm font-medium text-[#5c4331]">{value}</span>
);

const CashFlowChart = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "cashflow"],
    queryFn: fetchDashboardCashflow,
    ...dashboardQueryDefaults,
  });
  const hasSeriesData = (data?.series ?? []).some(
    (item) => item.inflow > 0 || item.outflow > 0,
  );

  const net = data?.netCashFlow ?? 0;
  const netClass =
    net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-amber-700";

  const inflowModeLabel =
    data?.inflowSourceMode === "payments"
      ? "Invoice payments"
      : data?.inflowSourceMode === "sales"
        ? "Direct sale receipts"
        : "Sales receipts + invoice payments";

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content pb-0">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
              Cash movement
            </p>
            <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
              Cash flow summary
            </CardTitle>
            <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
              Current-month collections versus outgoing purchase payments and
              expenses.
            </p>
          </div>
          <DashboardCardStatus
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
            dataUpdatedAt={dataUpdatedAt}
            refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
            className="lg:items-end lg:text-right"
          />
          <div className="dashboard-chart-metric rounded-2xl px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a6d56]">
              Inflow source
            </p>
            <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
              {inflowModeLabel}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="dashboard-chart-content flex flex-col flex-1 gap-6 min-h-0 pt-6">
        {isLoading && (
          <div className="h-32 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load cash flow.</p>
        )}
        {!isLoading && !isError && data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Cash inflow", value: formatCurrency(data.inflow) },
                { label: "Cash outflow", value: formatCurrency(data.outflow) },
                {
                  label: "Net cash flow",
                  value: formatCurrency(data.netCashFlow),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="dashboard-chart-metric rounded-2xl p-4"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p
                    className={`mt-3 text-lg font-semibold ${
                      item.label === "Net cash flow"
                        ? netClass
                        : "text-[#1f1b16]"
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            {hasSeriesData ? (
              <div className="h-[320px] md:h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data.series}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={INFLOW_COLOR} stopOpacity={0.42} />
                        <stop offset="95%" stopColor={INFLOW_COLOR} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={OUTFLOW_COLOR} stopOpacity={0.42} />
                        <stop offset="95%" stopColor={OUTFLOW_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="#f2e6dc"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#8a6d56" }}
                      axisLine={{ stroke: "#ecdccf" }}
                      tickLine={false}
                      dy={10}
                      interval={0}
                      tickFormatter={(value) => formatDateLabel(value)}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#8a6d56" }}
                      axisLine={{ stroke: "#ecdccf" }}
                      tickLine={false}
                      tickFormatter={(value) => formatCompactCurrency(value)}
                    />
                    <ReferenceLine y={0} stroke="#8a6d56" strokeWidth={1} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      formatter={legendFormatter}
                      wrapperStyle={{ paddingBottom: "20px", fontSize: "12px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="inflow"
                      name="Cash Inflow"
                      stroke={INFLOW_COLOR}
                      fillOpacity={1}
                      fill="url(#colorInflow)"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                    <Area
                      type="monotone"
                      dataKey="outflow"
                      name="Cash Outflow"
                      stroke={OUTFLOW_COLOR}
                      fillOpacity={1}
                      fill="url(#colorOutflow)"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-2xl border border-dashed border-[#ecdccf] bg-[#fffaf5] px-4 text-center text-sm text-[#5f5144]">
                No cash flow activity recorded for this period yet.
              </div>
            )}
            <p className="text-xs text-[#8a6d56]">
              Includes direct sale receipts, invoice collections, paid purchase
              amounts, and recorded expenses.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
