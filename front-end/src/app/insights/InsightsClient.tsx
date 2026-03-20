"use client";

import React, { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Activity, Sparkles, TrendingUp, Wallet } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useHydrated } from "@/hooks/useHydrated";
import {
  DASHBOARD_REALTIME_ENABLED,
  DASHBOARD_REFRESH_INTERVAL_MS,
} from "@/lib/dashboardRefresh";
import { useDashboardForecast } from "@/components/dashboard/use-dashboard-forecast";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import { useI18n } from "@/providers/LanguageProvider";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";

const SalesForecast = dynamic(() => import("@/components/dashboard/sales-forecast"));
const ProfitForecast = dynamic(() => import("@/components/dashboard/profit-forecast"));
const CashflowForecastCard = dynamic(
  () => import("@/components/dashboard/cashflow-forecast-card"),
);
const ForecastAlertsPanel = dynamic(
  () => import("@/components/dashboard/forecast-alerts-panel"),
);
const ForecastInsightsPanel = dynamic(
  () => import("@/components/dashboard/forecast-insights-panel"),
);

type InsightsClientProps = {
  name: string;
  image?: string;
  token?: string;
};

type SectionIntroProps = {
  kicker: string;
  title: string;
  description: string;
};

const SectionIntro = ({ kicker, title, description }: SectionIntroProps) => (
  <div className="flex flex-col gap-2">
    <p className="app-kicker">{kicker}</p>
    <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-[1.4rem]">
      {title}
    </h2>
    <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

const InsightsClient = ({ name, image, token }: InsightsClientProps) => {
  const { t } = useI18n();
  const { currency, number } = useDashboardFormatters();
  const hydrated = useHydrated();

  const displayName = name.trim() || t("common.guest");
  const hasValidSessionToken =
    typeof token === "string" &&
    token.trim().length > 0 &&
    token !== "undefined" &&
    token !== "null";

  useEffect(() => {
    if (!hasValidSessionToken) {
      window.localStorage.removeItem("token");
      return;
    }

    window.localStorage.setItem("token", token);
  }, [hasValidSessionToken, token]);

  useDashboardRealtime({
    enabled: hydrated && hasValidSessionToken && DASHBOARD_REALTIME_ENABLED,
    token,
  });

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useDashboardForecast();

  const summaryCards = useMemo(() => {
    if (!data) return [];

    return [
      {
        title: t("insights.cards.predictedMonthlySales"),
        value: currency(data.sales.projectedNext30Days),
        helper: t("insights.cards.nextThirtyDays"),
        detail: `${t("insights.cards.trendVsLastPeriod")}: ${
          data.sales.trailing30Days.trendPercent >= 0 ? "+" : ""
        }${number(data.sales.trailing30Days.trendPercent)}%`,
        icon: TrendingUp,
        accent:
          "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20",
      },
      {
        title: t("insights.cards.expectedProfit"),
        value: currency(data.profit.projected30Days.profit),
        helper: t("insights.cards.nextThirtyDays"),
        detail: `${number(data.profit.projected30Days.margin)}% margin`,
        icon: Wallet,
        accent:
          data.profit.projected30Days.profit >= 0
            ? "border-sky-200/70 bg-sky-50/70 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20"
            : "border-rose-200/70 bg-rose-50/70 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20",
      },
      {
        title: t("insights.cards.cashflowForecast"),
        value: currency(data.cashflow.projected30Days.net),
        helper: t("insights.cards.nextThirtyDays"),
        detail: `${t("insights.cards.outstandingReceivables")}: ${currency(
          data.receivables.outstanding,
        )}`,
        icon: Activity,
        accent:
          data.cashflow.projected30Days.net >= 0
            ? "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20"
            : "border-amber-200/70 bg-amber-50/70 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20",
      },
    ];
  }, [currency, data, number, t]);

  return (
    <DashboardLayout
      name={displayName}
      image={image}
      title={t("insights.title")}
      subtitle={t("insights.subtitle")}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="grid gap-4">
          <SectionIntro
            kicker={t("insights.sections.summary.kicker")}
            title={t("insights.sections.summary.title")}
            description={t("insights.sections.summary.description")}
          />

          <div className="flex justify-end">
            <DashboardCardStatus
              isLoading={!hydrated || isLoading}
              isFetching={isFetching}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <section
                  key={card.title}
                  className={`dashboard-chart-surface rounded-[1.75rem] border p-6 ${card.accent}`}
                >
                  <div className="dashboard-chart-content flex h-full flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em]">
                          {card.title}
                        </p>
                        <p className="mt-3 text-3xl font-semibold text-foreground">
                          {card.value}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-current/15 bg-white/60 p-3 dark:bg-black/10">
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <p className="text-sm font-medium text-foreground">{card.helper}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </section>

        <section className="grid gap-4">
          <SectionIntro
            kicker={t("insights.sections.trends.kicker")}
            title={t("insights.sections.trends.title")}
            description={t("insights.sections.trends.description")}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <SalesForecast className="h-full" />
            <CashflowForecastCard className="h-full" />
          </div>
          <div className="grid gap-4">
            <ProfitForecast className="h-full" />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-4">
            <SectionIntro
              kicker={t("insights.sections.alerts.kicker")}
              title={t("insights.sections.alerts.title")}
              description={t("insights.sections.alerts.description")}
            />
            <ForecastAlertsPanel className="h-full" />
          </div>

          <div className="grid gap-4">
            <div className="flex items-start gap-2 text-primary">
              <Sparkles size={16} />
              <div className="flex-1">
                <SectionIntro
                  kicker={t("insights.sections.ai.kicker")}
                  title={t("insights.sections.ai.title")}
                  description={t("insights.sections.ai.description")}
                />
              </div>
            </div>
            <ForecastInsightsPanel className="h-full" />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default InsightsClient;
