"use client";

import React, {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardFilters, {
  type DashboardFilters as DashboardFilterState,
} from "@/components/dashboard/dashboard-filters";
import {
  DashboardSectionIntro,
  dashboardSectionFallback,
} from "@/components/dashboard/dashboard-section-shared";
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
import { Button } from "@/components/ui/button";

const SalesForecast = dynamic(() => import("@/components/dashboard/sales-forecast"), {
  loading: () => dashboardSectionFallback("h-[320px]"),
});
const ProfitForecast = dynamic(() => import("@/components/dashboard/profit-forecast"), {
  loading: () => dashboardSectionFallback("h-[320px]"),
});
const SalesChart = dynamic(() => import("@/components/dashboard/sales-chart"), {
  loading: () => dashboardSectionFallback("h-[420px]"),
});
const CashFlowChart = dynamic(() => import("@/components/dashboard/cashflow-chart"), {
  loading: () => dashboardSectionFallback("h-[420px]"),
});
const PaymentMethodDistribution = dynamic(
  () => import("@/components/dashboard/payment-method-distribution"),
  { loading: () => dashboardSectionFallback("h-[380px]") },
);
const ProductSalesChart = dynamic(
  () => import("@/components/dashboard/product-sales-chart"),
  { loading: () => dashboardSectionFallback("h-[360px]") },
);
const CashflowForecastCard = dynamic(
  () => import("@/components/dashboard/cashflow-forecast-card"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const ForecastAlertsPanel = dynamic(
  () => import("@/components/dashboard/forecast-alerts-panel"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const ForecastInsightsPanel = dynamic(
  () => import("@/components/dashboard/forecast-insights-panel"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const FinancialCopilotPanel = dynamic(
  () => import("@/components/dashboard/financial-copilot-panel"),
  { loading: () => dashboardSectionFallback("h-[420px]") },
);
const DemandSupplyPanel = dynamic(
  () => import("@/components/dashboard/demand-supply-panel"),
  { loading: () => dashboardSectionFallback("h-[360px]") },
);
const InventoryRiskAlerts = dynamic(
  () => import("@/components/dashboard/inventory-risk-alerts"),
  { loading: () => dashboardSectionFallback("h-[340px]") },
);
const CustomerInsights = dynamic(
  () => import("@/components/dashboard/customer-insights"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const SupplierOverview = dynamic(
  () => import("@/components/dashboard/supplier-overview"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const TransactionsTable = dynamic(
  () => import("@/components/dashboard/transactions-table"),
  { loading: () => dashboardSectionFallback("h-[380px]") },
);

type InsightsClientProps = {
  name: string;
  image?: string;
  token?: string;
};

const InsightsClient = ({ name, image, token }: InsightsClientProps) => {
  const { t } = useI18n();
  const { currency, number } = useDashboardFormatters();
  const hydrated = useHydrated();
  const [filters, setFilters] = useState<DashboardFilterState>({
    range: "30d",
    granularity: "day",
  });
  const deferredFilters = useDeferredValue(filters);

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
  const showLoadingState = !hydrated || (hasValidSessionToken && isLoading);

  const sectionLinks = [
    { label: t("dashboard.sectionLinks.overview"), href: "#summary" },
    { label: t("dashboard.sectionLinks.performance"), href: "#performance" },
    { label: t("dashboard.sectionLinks.forecasting"), href: "#forecasting" },
    { label: t("insights.sections.demandSupply.title"), href: "#demand-supply" },
    { label: t("insights.sections.ai.title"), href: "#intelligence" },
    { label: "Copilot", href: "#copilot" },
    { label: t("dashboard.sectionLinks.records"), href: "#records" },
  ];

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
      actions={
        <DashboardFilters
          filters={filters}
          onChange={(next) => startTransition(() => setFilters(next))}
          disabled={showLoadingState}
          className="w-full sm:w-auto"
        />
      }
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <nav
          aria-label={t("navigation.insights")}
          className="flex flex-wrap items-center gap-2"
        >
          {sectionLinks.map((item) => (
            <Button key={item.href} asChild variant="outline" size="sm" className="rounded-full">
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <section id="summary" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-summary-heading"
            kicker={t("insights.sections.summary.kicker")}
            title={t("insights.sections.summary.title")}
            description={t("insights.sections.summary.description")}
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard">
                  {t("navigation.dashboard")}
                  <ArrowRight size={16} />
                </Link>
              </Button>
            }
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

        <section id="performance" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-performance-heading"
            kicker={t("dashboard.sections.performance.kicker")}
            title={t("dashboard.sections.performance.title")}
            description={t("dashboard.sections.performance.description")}
          />
          <SalesChart filters={deferredFilters} />
          <div className="grid gap-4 xl:grid-cols-2">
            <CashFlowChart />
            <PaymentMethodDistribution />
          </div>
          <div className="grid gap-4">
            <ProductSalesChart className="h-full" />
          </div>
        </section>

        <section id="forecasting" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-forecasting-heading"
            kicker={t("dashboard.sections.forecasting.kicker")}
            title={t("dashboard.sections.forecasting.title")}
            description={t("dashboard.sections.forecasting.description")}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <SalesForecast className="h-full" />
            <CashflowForecastCard className="h-full" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <ProfitForecast className="h-full" />
            <InventoryRiskAlerts className="h-full" />
          </div>
        </section>

        <section id="demand-supply" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-demand-supply-heading"
            kicker="Demand intelligence"
            title="Forecast-led inventory pressure"
            description="Combine sales momentum with stockout risk here so buyers can act before the operational dashboard gets noisy."
          />
          <DemandSupplyPanel />
        </section>

        <section
          id="intelligence"
          className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <div className="grid gap-4">
            <DashboardSectionIntro
              headingId="insights-intelligence-heading"
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
                <DashboardSectionIntro
                  headingId="insights-ai-heading"
                  kicker={t("insights.sections.ai.kicker")}
                  title={t("insights.sections.ai.title")}
                  description={t("insights.sections.ai.description")}
                />
              </div>
            </div>
            <ForecastInsightsPanel className="h-full" />
          </div>
        </section>

        <section id="copilot" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-copilot-heading"
            kicker="Level 4 + 5"
            title="Predictive finance copilot"
            description="Dynamic budgets, savings guidance, nudges, bill reminders, goal tracking, and real-time spending decisions now live in one place."
          />
          <FinancialCopilotPanel />
        </section>

        <section className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-relationship-heading"
            kicker={t("insights.sections.trends.kicker")}
            title={t("dashboard.customerInsights.title")}
            description={t("dashboard.customerInsights.description")}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <CustomerInsights className="h-full" />
            <SupplierOverview className="h-full" />
          </div>
        </section>

        <section id="records" className="grid gap-4">
          <DashboardSectionIntro
            headingId="insights-records-heading"
            kicker={t("dashboard.sections.records.kicker")}
            title={t("dashboard.sections.records.title")}
            description={t("dashboard.sections.records.description")}
          />
          <TransactionsTable filters={deferredFilters} />
        </section>
      </div>
    </DashboardLayout>
  );
};

export default InsightsClient;
