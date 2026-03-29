"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { formatCurrency } from "@/lib/dashboardUtils";
import { useDashboardForecast } from "@/components/dashboard/use-dashboard-forecast";

const toneStyles = {
  positive: {
    icon: CheckCircle2,
    card: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/12 dark:bg-emerald-400/[0.06]",
    iconClass: "text-emerald-600",
  },
  warning: {
    icon: AlertTriangle,
    card: "border-amber-200 bg-amber-50/70 dark:border-amber-400/12 dark:bg-amber-400/[0.06]",
    iconClass: "text-amber-600",
  },
  critical: {
    icon: TrendingDown,
    card: "border-rose-200 bg-rose-50/70 dark:border-rose-400/12 dark:bg-rose-400/[0.06]",
    iconClass: "text-rose-600",
  },
  info: {
    icon: Info,
    card: "border-slate-200 bg-slate-50/70 dark:border-white/8 dark:bg-white/[0.03]",
    iconClass: "text-slate-600",
  },
} as const;

const ForecastInsightsPanel = ({ className }: { className?: string }) => {
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const summaryStats = data
    ? [
        {
          label: "Projected 30-day inflow",
          value: formatCurrency(data.cashflow.projected30Days.inflow),
        },
        {
          label: "Projected 30-day outflow",
          value: formatCurrency(data.cashflow.projected30Days.outflow),
        },
        {
          label: "Outstanding receivables",
          value: formatCurrency(data.receivables.outstanding),
        },
      ]
    : [];

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className ?? ""}`}
    >
      <CardHeader className="dashboard-chart-content">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
          {/* Insight cards intentionally use softer copy colors in dark mode for lower eye strain. */}
          Smart insights
        </p>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
          AI financial insights
        </CardTitle>
        <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
          Forward-looking alerts for receipts, cashflow pressure, and projected
          profitability.
        </p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5">
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-xl bg-muted/70" />
        ) : isError ? (
          <p className="text-sm text-destructive">Unable to load forecast insights.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {summaryStats.map((item) => (
                <div key={item.label} className="dashboard-chart-metric rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                    {item.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-[#1f1b16]">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-3">
              {(data?.insights ?? []).map((insight) => {
                const tone = toneStyles[insight.tone];
                const Icon = tone.icon;

                return (
                  <div
                    key={insight.id}
                    className={`rounded-2xl border px-4 py-4 ${tone.card}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${tone.iconClass}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1f1b16]">
                          {/* Titles stay high-contrast while body copy remains slightly muted. */}
                          {insight.title}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#5f5144]">
                          {insight.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ForecastInsightsPanel;
