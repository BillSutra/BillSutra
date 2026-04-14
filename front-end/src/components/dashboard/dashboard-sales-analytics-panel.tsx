"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchDashboardSales,
  type DashboardOverviewFilters,
  type DashboardSales,
} from "@/lib/apiClient";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import DashboardResponsiveChart from "@/components/dashboard/DashboardResponsiveChart";
import {
  DASHBOARD_REFRESH_INTERVAL_MS,
  dashboardQueryDefaults,
} from "@/lib/dashboardRefresh";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";
import { cn } from "@/lib/utils";
import { ArrowRight, Lightbulb } from "lucide-react";

type DashboardSalesAnalyticsPanelProps = {
  filters?: DashboardOverviewFilters;
  lowStockCount: number;
  overdueInvoiceCount: number;
  pendingCustomerDue: number;
  pendingSupplierDue: number;
  supplierPayablesCount: number;
  previewData?: DashboardSales;
};

type SalesWindow = "last7Days" | "last30Days" | "monthly";

type SalesChartPoint = {
  label: string;
  sales: number;
  purchases: number;
};

const DashboardSalesAnalyticsPanel = ({
  filters,
  lowStockCount,
  overdueInvoiceCount,
  pendingCustomerDue,
  pendingSupplierDue,
  supplierPayablesCount,
  previewData,
}: DashboardSalesAnalyticsPanelProps) => {
  const { t, language } = useI18n();
  const [window, setWindow] = useState<SalesWindow>("last30Days");

  const { data, isLoading, isFetching, isError, dataUpdatedAt } = useQuery({
    queryKey: ["dashboard", "sales-analytics", filters],
    queryFn: () => fetchDashboardSales(filters),
    enabled: !previewData,
    initialData: previewData,
    ...dashboardQueryDefaults,
  });

  const locale = language === "hi" ? "hi-IN" : "en-IN";
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const currency = useCallback(
    (value: number) => numberFormatter.format(value || 0),
    [numberFormatter],
  );

  const windowOptions: Array<{ id: SalesWindow; label: string }> = [
    { id: "last7Days", label: t("dashboard.salesChart.last7Days") },
    { id: "last30Days", label: t("dashboard.salesChart.last30Days") },
    { id: "monthly", label: t("dashboard.analyticsPanel.monthly") },
  ];

  const chartData = useMemo<SalesChartPoint[]>(() => {
    if (!data) return [];

    if (window === "monthly") {
      return data.monthly.map((item) => ({
        label: item.month,
        sales: item.sales,
        purchases: item.purchases,
      }));
    }

    const source = window === "last7Days" ? data.last7Days : data.last30Days;
    return source.map((item) => ({
      label: item.date,
      sales: item.sales,
      purchases: item.purchases,
    }));
  }, [data, window]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, item) => {
        acc.sales += item.sales;
        acc.purchases += item.purchases;
        return acc;
      },
      { sales: 0, purchases: 0 },
    );
  }, [chartData]);

  const netFlow = totals.sales - totals.purchases;

  const smartInsight = useMemo(() => {
    if (lowStockCount > 0) {
      return t("dashboard.analyticsPanel.smartInsightInventory", {
        count: lowStockCount,
      });
    }

    if (overdueInvoiceCount > 0 || pendingCustomerDue > 0) {
      return t("dashboard.analyticsPanel.smartInsightCollections", {
        count: overdueInvoiceCount,
        amount: currency(pendingCustomerDue),
      });
    }

    if (supplierPayablesCount > 0 || pendingSupplierDue > 0) {
      return t("dashboard.analyticsPanel.smartInsightSupplier", {
        count: supplierPayablesCount,
        amount: currency(pendingSupplierDue),
      });
    }

    return t("dashboard.analyticsPanel.smartInsightHealthy");
  }, [
    currency,
    lowStockCount,
    overdueInvoiceCount,
    pendingCustomerDue,
    pendingSupplierDue,
    supplierPayablesCount,
    t,
  ]);

  const riskCards = [
    {
      label: t("dashboard.analyticsPanel.riskCards.lowStock"),
      value: lowStockCount,
      helper: t("dashboard.analyticsPanel.riskCards.lowStockHelper"),
    },
    {
      label: t("dashboard.analyticsPanel.riskCards.overdue"),
      value: overdueInvoiceCount,
      helper: t("dashboard.analyticsPanel.riskCards.overdueHelper"),
    },
    {
      label: t("dashboard.analyticsPanel.riskCards.customerDue"),
      value: currency(pendingCustomerDue),
      helper: t("dashboard.analyticsPanel.riskCards.customerDueHelper"),
    },
    {
      label: t("dashboard.analyticsPanel.riskCards.supplierDue"),
      value: currency(pendingSupplierDue),
      helper: t("dashboard.analyticsPanel.riskCards.supplierDueHelper"),
    },
  ];

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <section
        className="dashboard-chart-surface rounded-[1.9rem] xl:col-span-8"
        data-testid="dashboard-analytics-panel"
      >
        <div className="dashboard-chart-content p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-kicker">
                {t("dashboard.analyticsPanel.kicker")}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                {t("dashboard.analyticsPanel.title")}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("dashboard.analyticsPanel.description")}
              </p>
            </div>

            <div className="inline-flex rounded-full border border-border bg-card/80 p-1">
              {windowOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={t("dashboard.analyticsPanel.toggleAria")}
                  onClick={() => setWindow(option.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    window === option.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <DashboardCardStatus
              isLoading={isLoading}
              isFetching={isFetching}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
            />
          </div>

          {isLoading ? (
            <div className="mt-5 h-64 app-loading-skeleton" />
          ) : isError ? (
            <p className="mt-5 text-sm text-amber-700 dark:text-amber-200">
              {t("dashboard.salesChart.loadError")}
            </p>
          ) : chartData.length === 0 ? (
            <p className="mt-5 text-sm text-muted-foreground">
              {t("dashboard.salesForecast.empty")}
            </p>
          ) : (
            <>
              <div className="mt-5 h-64">
                <DashboardResponsiveChart>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#e9ddd2" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) => {
                        if (window === "monthly") return value;
                        const parsed = new Date(value);
                        if (Number.isNaN(parsed.getTime())) return value;
                        return parsed.toLocaleDateString(locale, {
                          day: "2-digit",
                          month: "short",
                        });
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) =>
                        new Intl.NumberFormat(locale, {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(Number(value) || 0)
                      }
                    />
                    <Legend />
                    <Tooltip
                      formatter={(value, name) => [
                        currency(Number(value) || 0),
                        String(name) === "sales"
                          ? t("dashboard.salesChart.legendSales")
                          : t("dashboard.salesChart.legendPurchases"),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      name={t("dashboard.salesChart.legendSales")}
                      stroke="#0f766e"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="purchases"
                      name={t("dashboard.salesChart.legendPurchases")}
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </DashboardResponsiveChart>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="dashboard-chart-metric rounded-[1.3rem] px-4 py-4">
                  <p className="app-kicker text-[11px]">
                    {t("dashboard.analyticsPanel.salesTotal")}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {currency(totals.sales)}
                  </p>
                </div>
                <div className="dashboard-chart-metric rounded-[1.3rem] px-4 py-4">
                  <p className="app-kicker text-[11px]">
                    {t("dashboard.analyticsPanel.purchaseTotal")}
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">
                    {currency(totals.purchases)}
                  </p>
                </div>
                <div className="dashboard-chart-metric rounded-[1.3rem] px-4 py-4">
                  <p className="app-kicker text-[11px]">
                    {t("dashboard.analyticsPanel.netFlow")}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-lg font-semibold",
                      netFlow >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {currency(netFlow)}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="mt-5 flex justify-end">
            <Button asChild variant="outline">
              <Link href="/insights">
                {t("dashboard.analyticsPanel.viewDetails")}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <aside className="grid gap-4 xl:col-span-4">
        <div className="rounded-[1.75rem] border border-amber-200/80 bg-amber-50/85 p-5 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-current/20 bg-white/70 p-2 text-current dark:bg-white/10">
              <Lightbulb size={16} />
            </div>
            <div>
              <p className="app-kicker text-[11px] text-current/80">
                {t("dashboard.analyticsPanel.smartInsightTitle")}
              </p>
              <p className="mt-2 text-sm leading-6 text-current/85">
                {smartInsight}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {riskCards.map((card) => (
            <div
              key={card.label}
              className="dashboard-chart-metric rounded-[1.35rem] px-4 py-4"
            >
              <p className="app-kicker text-[11px]">{card.label}</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.helper}
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};

export default DashboardSalesAnalyticsPanel;
