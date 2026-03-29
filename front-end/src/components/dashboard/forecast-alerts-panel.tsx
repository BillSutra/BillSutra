"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Siren, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useDashboardForecast } from "@/components/dashboard/use-dashboard-forecast";
import { useI18n } from "@/providers/LanguageProvider";

const ForecastAlertsPanel = ({ className }: { className?: string }) => {
  const { t } = useI18n();
  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const alerts = (data?.insights ?? []).filter(
    (insight) => insight.tone === "warning" || insight.tone === "critical",
  );

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className ?? ""}`}
    >
      <CardHeader className="dashboard-chart-content">
        <div className="flex items-center gap-2 text-[#b45309]">
          <Siren size={16} />
          <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">
            {t("insights.sections.alerts.kicker")}
          </p>
        </div>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">
          {t("insights.sections.alerts.title")}
        </CardTitle>
        <p className="mt-2 max-w-xl text-sm text-[#8a6d56]">
          {t("insights.sections.alerts.description")}
        </p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-4">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-xl bg-muted/70" />
        ) : isError ? (
          <p className="text-sm text-destructive">Unable to load alerts.</p>
        ) : alerts.length === 0 ? (
          <div className="app-empty-state px-4 py-6 text-sm">{t("insights.alerts.empty")}</div>
        ) : (
          alerts.map((alert) => {
            const Icon = alert.tone === "critical" ? TrendingDown : AlertTriangle;
            return (
              <div
                key={alert.id}
                className={`rounded-2xl border px-4 py-4 ${
                  alert.tone === "critical"
                    ? "border-rose-200 bg-rose-50 dark:border-rose-400/12 dark:bg-rose-400/[0.06]"
                    : "border-amber-200 bg-amber-50 dark:border-amber-400/12 dark:bg-amber-400/[0.06]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={
                      alert.tone === "critical" ? "text-rose-600" : "text-amber-600"
                    }
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1f1b16]">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[#5f5144]">{alert.message}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/sales">
              {t("insights.alerts.reviewCollections")}
              <ArrowRight size={16} />
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">{t("insights.alerts.openDashboard")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ForecastAlertsPanel;
