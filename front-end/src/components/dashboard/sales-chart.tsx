"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  fetchDashboardSales,
  type DashboardOverviewFilters,
  type DashboardSales,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDateLabel,
  sumBy,
} from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const fallbackSales: DashboardSales = {
  last7Days: [],
  last30Days: [],
  monthly: [],
  categories: [],
};

const SALES_COLOR = "#15803d";
const PURCHASES_COLOR = "#f97316";

const chartColors = [
  SALES_COLOR,
  PURCHASES_COLOR,
  "#f59e0b",
  "#1e293b",
  "#fb7185",
  "#8b5cf6",
  "#ec4899",
];

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

const legendFormatter = (value: string) => (
  <span className="text-sm font-medium text-[#5c4331]">{value}</span>
);

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[#ecdccf] bg-white/95 p-3 shadow-xl">
      <p className="text-sm font-semibold text-[#1f1b16]">
        {label ? formatDateLabel(label) : ""}
      </p>
      <div className="mt-2 space-y-1.5">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs font-medium text-[#5f5144]">
                {entry.name}
              </span>
            </div>
            <span className="text-sm font-semibold text-[#1f1b16]">
              {formatTooltipValue(entry.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const SalesChart = ({ filters }: { filters?: DashboardOverviewFilters }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "sales", filters],
    queryFn: () => fetchDashboardSales(filters),
    ...dashboardQueryDefaults,
  });

  const salesData = data ?? fallbackSales;
  const sales7Total = sumBy(salesData.last7Days, (item) => item.sales);
  const purchases7Total = sumBy(salesData.last7Days, (item) => item.purchases);
  const sales30Total = sumBy(salesData.last30Days, (item) => item.sales);
  const purchases30Total = sumBy(
    salesData.last30Days,
    (item) => item.purchases,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
      <Card className="dashboard-chart-surface rounded-[1.75rem]">
        <CardHeader className="dashboard-chart-content">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
                Trade pulse
              </p>
              <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
                Sales and purchase analytics
              </CardTitle>
              <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
                Compare booked sales against purchase activity to spot demand
                bursts and stocking pressure.
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="dashboard-chart-metric rounded-2xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a6d56]">
                  Last 7 days
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatCurrency(sales7Total)} sales
                </p>
                <p className="text-xs text-orange-600">
                  {formatCurrency(purchases7Total)} purchases
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a6d56]">
                  Last 30 days
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatCurrency(sales30Total)} sales
                </p>
                <p className="text-xs text-orange-600">
                  {formatCurrency(purchases30Total)} purchases
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="dashboard-chart-content grid gap-6">
          {isLoading && (
            <div className="h-48 rounded-xl bg-[#fdf7f1] animate-pulse" />
          )}
          {isError && (
            <p className="text-sm text-[#b45309]">Unable to load sales data.</p>
          )}
          {!isLoading && !isError && (
            <div className="grid gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Last 7 days
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData.last7Days}>
                      <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatDateLabel(value)}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <Legend
                        iconType="circle"
                        formatter={legendFormatter}
                        wrapperStyle={{ paddingBottom: "10px" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke={SALES_COLOR}
                        strokeWidth={3}
                        strokeLinecap="round"
                        dot={{
                          r: 2.5,
                          strokeWidth: 2,
                          fill: SALES_COLOR,
                          stroke: "#ffffff",
                        }}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          fill: SALES_COLOR,
                          stroke: "#ffffff",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchases"
                        name="Purchases"
                        stroke={PURCHASES_COLOR}
                        strokeWidth={3}
                        strokeLinecap="round"
                        dot={{
                          r: 2.5,
                          strokeWidth: 2,
                          fill: PURCHASES_COLOR,
                          stroke: "#ffffff",
                        }}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          fill: PURCHASES_COLOR,
                          stroke: "#ffffff",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Last 30 days
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData.last30Days}>
                      <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatDateLabel(value)}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <Legend
                        iconType="circle"
                        formatter={legendFormatter}
                        wrapperStyle={{ paddingBottom: "10px" }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke={SALES_COLOR}
                        strokeWidth={3}
                        strokeLinecap="round"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          fill: SALES_COLOR,
                          stroke: "#ffffff",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchases"
                        name="Purchases"
                        stroke={PURCHASES_COLOR}
                        strokeWidth={3}
                        strokeLinecap="round"
                        dot={false}
                        activeDot={{
                          r: 5,
                          strokeWidth: 2,
                          fill: PURCHASES_COLOR,
                          stroke: "#ffffff",
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="dashboard-chart-surface rounded-[1.75rem]">
          <CardHeader className="dashboard-chart-content">
            <CardTitle className="text-base text-[#1f1b16]">
              Six-month trade balance
            </CardTitle>
            <p className="text-sm text-[#8a6d56]">
              Monthly sales and purchase movement across the latest six months.
            </p>
            <DashboardCardStatus
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
            />
          </CardHeader>
          <CardContent className="dashboard-chart-content">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.monthly}>
                  <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  <Legend
                    iconType="circle"
                    formatter={legendFormatter}
                    wrapperStyle={{ paddingTop: "8px" }}
                  />
                  <Bar
                    dataKey="sales"
                    fill={SALES_COLOR}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="purchases"
                    fill={PURCHASES_COLOR}
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-chart-surface rounded-[1.75rem]">
          <CardHeader className="dashboard-chart-content">
            <CardTitle className="text-base text-[#1f1b16]">
              Category revenue mix
            </CardTitle>
            <p className="text-sm text-[#8a6d56]">
              Top categories ranked by booked sales value.
            </p>
            <DashboardCardStatus
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
            />
          </CardHeader>
          <CardContent className="dashboard-chart-content">
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesData.categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={64}
                    paddingAngle={3}
                  >
                    {salesData.categories.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {salesData.categories.map((entry, index) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-2 text-sm font-medium text-[#5c4331]"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full"
                    style={{
                      backgroundColor: chartColors[index % chartColors.length],
                    }}
                  />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalesChart;
