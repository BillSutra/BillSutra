"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, fetchDashboardInventory } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageSearch } from "lucide-react";

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

type RiskAlert = {
    product_id: number;
    product_name: string;
    stock_left: number;
    predicted_daily_sales: number;
    days_until_stockout: number;
    recommended_reorder_quantity: number;
    alert_level: "critical" | "warning" | "normal";
};

type RiskAlertsResponse = {
    data: {
        alerts: RiskAlert[];
        count: number;
    };
};

const getAlertColor = (
    alertLevel: "critical" | "warning" | "normal",
): string => {
    switch (alertLevel) {
        case "critical":
            return "border border-red-200 bg-[linear-gradient(135deg,rgba(254,242,242,0.96),rgba(255,255,255,0.95))]";
        case "warning":
            return "border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.95))]";
        default:
            return "border border-[#ecdccf] bg-white/90";
    }
};

const getAlertBadgeColor = (
    alertLevel: "critical" | "warning" | "normal",
): string => {
    switch (alertLevel) {
        case "critical":
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
        case "warning":
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100";
    }
};

const getAlertLabel = (alert: RiskAlert): string => {
    if (alert.stock_left === 0) {
        return "Out of Stock";
    }
    return alert.alert_level;
};

const InventoryRiskAlerts = ({ className }: { className?: string }) => {
    const { data: inventoryData } = useQuery({
        queryKey: ["dashboard", "inventory"],
        queryFn: fetchDashboardInventory,
    });

    const { data, isLoading, isError } = useQuery({
        queryKey: ["inventory-demand", "alerts"],
        queryFn: async () => {
            const response = await apiClient.get<RiskAlertsResponse>(
                "/inventory-demand/alerts",
            );
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: true,
        refetchInterval: 10 * 60 * 1000, // 10 minutes
    });

    const alerts = data?.data.alerts || [];
    const outOfStockCount = alerts.filter((alert) => alert.stock_left === 0).length;
    const lowStockCount = alerts.filter((alert) => alert.stock_left > 0).length;

    return (
        <Card className={`dashboard-chart-surface flex flex-col gap-0 rounded-[1.75rem] ${className}`}>
            <CardHeader className="dashboard-chart-content gap-2">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#b45309]">
                        <PackageSearch size={18} />
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
                            Stock watch
                        </p>
                        <CardTitle className="mt-1 text-lg text-[#1f1b16]">
                            Inventory risk alerts
                        </CardTitle>
                    </div>
                </div>
                <p className="text-sm text-[#8a6d56]">
                    Products that need attention
                </p>
            </CardHeader>
            <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5">
                {inventoryData && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Total products", value: inventoryData.totalProducts },
                            {
                                label: "Low stock",
                                value: alerts.length > 0 ? lowStockCount : inventoryData.lowStock,
                            },
                            {
                                label: "Out of stock",
                                value: alerts.length > 0
                                    ? outOfStockCount
                                    : inventoryData.outOfStock,
                            },
                            {
                                label: "Inventory value",
                                value: formatCurrency(inventoryData.inventoryValue),
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="dashboard-chart-metric rounded-2xl p-4"
                            >
                                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                                    {item.label}
                                </p>
                                <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {isLoading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-20 animate-pulse rounded-2xl bg-[#fdf7f1]"
                            />
                        ))}
                    </div>
                )}

                {isError && (
                    <p className="text-sm text-[#b45309]">
                        Failed to load inventory alerts
                    </p>
                )}

                {!isLoading && !isError && alerts.length === 0 && (
                    <div className="rounded-2xl border border-[#f2e6dc] bg-white/85 px-4 py-6 text-center">
                        <p className="text-sm text-[#8a6d56]">
                            No products at risk. Inventory levels are healthy.
                        </p>
                    </div>
                )}

                {!isLoading && !isError && alerts.length > 0 && (
                    <div className="grid flex-1 gap-3 overflow-auto pr-1">
                        {alerts.map((alert) => (
                            <div
                                key={alert.product_id}
                                className={`rounded-2xl p-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.32)] ${getAlertColor(alert.alert_level)}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-[#1f1b16]">
                                                {alert.product_name}
                                            </h3>
                                            <span
                                                className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${getAlertBadgeColor(alert.alert_level)}`}
                                            >
                                                {getAlertLabel(alert)}
                                            </span>
                                        </div>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                                                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                                                    Stock Left
                                                </p>
                                                <p className="mt-1 font-semibold text-[#1f1b16]">
                                                    {alert.stock_left} units
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                                                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                                                    Daily Sales
                                                </p>
                                                <p className="mt-1 font-semibold text-[#1f1b16]">
                                                    {alert.predicted_daily_sales.toFixed(1)} units
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                                                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                                                    Days Until Stockout
                                                </p>
                                                <p className="mt-1 font-semibold text-[#1f1b16]">
                                                    {alert.days_until_stockout === 999
                                                        ? "N/A"
                                                        : `${alert.days_until_stockout} days`}
                                                </p>
                                            </div>
                                            <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                                                <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                                                    Reorder Qty
                                                </p>
                                                <p className="mt-1 font-semibold text-[#1f1b16]">
                                                    {alert.recommended_reorder_quantity} units
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default InventoryRiskAlerts;
