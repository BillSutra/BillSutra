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

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const formatTooltipValue = (value: unknown) => {
  if (typeof value === "number") {
    return formatCurrency(value);
  }
  return formatCurrency(0);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#ecdccf] bg-white p-3 shadow-xl ring-1 ring-black/5">
        <p className="font-semibold text-[#1f1b16] mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-[#8a6d56] capitalize">
                  {entry.name}
                </span>
              </div>
              <span className="text-sm font-bold text-[#1f1b16]">
                {formatCurrency(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CashFlowChart = ({ className }: { className?: string }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "cashflow"],
    queryFn: fetchDashboardCashflow,
  });

  const net = data?.netCashFlow ?? 0;
  const netClass =
    net > 0 ? "text-green-700" : net < 0 ? "text-red-700" : "text-amber-700";

  return (
    <Card className={`border-[#ecdccf] bg-white/90 flex flex-col ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Cash flow summary</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 gap-6 min-h-0">
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
                  className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
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

            <div className="flex-1 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f766e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f2e6dc" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#8a6d56" }}
                    axisLine={{ stroke: "#ecdccf" }}
                    tickLine={false}
                    dy={10}
                    interval={0}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#8a6d56" }}
                    axisLine={{ stroke: "#ecdccf" }}
                    tickLine={false}
                    tickFormatter={(value) => `₹${value / 1000}k`}
                  />
                  <ReferenceLine y={0} stroke="#8a6d56" strokeWidth={1} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="inflow"
                    name="Cash Inflow"
                    stroke="#0f766e"
                    fillOpacity={1}
                    fill="url(#colorInflow)"
                    strokeWidth={3}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    name="Cash Outflow"
                    stroke="#f97316"
                    fillOpacity={1}
                    fill="url(#colorOutflow)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
