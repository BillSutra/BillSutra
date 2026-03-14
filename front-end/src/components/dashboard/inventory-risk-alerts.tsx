"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient, fetchDashboardInventory } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
            return "border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20";
        case "warning":
            return "border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
        default:
            return "border-l-4 border-gray-300 bg-gray-50 dark:bg-gray-900/20";
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

    return (
        <Card className={`border-[#ecdccf] bg-white/90 flex flex-col ${className}`}>
            <CardHeader>
                <CardTitle className="text-lg">Inventory Risk Alerts</CardTitle>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Products that need attention
                </p>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 gap-4 min-h-0">
                {inventoryData && (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Total products", value: inventoryData.totalProducts },
                            { label: "Low stock", value: inventoryData.lowStock },
                            { label: "Out of stock", value: inventoryData.outOfStock },
                            {
                                label: "Inventory value",
                                value: formatCurrency(inventoryData.inventoryValue),
                            },
                        ].map((item) => (
                            <div
                                key={item.label}
                                className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
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
                                className="h-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
                            />
                        ))}
                    </div>
                )}

                {isError && (
                    <p className="text-sm text-red-500">
                        Failed to load inventory alerts
                    </p>
                )}

                {!isLoading && !isError && alerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <p className="text-sm text-gray-500">
                            No products at risk. Inventory levels are healthy.
                        </p>
                    </div>
                )}

                {!isLoading && !isError && alerts.length > 0 && (
                    <div className="space-y-3 flex-1 overflow-auto pr-1">
                        {alerts.map((alert) => (
                            <div
                                key={alert.product_id}
                                className={`rounded-lg p-4 ${getAlertColor(alert.alert_level)}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {alert.product_name}
                                            </h3>
                                            <span
                                                className={`inline-block px-2 py-1 rounded text-xs font-semibold uppercase ${getAlertBadgeColor(alert.alert_level)}`}
                                            >
                                                {getAlertLabel(alert)}
                                            </span>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    Stock Left
                                                </p>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    {alert.stock_left} units
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    Daily Sales
                                                </p>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    {alert.predicted_daily_sales.toFixed(1)} units
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    Days Until Stockout
                                                </p>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    {alert.days_until_stockout === 999
                                                        ? "N/A"
                                                        : `${alert.days_until_stockout} days`}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-gray-600 dark:text-gray-400">
                                                    Reorder Qty
                                                </p>
                                                <p className="font-semibold text-gray-900 dark:text-white">
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
