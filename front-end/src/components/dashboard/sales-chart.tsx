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

const SalesChart = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "sales"],
    queryFn: fetchDashboardSales,
  });

  const salesData = data ?? fallbackSales;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
      <Card className="border-[#ecdccf] bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Sales analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
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
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
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
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value) => formatTooltipValue(value)}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#0f766e"
                        strokeWidth={2}
                        dot={false}
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
        <Card className="border-[#ecdccf] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">
              Monthly sales vs purchases
            </CardTitle>
          </CardHeader>
          <CardContent>
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

        <Card className="border-[#ecdccf] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Category mix (Top 7)</CardTitle>
          </CardHeader>
          <CardContent>
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
