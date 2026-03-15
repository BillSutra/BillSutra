"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";

type Period = "weekly" | "monthly" | "yearly";

type ForecastResponse = {
    data: {
        historical: Array<{ date: string; revenue: number }>;
        forecast: Array<{ date: string; predicted_revenue: number }>;
        period: Period;
    };
};

type ChartDataPoint = {
    date: string;
    revenue?: number;
    forecast?: number;
};

const SalesForecast = ({ className }: { className?: string }) => {
    const [period, setPeriod] = useState<Period>("monthly");

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["forecast", "sales", period],
        queryFn: async () => {
            const response = await apiClient.get<ForecastResponse>(
                "/forecast/sales",
                {
                    params: { period },
                }
            );
            return response.data;
        },
        staleTime: 0,  // Treat data as stale immediately
        refetchOnWindowFocus: true,  // Refetch when user returns to the tab
        refetchOnMount: true,  // Refetch when component mounts
        refetchInterval: 30000,  // Auto-refetch every 30 seconds
    });

    // Merge historical and forecast data for chart
    const chartData: ChartDataPoint[] = React.useMemo(() => {
        if (!data?.data) return [];

        const merged: Record<string, ChartDataPoint> = {};

        // Add historical data
        data.data.historical.forEach((point) => {
            merged[point.date] = {
                date: point.date,
                revenue: point.revenue,
            };
        });

        // Add forecast data
        data.data.forecast.forEach((point) => {
            if (merged[point.date]) {
                merged[point.date].forecast = point.predicted_revenue;
            } else {
                merged[point.date] = {
                    date: point.date,
                    forecast: point.predicted_revenue,
                };
            }
        });

        return Object.values(merged);
    }, [data]);

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined) return "—";
        return `₹${value.toLocaleString("en-IN")}`;
    };

    const periodLabels: Record<Period, string> = {
        weekly: "Weekly",
        monthly: "Monthly",
        yearly: "Yearly",
    };

    return (
        <div className={`dashboard-chart-surface rounded-[1.75rem] p-5 flex flex-col ${className}`}>
            <div className="dashboard-chart-content flex flex-col flex-1 gap-5 min-h-0">
                {/* Header */}
                <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
                        Forecast studio
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-[#1f1b16]">
                        Sales forecast
                    </p>
                    <p className="mt-2 text-sm text-[#8a6d56]">
                        Historical sales against projected movement for the selected period.
                    </p>
                </div>

                {/* Period Toggle */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#ecdccf] bg-[#fff9f2] p-1">
                        {(["weekly", "monthly", "yearly"] as const).map((p) => (
                            <Button
                                key={p}
                                variant={period === p ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setPeriod(p)}
                                className={`capitalize ${period === p
                                    ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                                    : "text-[#5c4b3b] hover:bg-[#fff2e5] hover:text-[#1f1b16]"
                                    }`}
                            >
                                {periodLabels[p]}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="border-[#ecdccf] bg-white/70 text-xs hover:bg-[#fff2e5]"
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
                            <p className="text-sm text-[#8a6d56]">Loading forecast...</p>
                        </div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
                            <p className="text-sm text-[#b45309]">
                                Failed to load forecast data
                            </p>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center rounded-2xl bg-[#fff9f2]">
                            <p className="text-sm text-[#8a6d56]">No data available</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f2e6dc" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#8a6d56"
                                    style={{ fontSize: "12px" }}
                                    tick={{ fill: "#8a6d56" }}
                                />
                                <YAxis
                                    stroke="#8a6d56"
                                    style={{ fontSize: "12px" }}
                                    tick={{ fill: "#8a6d56" }}
                                    tickFormatter={formatCurrency}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #ecdccf",
                                        borderRadius: "1rem",
                                        boxShadow: "0 18px 40px -28px rgba(15, 23, 42, 0.45)",
                                    }}
                                    labelStyle={{ color: "#1f1b16" }}
                                    formatter={(value: any, name: any) => [
                                        formatCurrency(value),
                                        name === "revenue" ? "Historical Sales" : "Predicted Sales",
                                    ] as any}
                                />
                                <Legend
                                    wrapperStyle={{ paddingTop: "1rem" }}
                                    iconType="line"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={false}
                                    name="Historical Sales"
                                    isAnimationActive={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="forecast"
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Predicted Sales"
                                    isAnimationActive={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Stats */}
                {data?.data && (
                    <div className="grid gap-3 sm:grid-cols-3">
                        {(() => {
                            const historicalTotal = data.data.historical.reduce(
                                (sum, p) => sum + p.revenue,
                                0
                            );
                            const forecastTotal = data.data.forecast.reduce(
                                (sum, p) => sum + p.predicted_revenue,
                                0
                            );
                            const forecastAvg =
                                data.data.forecast.length > 0
                                    ? forecastTotal / data.data.forecast.length
                                    : 0;
                            const historicalAvg =
                                data.data.historical.length > 0
                                    ? historicalTotal / data.data.historical.length
                                    : 0;

                            return [
                                {
                                    label: "Historical Avg",
                                    value: formatCurrency(historicalAvg),
                                },
                                {
                                    label: "Predicted Avg",
                                    value: formatCurrency(forecastAvg),
                                },
                                {
                                    label: "Forecast Periods",
                                    value: data.data.forecast.length,
                                },
                            ];
                        })().map((stat) => (
                            <div
                                key={stat.label}
                                className="dashboard-chart-metric rounded-2xl p-3"
                            >
                                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                                    {stat.label}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                                    {typeof stat.value === "number" ? stat.value : stat.value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesForecast;
