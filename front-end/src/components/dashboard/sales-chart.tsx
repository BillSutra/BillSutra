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
import { fetchDashboardSales, type DashboardSales } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fallbackSales: DashboardSales = {
  last7Days: [],
  last30Days: [],
  monthly: [],
  categories: [],
};

const chartColors = [
  "#f97316",
  "#0f766e",
  "#f59e0b",
  "#1e293b",
  "#fb7185",
  "#8b5cf6",
  "#ec4899",
];

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

const formatCompactCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const SalesChart = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "sales"],
    queryFn: fetchDashboardSales,
  });

  const salesData = data ?? fallbackSales;
  const sales7Total = salesData.last7Days.reduce((sum, item) => sum + item.sales, 0);
  const purchases7Total = salesData.last7Days.reduce(
    (sum, item) => sum + item.purchases,
    0,
  );
  const sales30Total = salesData.last30Days.reduce(
    (sum, item) => sum + item.sales,
    0,
  );
  const purchases30Total = salesData.last30Days.reduce(
    (sum, item) => sum + item.purchases,
    0,
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="dashboard-chart-metric rounded-2xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a6d56]">
                  Last 7 days
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                  {formatCurrency(sales7Total)} sales
                </p>
                <p className="text-xs text-[#8a6d56]">
                  {formatCurrency(purchases7Total)} purchases
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#8a6d56]">
                  Last 30 days
                </p>
                <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                  {formatCurrency(sales30Total)} sales
                </p>
                <p className="text-xs text-[#8a6d56]">
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
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <Legend />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchases"
                        name="Purchases"
                        stroke="#0f766e"
                        strokeWidth={2}
                        dot={{ r: 2 }}
                        activeDot={{ r: 5 }}
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
                        tickFormatter={(value) =>
                          new Date(value).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#8a6d56" }}
                        tickFormatter={(value) => formatCompactCurrency(value)}
                      />
                      <Legend />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        name="Sales"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="purchases"
                        name="Purchases"
                        stroke="#0f766e"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
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
          </CardHeader>
          <CardContent className="dashboard-chart-content">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData.monthly}>
                  <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => formatTooltipValue(value)} />
                  <Legend />
                  <Bar dataKey="sales" fill="#f97316" radius={[6, 6, 0, 0]} />
                  <Bar
                    dataKey="purchases"
                    fill="#0f766e"
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
          </CardHeader>
          <CardContent className="dashboard-chart-content">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesData.categories}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={70}
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
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SalesChart;
