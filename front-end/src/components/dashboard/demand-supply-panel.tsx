"use client";

import { AlertTriangle, ArrowUpRight, Boxes, Sparkles } from "lucide-react";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import {
  useForecastSales,
  useInventoryDemandPredictions,
} from "@/hooks/usePredictionQueries";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const DemandSupplyPanel = () => {
  const { currency, dateWithYear, number } = useDashboardFormatters();
  const forecastQuery = useForecastSales();
  const predictionsQuery = useInventoryDemandPredictions({ limit: 8 });

  const predictions = predictionsQuery.data?.predictions ?? [];
  const riskItems = predictions.filter((item) => item.alert_level !== "normal");
  const trendPercent = forecastQuery.data?.sales.trailing30Days.trendPercent ?? 0;
  const risingDemandAndRisk = trendPercent > 0 && riskItems.length > 0;
  const totalReorderValue = riskItems.reduce(
    (sum, item) => sum + item.recommended_reorder_quantity * item.unit_cost,
    0,
  );

  const metadataTime = predictionsQuery.data?.metadata?.generatedAt
    ? new Date(predictionsQuery.data.metadata.generatedAt).getTime()
    : 0;
  const dataUpdatedAt = Math.max(
    metadataTime,
    forecastQuery.dataUpdatedAt || 0,
    predictionsQuery.dataUpdatedAt || 0,
  );

  return (
    <section className="dashboard-chart-surface rounded-[1.75rem]">
      <div className="dashboard-chart-content flex h-full flex-col gap-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3 text-sky-700">
              <Boxes size={18} />
            </div>
            <div>
              <p className="app-kicker">Demand vs supply</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">
                Forecast movement mapped to inventory risk
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Surface forecast-led shortages here so the dashboard can stay focused on execution.
              </p>
            </div>
          </div>
          <DashboardCardStatus
            isLoading={forecastQuery.isLoading || predictionsQuery.isLoading}
            isFetching={forecastQuery.isFetching || predictionsQuery.isFetching}
            isError={forecastQuery.isError || predictionsQuery.isError}
            dataUpdatedAt={dataUpdatedAt}
            refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3">
            <div
              className={`rounded-2xl border px-4 py-4 ${
                risingDemandAndRisk
                  ? "border-amber-200 bg-amber-50/70"
                  : "border-border bg-card/80"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-2xl p-2 ${
                    risingDemandAndRisk
                      ? "bg-white text-amber-700"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {risingDemandAndRisk ? (
                    <AlertTriangle size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {risingDemandAndRisk
                      ? "Combined supply alert"
                      : "Forecast and inventory are balanced"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {risingDemandAndRisk
                      ? `Sales trend is up ${number(trendPercent, {
                          maximumFractionDigits: 1,
                        })}% and ${riskItems.length} product${riskItems.length === 1 ? "" : "s"} already need restock planning.`
                      : "No forecast-led stock pressure is currently elevated enough to merge into a combined alert."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Forecast trend
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {trendPercent >= 0 ? "+" : ""}
                  {number(trendPercent, { maximumFractionDigits: 1 })}%
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  At-risk SKUs
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {number(riskItems.length)}
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Suggested spend
                </p>
                <p className="mt-2 text-xl font-semibold text-foreground">
                  {currency(totalReorderValue)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {riskItems.length === 0 ? (
              <div className="app-empty-state px-4 py-10 text-sm">
                No demand-driven supply risks are currently open.
              </div>
            ) : (
              riskItems.map((item) => (
                <div
                  key={`${item.warehouse_id ?? "all"}-${item.product_id}`}
                  className="app-list-item flex flex-col gap-3 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.product_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.stock_left} left | {item.predicted_daily_sales.toFixed(1)} / day | confidence{" "}
                        {number(item.confidence * 100, { maximumFractionDigits: 0 })}%
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <ArrowUpRight size={12} />
                      {item.alert_level}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Runout
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {item.days_until_stockout >= 999
                          ? "Not projected"
                          : dateWithYear(
                              new Date(
                                Date.now() +
                                  item.days_until_stockout * 24 * 60 * 60 * 1000,
                              ),
                            )}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Reorder qty
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {number(item.recommended_reorder_quantity)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        Reorder value
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {currency(item.recommended_reorder_quantity * item.unit_cost)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemandSupplyPanel;
