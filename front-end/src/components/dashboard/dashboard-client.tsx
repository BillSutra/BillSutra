"use client";

import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchDashboardCardMetrics,
  fetchDashboardOverview,
  fetchInvoices,
  fetchProducts,
} from "@/lib/apiClient";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import MetricCard from "@/components/dashboard/metric-card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import {
  DashboardSectionIntro,
  dashboardSectionFallback,
} from "@/components/dashboard/dashboard-section-shared";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import DashboardFilters, {
  type DashboardFilters as DashboardFilterState,
} from "@/components/dashboard/dashboard-filters";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BellRing,
  CreditCard,
  Landmark,
  Minus,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_REALTIME_ENABLED,
  DASHBOARD_REFRESH_INTERVAL_MS,
  dashboardQueryDefaults,
} from "@/lib/dashboardRefresh";
import { useHydrated } from "@/hooks/useHydrated";
import { useI18n } from "@/providers/LanguageProvider";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import DashboardPlanCard from "@/components/dashboard/dashboard-plan-card";
import InventoryRiskSummaryBanner from "@/components/dashboard/inventory-risk-summary-banner";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/dashboardUtils";

const QuickActions = dynamic(() => import("@/components/dashboard/quick-actions"), {
  loading: () => dashboardSectionFallback("h-[300px]"),
});
const ActivityTimeline = dynamic(
  () => import("@/components/dashboard/activity-timeline"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const NotificationsPanel = dynamic(
  () => import("@/components/dashboard/notifications-panel"),
  { loading: () => dashboardSectionFallback("h-[260px]") },
);

type DashboardClientProps = {
  name: string;
  image?: string;
  token?: string;
};

const DashboardClient = ({ name, image, token }: DashboardClientProps) => {
  const { t } = useI18n();
  const { currency, dateLabel, dateWithYear, timeLabel, translateEnum } =
    useDashboardFormatters();
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

  const metricsQuery = useQuery({
    queryKey: ["dashboard", "metrics", deferredFilters],
    queryFn: () => fetchDashboardCardMetrics(deferredFilters),
    enabled: hydrated && hasValidSessionToken,
    placeholderData: keepPreviousData,
    ...dashboardQueryDefaults,
  });

  const { data, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "overview", deferredFilters],
    queryFn: () => fetchDashboardOverview(deferredFilters),
    enabled: hydrated && hasValidSessionToken,
    ...dashboardQueryDefaults,
    refetchInterval: DASHBOARD_REALTIME_ENABLED
      ? false
      : DASHBOARD_REFRESH_INTERVAL_MS * 2,
    placeholderData: keepPreviousData,
  });

  const { data: allInvoices = [] } = useQuery({
    queryKey: ["dashboard", "allInvoices"],
    queryFn: fetchInvoices,
    enabled: hydrated && hasValidSessionToken,
    placeholderData: keepPreviousData,
    ...dashboardQueryDefaults,
  });
  const { data: productsPage } = useQuery({
    queryKey: ["dashboard", "productCount"],
    queryFn: () => fetchProducts({ page: 1, limit: 1 }),
    enabled: hydrated && hasValidSessionToken,
    placeholderData: keepPreviousData,
    ...dashboardQueryDefaults,
  });

  const metrics = metricsQuery.data?.metrics;
  const metricsUpdatedAt = metricsQuery.dataUpdatedAt;
  const metricsLoading = metricsQuery.isLoading;
  const metricsFetching = metricsQuery.isFetching;
  const metricsError = metricsQuery.isError;
  const invoiceStats = data?.invoiceStats;
  const pendingSalesPayments = data?.pendingPayments ?? [];
  const recentInvoices = [...allInvoices]
    .sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    )
    .slice(0, 5);
  const currentDate = new Date();
  const monthlyInvoiceCount = allInvoices.filter((invoice) => {
    const invoiceDate = new Date(invoice.date);
    return (
      invoiceDate.getFullYear() === currentDate.getFullYear() &&
      invoiceDate.getMonth() === currentDate.getMonth()
    );
  }).length;
  const productCount = productsPage?.total ?? 0;
  const prioritizedPendingSalesPayments = [...pendingSalesPayments]
    .sort((left, right) => right.pendingAmount - left.pendingAmount)
    .slice(0, 4);

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const showLoadingState = !hydrated || (hasValidSessionToken && metricsLoading);
  const unreadNotifications =
    data?.notifications.filter((notification) => !notification.read).length ??
    data?.notifications.length ??
    0;
  const rangeLabelByPreset: Record<DashboardFilterState["range"], string> = {
    "7d": t("dashboard.filters.range7d"),
    "30d": t("dashboard.filters.range30d"),
    "90d": t("dashboard.filters.range90d"),
    ytd: t("dashboard.filters.rangeYtd"),
    custom: t("dashboard.filters.rangeCustom"),
  };
  const filterLabel =
    filters.range === "custom" && (filters.startDate || filters.endDate)
      ? [
          filters.startDate ? dateLabel(filters.startDate) : null,
          filters.endDate ? dateLabel(filters.endDate) : null,
        ]
          .filter(Boolean)
          .join(" - ")
      : rangeLabelByPreset[filters.range];

  const heroStats = [
    {
      label: t("dashboard.hero.stats.salesLabel"),
      value: metrics?.totalSales ?? 0,
      helper: t("dashboard.hero.stats.salesHelper"),
    },
    {
      label: t("dashboard.hero.stats.purchasesLabel"),
      value: metrics?.totalPurchases ?? 0,
      helper: t("dashboard.hero.stats.purchasesHelper"),
    },
    {
      label: t("dashboard.hero.stats.pendingSalesLabel"),
      value: metrics?.pendingSalesPayments ?? 0,
      helper: t("dashboard.hero.stats.pendingSalesHelper"),
    },
    {
      label: t("dashboard.hero.stats.pendingPurchasesLabel"),
      value: metrics?.pendingPurchasePayments ?? 0,
      helper: t("dashboard.hero.stats.pendingPurchasesHelper"),
    },
  ];

  const primaryMetricCards = metrics
    ? [
        {
          title: t("dashboard.primaryMetrics.totalSalesTitle"),
          value: metrics.totalSales,
          change: metrics.changes.totalSales,
          icon: <TrendingUp size={18} />,
          description: t("dashboard.primaryMetrics.totalSalesDescription"),
          helperText: t("dashboard.primaryMetrics.totalSalesHelper"),
          theme: "sales" as const,
        },
        {
          title: t("dashboard.primaryMetrics.totalPurchasesTitle"),
          value: metrics.totalPurchases,
          change: metrics.changes.totalPurchases,
          icon: <Banknote size={18} />,
          description: t("dashboard.primaryMetrics.totalPurchasesDescription"),
          helperText: t("dashboard.primaryMetrics.totalPurchasesHelper"),
          theme: "purchases" as const,
        },
        {
          title: t("dashboard.primaryMetrics.pendingSalesPaymentsTitle"),
          value: metrics.pendingSalesPayments,
          change: metrics.changes.pendingSalesPayments,
          icon: <CreditCard size={18} />,
          trendLabel: t("dashboard.primaryMetrics.pendingSalesPaymentsTrend"),
          description: t("dashboard.primaryMetrics.pendingSalesPaymentsDescription"),
          helperText: t("dashboard.primaryMetrics.pendingSalesPaymentsHelper"),
          theme: "pending-sales" as const,
        },
        {
          title: t("dashboard.primaryMetrics.pendingPurchasePaymentsTitle"),
          value: metrics.pendingPurchasePayments,
          change: metrics.changes.pendingPurchasePayments,
          icon: <Banknote size={18} />,
          trendLabel: t("dashboard.primaryMetrics.pendingPurchasePaymentsTrend"),
          description: t("dashboard.primaryMetrics.pendingPurchasePaymentsDescription"),
          helperText: t("dashboard.primaryMetrics.pendingPurchasePaymentsHelper"),
          theme: "pending-purchases" as const,
        },
      ]
    : [];

  const profitMetricCards = metrics
    ? [
        {
          title: t("dashboard.profitMetrics.todayTitle"),
          value: metrics.profits.today,
          change: metrics.changes.todayProfit,
          icon: <CreditCard size={18} />,
          description: t("dashboard.profitMetrics.todayDescription"),
          helperText: t("dashboard.profitMetrics.todayHelper"),
        },
        {
          title: t("dashboard.profitMetrics.weeklyTitle"),
          value: metrics.profits.weekly,
          change: metrics.changes.weeklyProfit,
          icon: <Wallet size={18} />,
          description: t("dashboard.profitMetrics.weeklyDescription"),
          helperText: t("dashboard.profitMetrics.weeklyHelper"),
        },
        {
          title: t("dashboard.profitMetrics.monthlyTitle"),
          value: metrics.profits.monthly,
          change: metrics.changes.monthlyProfit,
          icon: <Package size={18} />,
          description: t("dashboard.profitMetrics.monthlyDescription"),
          helperText: t("dashboard.profitMetrics.monthlyHelper"),
        },
        {
          title: t("dashboard.profitMetrics.yearlyTitle"),
          value: metrics.profits.yearly,
          change: metrics.changes.yearlyProfit,
          icon: <Landmark size={18} />,
          description: t("dashboard.profitMetrics.yearlyDescription"),
          helperText: t("dashboard.profitMetrics.yearlyHelper"),
        },
      ]
    : [];

  const focusCards = [
    {
      label: t("dashboard.focus.overdueInvoicesLabel"),
      value: invoiceStats?.overdue ?? 0,
      meta: t("dashboard.focus.overdueInvoicesMeta"),
      href: "/invoices/history",
      tone:
        "border-rose-200/80 bg-rose-50/80 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100",
    },
    {
      label: t("dashboard.focus.pendingCollectionsLabel"),
      value: pendingSalesPayments.length,
      meta: currency(metrics?.pendingSalesPayments ?? 0),
      href: "#operations",
      tone:
        "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    },
    {
      label: t("dashboard.focus.lowStockAlertsLabel"),
      value: data?.alerts.lowStock.length ?? 0,
      meta: t("dashboard.focus.lowStockAlertsMeta"),
      href: "/inventory",
      tone:
        "border-orange-200/80 bg-orange-50/80 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-100",
    },
    {
      label: t("dashboard.focus.unreadSignalsLabel"),
      value: unreadNotifications,
      meta: t("dashboard.focus.unreadSignalsMeta"),
      href: "#operations",
      tone:
        "border-border/80 bg-card/90 text-foreground dark:border-border/70 dark:bg-card/70",
    },
  ];

  const sectionLinks = [
    { label: t("dashboard.sectionLinks.overview"), href: "#overview" },
    { label: t("dashboard.sections.profit.title"), href: "#profit" },
    { label: t("dashboard.sectionLinks.operations"), href: "#operations" },
    { label: t("dashboard.sectionLinks.records"), href: "#records" },
  ];

  const metricStatus = {
    isLoading: metricsLoading,
    isFetching: metricsFetching,
    isError: metricsError,
    dataUpdatedAt: metricsUpdatedAt,
    refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
  };

  const profitDeltaMeta = (change: number) => {
    if (change > 0) {
      return {
        icon: ArrowUpRight,
        label: `+${formatPercent(Math.abs(change))}`,
        className:
          "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200",
      };
    }

    if (change < 0) {
      return {
        icon: ArrowDownRight,
        label: `-${formatPercent(Math.abs(change))}`,
        className:
          "border-rose-200/70 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200",
      };
    }

    return {
      icon: Minus,
      label: formatPercent(0),
      className:
        "border-border/70 bg-card/80 text-muted-foreground dark:border-border/60 dark:bg-card/70",
    };
  };

  const heroSection = (
    <section className="grid gap-5 xl:grid-cols-12">
      <header className="dashboard-chart-surface rounded-[2rem] xl:col-span-8">
        <div className="dashboard-chart-content p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              {t("dashboard.hero.kicker")}
            </p>
            {filterLabel ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {filterLabel}
              </div>
            ) : null}
            {metricsUpdatedAt ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("dashboard.status.lastUpdated", {
                  time: timeLabel(metricsUpdatedAt),
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.35rem]">
                {t("dashboard.hero.operatingViewTitle")}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[0.98rem]">
                {t("dashboard.hero.operatingViewDescription")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="#operations">
                  {t("dashboard.hero.reviewPriorityItems")}
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/invoices/history">
                  {t("dashboard.sections.records.openRecords")}
                </Link>
              </Button>
            </div>
          </div>

          <nav
            aria-label={t("navigation.dashboard")}
            className="mt-5 flex flex-wrap items-center gap-2"
          >
            {sectionLinks.map((item) => (
              <Button
                key={item.href}
                asChild
                variant="outline"
                size="sm"
                className="rounded-full bg-background/70"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {heroStats.map((item) => (
              <div
                key={item.label}
                className="dashboard-chart-metric rounded-[1.45rem] px-5 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-3 text-xl font-semibold leading-tight text-foreground">
                  <AnimatedNumber value={item.value} format={currency} />
                </p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {item.helper}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[1.55rem] border border-emerald-200/80 bg-emerald-50/80 px-5 py-5 text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker text-[11px]">
                    {t("dashboard.hero.collectionsFocus")}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-current">
                    {currency(metrics?.pendingSalesPayments ?? 0)}
                  </p>
                  <p className="mt-1.5 text-sm text-current/75">
                    {t("dashboard.hero.collectionsSummary", {
                      count: pendingSalesPayments.length,
                    })}
                  </p>
                </div>
                <span className="rounded-full border border-current/10 bg-white/60 px-3 py-1 text-xs font-semibold text-current dark:bg-white/10">
                  {t("dashboard.hero.receivables")}
                </span>
              </div>
            </div>

            <div className="rounded-[1.55rem] border border-amber-200/80 bg-amber-50/85 px-5 py-5 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="app-kicker text-[11px]">
                    {t("dashboard.hero.billingHealth")}
                  </p>
                  <p className="mt-3 text-xl font-semibold text-current">
                    {t("dashboard.hero.overdueInvoices", {
                      count: invoiceStats?.overdue ?? 0,
                    })}
                  </p>
                  <p className="mt-1.5 text-sm text-current/75">
                    {t("dashboard.hero.paidSummary", {
                      paid: invoiceStats?.paid ?? 0,
                      total: invoiceStats?.total ?? 0,
                    })}
                  </p>
                </div>
                <AlertTriangle size={18} className="mt-1 text-current" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <aside className="dashboard-chart-surface rounded-[2rem] xl:col-span-4">
        <div className="dashboard-chart-content flex h-full flex-col p-6 sm:p-7">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl border border-border/70 bg-card/80 p-2 text-primary shadow-sm">
              <BellRing size={18} />
            </div>
            <div>
              <p className="app-kicker">{t("dashboard.focus.kicker")}</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">
                {t("dashboard.focus.title")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("dashboard.focus.description")}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {focusCards.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`group rounded-[1.45rem] border px-4 py-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.24)] transition hover:-translate-y-0.5 ${item.tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold leading-none">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-5 opacity-80">{item.meta}</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="mt-1 shrink-0 transition-transform group-hover:translate-x-1"
                  />
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:mt-auto xl:grid-cols-1">
            <Button asChild className="w-full justify-between">
              <Link href="/sales">
                {t("dashboard.sections.operations.openSalesLedger")}
                <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/invoices/history">
                {t("dashboard.sections.records.openRecords")}
                <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </div>
      </aside>
    </section>
  );

  const performanceSection = (
    <section id="overview" aria-labelledby="overview-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="overview-heading"
        kicker={t("dashboard.sections.overview.kicker")}
        title={t("dashboard.sections.overview.title")}
        description={t("dashboard.sections.overview.description")}
      />
      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-8">
          {showLoadingState ? (
            <div className="col-span-full h-28 app-loading-skeleton" />
          ) : (
            primaryMetricCards.map((card) => (
              <MetricCard
                key={card.title}
                title={card.title}
                value={card.value}
                change={card.change}
                icon={card.icon}
                trendLabel={card.trendLabel}
                description={card.description}
                helperText={card.helperText}
                theme={card.theme}
                formatValue={currency}
                status={metricStatus}
              />
            ))
          )}
        </div>

        <section
          id="profit"
          aria-labelledby="profit-heading"
          className="dashboard-chart-surface rounded-[1.9rem] xl:col-span-4"
        >
          <div className="dashboard-chart-content flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">{t("dashboard.sections.profit.kicker")}</p>
                <h2
                  id="profit-heading"
                  className="mt-2 text-xl font-semibold tracking-tight text-foreground"
                >
                  {t("dashboard.sections.profit.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("dashboard.sections.profit.description")}
                </p>
              </div>
            </div>

            <div className="mt-3">
              <DashboardCardStatus
                isLoading={metricStatus.isLoading}
                isFetching={metricStatus.isFetching}
                isError={metricStatus.isError}
                dataUpdatedAt={metricStatus.dataUpdatedAt}
                refreshIntervalMs={metricStatus.refreshIntervalMs}
              />
            </div>

            {showLoadingState ? (
              <div className="mt-5 h-40 app-loading-skeleton" />
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {profitMetricCards.map((card) => {
                  const delta = profitDeltaMeta(card.change);
                  const DeltaIcon = delta.icon;

                  return (
                    <div
                      key={card.title}
                      className="rounded-[1.45rem] border border-border/70 bg-background/70 px-4 py-4 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.16)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {card.title}
                          </p>
                          <p className="mt-2 text-xl font-semibold leading-tight text-foreground">
                            <AnimatedNumber value={card.value} format={currency} />
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/80 p-3 text-primary shadow-sm">
                          {card.icon}
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-5 text-muted-foreground">
                        {card.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                            delta.className,
                          )}
                        >
                          <DeltaIcon size={14} />
                          {delta.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {card.helperText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );

  const operationsSection = (
    <section id="operations" aria-labelledby="operations-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="operations-heading"
        kicker={t("dashboard.sections.operations.kicker")}
        title={t("dashboard.sections.operations.title")}
        description={t("dashboard.sections.operations.description")}
        action={
          <Button asChild variant="outline">
            <Link href="/sales">{t("dashboard.sections.operations.openSalesLedger")}</Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="grid gap-4 xl:col-span-8">
          <section className="dashboard-chart-surface rounded-[1.85rem] py-2">
            <div className="dashboard-chart-content flex h-full flex-col p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="app-kicker">
                    {t("dashboard.operations.collectionQueueKicker")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {t("dashboard.operations.pendingSalesPaymentsTitle")}
                  </h3>
                </div>
                <span className="app-chip">
                  {t("dashboard.operations.invoiceCount", {
                    count: pendingSalesPayments.length,
                  })}
                </span>
              </div>
              <div className="mt-2">
                <DashboardCardStatus
                  isLoading={showLoadingState}
                  isFetching={isFetching}
                  isError={isError}
                  dataUpdatedAt={dataUpdatedAt}
                  refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
                />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {t("dashboard.operations.collectionQueueDescription")}
              </p>
              <div className="mt-5 grid gap-3">
                {prioritizedPendingSalesPayments.length === 0 ? (
                  <div className="app-empty-state px-4 py-5 text-sm">
                    {t("dashboard.operations.noPendingSalesInvoices")}
                  </div>
                ) : (
                  prioritizedPendingSalesPayments.map((purchase) => (
                    <div
                      key={purchase.id}
                      className="app-list-item flex flex-col gap-3 px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground sm:text-base">
                            {purchase.invoiceNumber} - {purchase.customer}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="app-chip">
                              {t("dashboard.operations.totalPill", {
                                amount: currency(purchase.totalAmount),
                              })}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
                              {t("dashboard.operations.paidPill", {
                                amount: currency(purchase.paidAmount),
                              })}
                            </span>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                              {t("dashboard.operations.pendingPill", {
                                amount: currency(purchase.pendingAmount),
                              })}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                              purchase.paymentStatus,
                            )}`}
                          >
                            {translateEnum(
                              "dashboard.enums.paymentStatus",
                              purchase.paymentStatus,
                            )}
                          </span>
                          <Button asChild type="button" variant="outline">
                            <Link href="/sales">{t("dashboard.operations.openSales")}</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {pendingSalesPayments.length > prioritizedPendingSalesPayments.length ? (
                <div className="mt-4">
                  <Button asChild variant="outline">
                    <Link href="/sales">
                      {t("dashboard.operations.viewAllPendingCollections")}
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </section>

          <ActivityTimeline
            data={data}
            isLoading={showLoadingState}
            isError={isError}
            dataUpdatedAt={dataUpdatedAt}
            isFetching={isFetching}
          />
        </div>

        <div className="grid gap-4 xl:col-span-4">
          {invoiceStats ? (
            <section className="dashboard-chart-surface rounded-[1.85rem]">
              <div className="dashboard-chart-content p-6">
                <p className="app-kicker">
                  {t("dashboard.operations.billingSnapshotKicker")}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {t("dashboard.operations.invoiceStatisticsTitle")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("dashboard.operations.invoiceStatisticsDescription")}
                </p>
                <div className="mt-3">
                  <DashboardCardStatus
                    isLoading={showLoadingState}
                    isFetching={isFetching}
                    isError={isError}
                    dataUpdatedAt={dataUpdatedAt}
                    refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
                  />
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                  {[
                    {
                      label: t("dashboard.operations.invoiceStatsTotal"),
                      value: invoiceStats.total,
                    },
                    {
                      label: t("dashboard.operations.invoiceStatsPaid"),
                      value: invoiceStats.paid,
                    },
                    {
                      label: t("dashboard.operations.invoiceStatsPending"),
                      value: invoiceStats.pending,
                    },
                    {
                      label: t("dashboard.operations.invoiceStatsOverdue"),
                      value: invoiceStats.overdue,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="dashboard-chart-metric rounded-[1.35rem] px-4 py-4"
                    >
                      <p className="app-kicker text-[11px]">{item.label}</p>
                      <p className="mt-2.5 text-xl font-semibold text-foreground">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          <NotificationsPanel
            data={data}
            isLoading={showLoadingState}
            isError={isError}
            dataUpdatedAt={dataUpdatedAt}
            isFetching={isFetching}
          />
        </div>
      </div>
    </section>
  );

  const recordsSection = (
    <section id="records" aria-labelledby="records-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="records-heading"
        kicker={t("dashboard.sections.records.kicker")}
        title={t("dashboard.sections.records.title")}
        description={t("dashboard.sections.records.description")}
        action={
          <Button asChild variant="outline">
            <Link href="/invoices/history">{t("dashboard.sections.records.openRecords")}</Link>
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="dashboard-chart-surface rounded-[1.85rem] xl:col-span-7">
          <div className="dashboard-chart-content p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="app-kicker">{t("dashboard.records.invoiceRecordsKicker")}</p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">
                  {t("dashboard.records.recentInvoiceHistoryTitle")}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("dashboard.records.recentInvoiceHistoryDescription")}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/invoices/history">
                  {t("dashboard.sections.records.openRecords")}
                </Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {recentInvoices.length === 0 ? (
                <div className="app-empty-state px-4 py-5 text-sm">
                  {t("dashboard.records.noInvoiceRecords")}
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="app-list-item flex flex-wrap items-center justify-between gap-3 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {invoice.invoice_number}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {invoice.customer?.name ?? t("invoice.fallbackCustomer")} -{" "}
                        {dateWithYear(invoice.date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground">
                        {currency(Number(invoice.total))}
                      </span>
                      <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium text-muted-foreground">
                        {translateEnum("dashboard.enums.paymentStatus", invoice.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <div className="xl:col-span-5">
          <QuickActions className="w-full self-auto" />
          <div className="mt-5">
            <DashboardPlanCard
              monthlyInvoiceCount={monthlyInvoiceCount}
              productCount={productCount}
            />
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <DashboardLayout
      name={displayName}
      image={image}
      title={t("dashboard.title", { name: displayName })}
      subtitle={t("dashboard.subtitle")}
      actions={
        <DashboardFilters
          filters={filters}
          onChange={(next) => startTransition(() => setFilters(next))}
          disabled={showLoadingState}
          className="w-full sm:w-auto"
        />
      }
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-7">
        {heroSection}
        <InventoryRiskSummaryBanner />
        {performanceSection}
        {operationsSection}
        {recordsSection}
      </div>
    </DashboardLayout>
  );
};

export default DashboardClient;
