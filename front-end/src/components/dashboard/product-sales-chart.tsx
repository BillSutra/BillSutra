"use client";

import React, { useState } from "react";
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

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border border-[#ecdccf] bg-white p-3 shadow-sm">
        <p className="font-semibold text-[#1f1b16] mb-1">{label}</p>
        <p className="text-sm text-[#0f766e]">
          Units Sold: <span className="font-medium">{data.quantity}</span>
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
  const [period, setPeriod] = useState<"lifetime" | "month" | "week" | "year">("lifetime");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "productSales", period],
    queryFn: () => fetchDashboardProductSales(period),
  });

  const totalUnits = (data?.products ?? []).reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
  const totalRevenue = (data?.products ?? []).reduce(
    (sum, item) => sum + item.revenue,
    0,
  );

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <div className="flex bg-[#fdf7f1] p-1 rounded-lg border border-[#ecdccf]">
            <Button
              variant={period === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod("week")}
              className={`h-7 px-3 text-xs ${
                period === "week"
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              }`}
            >
              This Week
            </Button>
            <Button
              variant={period === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod("month")}
              className={`h-7 px-3 text-xs ${
                period === "month"
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              }`}
            >
              This Month
            </Button>
            <Button
              variant={period === "year" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod("year")}
              className={`h-7 px-3 text-xs ${
                period === "year"
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              }`}
            >
              This Year
            </Button>
            <Button
              variant={period === "lifetime" ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod("lifetime")}
              className={`h-7 px-3 text-xs ${
                period === "lifetime"
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              }`}
            >
              Lifetime
            </Button>
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
                {totalUnits.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="dashboard-chart-metric rounded-2xl p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                Revenue captured
              </p>
              <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </div>
        )}
        {isLoading && (
          <div className="h-64 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <div className="h-64 flex items-center justify-center rounded-xl bg-[#fdf7f1]">
            <p className="text-sm text-[#b45309]">Unable to load sales data.</p>
          </div>
        )}
        {!isLoading && !isError && data && (
          <>
            {data.products.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-xl bg-[#fdf7f1] border border-dashed border-[#ecdccf]">
                <p className="text-sm text-[#8a6d56]">No products sold during this period.</p>
              </div>
            ) : (
            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.products} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#8a6d56" }}
                      tickLine={false}
                      axisLine={{ stroke: "#ecdccf" }}
                      interval={0}
                      tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
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
            <p className="mt-4 text-xs text-center text-[#8a6d56]">
              Showing top {Math.min(15, data.products.length)} products by units sold
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ProductSalesChart;
