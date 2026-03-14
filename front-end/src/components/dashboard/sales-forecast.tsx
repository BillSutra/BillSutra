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
        <div className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 flex flex-col ${className}`}>
            <div className="flex flex-col flex-1 gap-4 min-h-0">
                {/* Header */}
                <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        Sales Forecast
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Historical revenue and predicted sales trends
                    </p>
                </div>

                {/* Period Toggle */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        {(["weekly", "monthly", "yearly"] as const).map((p) => (
                            <Button
                                key={p}
                                variant={period === p ? "default" : "outline"}
                                size="sm"
                                onClick={() => setPeriod(p)}
                                className="capitalize"
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
                        className="text-xs"
                    >
                        {isLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-gray-500">Loading forecast...</p>
                        </div>
                    ) : error ? (
                        <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-red-500">
                                Failed to load forecast data
                            </p>
                        </div>
                    ) : chartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-gray-500">No data available</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    style={{ fontSize: "12px" }}
                                    tick={{ fill: "#9ca3af" }}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    style={{ fontSize: "12px" }}
                                    tick={{ fill: "#9ca3af" }}
                                    tickFormatter={formatCurrency}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#fff",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "0.5rem",
                                    }}
                                    labelStyle={{ color: "#000" }}
                                    formatter={(value: any, name: any) => [
                                        formatCurrency(value),
                                        name === "revenue" ? "Historical Revenue" : "Predicted Revenue",
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
                                    strokeWidth={2}
                                    dot={false}
                                    name="Historical Revenue"
                                    isAnimationActive={false}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="forecast"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false}
                                    name="Predicted Revenue"
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
                                className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                            >
                                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                                    {stat.label}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
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
