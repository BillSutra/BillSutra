"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, PackageSearch, ShoppingCart } from "lucide-react";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import { Button } from "@/components/ui/button";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import {
  useForecastSales,
  useInventoryDemandPredictions,
} from "@/hooks/usePredictionQueries";

const InventoryRiskSummaryBanner = () => {
  const { currency, number } = useDashboardFormatters();
  const predictionsQuery = useInventoryDemandPredictions();
  const forecastQuery = useForecastSales();

  const predictions = predictionsQuery.data?.predictions ?? [];
  const metadataTime = predictionsQuery.data?.metadata?.generatedAt
    ? new Date(predictionsQuery.data.metadata.generatedAt).getTime()
    : 0;
  const dataUpdatedAt = Math.max(
    predictionsQuery.dataUpdatedAt || 0,
    forecastQuery.dataUpdatedAt || 0,
    metadataTime,
  );

  const criticalCount = predictions.filter(
    (prediction) => prediction.alert_level === "critical",
  ).length;
  const stockoutsSoonCount = predictions.filter(
    (prediction) =>
      prediction.stock_left <= 0 || prediction.days_until_stockout <= 3,
  ).length;
  const totalReorderValue = predictions.reduce(
    (sum, prediction) =>
      sum + prediction.recommended_reorder_quantity * prediction.unit_cost,
    0,
  );

  const forecastTrend = forecastQuery.data?.sales.trailing30Days.trendPercent ?? 0;
  const hasCombinedAlert = forecastTrend > 0 && stockoutsSoonCount > 0;

  return (
    <section className="dashboard-chart-surface rounded-[1.75rem] border border-amber-200/80 bg-amber-50/95 shadow-[0_16px_34px_-26px_rgba(245,158,11,0.14)] dark:border-amber-500/20 dark:bg-zinc-900">
      <div className="dashboard-chart-content flex flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-amber-200 bg-white p-3 text-amber-600 shadow-[0_10px_22px_-18px_rgba(245,158,11,0.18)] dark:border-amber-500/20 dark:bg-zinc-800 dark:text-amber-300">
              <PackageSearch size={18} />
            </div>
            <div>
              <p className="app-kicker">Inventory risk summary</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground dark:text-white">
                Predictive restock signals for the next few days
              </h3>
              <p className="mt-1 text-sm text-muted-foreground dark:text-zinc-400">
                {hasCombinedAlert
                  ? `Demand is rising ${number(forecastTrend, {
                      maximumFractionDigits: 1,
                    })}% while ${stockoutsSoonCount} SKU${stockoutsSoonCount === 1 ? "" : "s"} could stock out inside three days.`
                  : "Keep the dashboard operational while routing heavier planning decisions into inventory and purchase workflows."}
              </p>
            </div>
          </div>
          <DashboardCardStatus
            isLoading={predictionsQuery.isLoading || forecastQuery.isLoading}
            isFetching={predictionsQuery.isFetching || forecastQuery.isFetching}
            isError={predictionsQuery.isError || forecastQuery.isError}
            dataUpdatedAt={dataUpdatedAt}
            refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-zinc-400">
              Critical SKUs
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground dark:text-white">
              {number(criticalCount)}
            </p>
          </div>
          <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-zinc-400">
              Stockouts &lt; 3 days
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground dark:text-white">
              {number(stockoutsSoonCount)}
            </p>
          </div>
          <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:text-zinc-400">
              Total reorder value
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground dark:text-white">
              {currency(totalReorderValue)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <Link href="/inventory">
              Open Inventory
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/purchases/new">
              <ShoppingCart size={16} />
              Create Purchase
            </Link>
          </Button>
          <Button asChild>
            <Link href="/insights#demand-supply">
              <AlertTriangle size={16} />
              Review Risks
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default InventoryRiskSummaryBanner;
