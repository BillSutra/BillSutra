"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardInventory,
  type InventoryDemandPrediction,
} from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageSearch } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useI18n } from "@/providers/LanguageProvider";
import { useInventoryDemandPredictions } from "@/hooks/usePredictionQueries";

const getAlertColor = (alertLevel: "critical" | "warning" | "normal"): string => {
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

const getAlertLabel = (
  alert: InventoryDemandPrediction,
  labels: Record<"critical" | "warning" | "normal", string>,
  outOfStockLabel: string,
): string => {
  if (alert.stock_left === 0) {
    return outOfStockLabel;
  }
  return labels[alert.alert_level];
};

const InventoryRiskAlerts = ({ className }: { className?: string }) => {
  const { t } = useI18n();
  const { data: inventoryData } = useQuery({
    queryKey: ["dashboard", "inventory"],
    queryFn: fetchDashboardInventory,
    ...dashboardQueryDefaults,
  });

  const { data, isLoading, isError, dataUpdatedAt, isFetching } =
    useInventoryDemandPredictions({
      limit: 5,
    });

  const alerts = (data?.predictions ?? []).filter(
    (alert) => alert.alert_level !== "normal",
  );

  const statusUpdatedAt = dataUpdatedAt || (data?.metadata?.generatedAt
    ? new Date(data.metadata.generatedAt).getTime()
    : 0);

  const outOfStockCount = alerts.filter((alert) => alert.stock_left === 0).length;
  const lowStockCount = alerts.filter((alert) => alert.stock_left > 0).length;
  const alertLevelLabels = {
    critical: t("dashboard.inventoryRisk.critical"),
    warning: t("dashboard.inventoryRisk.warning"),
    normal: t("dashboard.inventoryRisk.normal"),
  } as const;

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col gap-0 rounded-[1.75rem] ${className}`}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#b45309]">
            <PackageSearch size={18} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#8a6d56]">
              {t("dashboard.inventoryRisk.kicker")}
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              {t("dashboard.inventoryRisk.title")}
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#8a6d56]">{t("dashboard.inventoryRisk.description")}</p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={statusUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5">
        {inventoryData && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: t("dashboard.inventoryRisk.totalProducts"),
                value: formatNumber(inventoryData.totalProducts),
              },
              {
                label: t("dashboard.inventoryRisk.lowStock"),
                value:
                  alerts.length > 0
                    ? formatNumber(lowStockCount)
                    : formatNumber(inventoryData.lowStock),
              },
              {
                label: t("dashboard.inventoryRisk.outOfStock"),
                value:
                  alerts.length > 0
                    ? formatNumber(outOfStockCount)
                    : formatNumber(inventoryData.outOfStock),
              },
              {
                label: t("dashboard.inventoryRisk.inventoryValue"),
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
          <p className="text-sm text-[#b45309]">{t("dashboard.inventoryRisk.loadError")}</p>
        )}

        {!isLoading && !isError && alerts.length === 0 && (
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/85 px-4 py-6 text-center">
            <p className="text-sm text-[#8a6d56]">
              {t("dashboard.inventoryRisk.empty")}
            </p>
          </div>
        )}

        {!isLoading && !isError && alerts.length > 0 && (
          <div className="grid flex-1 gap-3 overflow-auto pr-1">
            {alerts.map((alert) => (
              <div
                key={alert.product_id}
                className={`rounded-2xl p-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.32)] ${getAlertColor(
                  alert.alert_level,
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#1f1b16]">
                        {alert.product_name}
                      </h3>
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${getAlertBadgeColor(
                          alert.alert_level,
                        )}`}
                      >
                        {getAlertLabel(
                          alert,
                          alertLevelLabels,
                          t("dashboard.inventoryRisk.outOfStockBadge"),
                        )}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {t("dashboard.inventoryRisk.stockLeft")}
                        </p>
                        <p className="mt-1 font-semibold text-[#1f1b16]">
                          {t("dashboard.inventoryRisk.units", {
                            count: formatNumber(alert.stock_left),
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {t("dashboard.inventoryRisk.dailySales")}
                        </p>
                        <p className="mt-1 font-semibold text-[#1f1b16]">
                          {t("dashboard.inventoryRisk.units", {
                            count: alert.predicted_daily_sales.toFixed(1),
                          })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {t("dashboard.inventoryRisk.daysUntilStockout")}
                        </p>
                        <p className="mt-1 font-semibold text-[#1f1b16]">
                          {alert.days_until_stockout === 999
                            ? t("dashboard.inventoryRisk.notAvailable")
                            : t("dashboard.inventoryRisk.days", {
                                count: formatNumber(alert.days_until_stockout),
                              })}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {t("dashboard.inventoryRisk.reorderQty")}
                        </p>
                        <p className="mt-1 font-semibold text-[#1f1b16]">
                          {t("dashboard.inventoryRisk.units", {
                            count: formatNumber(alert.recommended_reorder_quantity),
                          })}
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
