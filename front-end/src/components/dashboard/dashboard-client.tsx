"use client";

import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  fetchDashboardCardMetrics,
  fetchDashboardOverview,
  fetchInvoices,
} from "@/lib/apiClient";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import MetricCard from "@/components/dashboard/metric-card";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import DashboardFilters, {
  type DashboardFilters as DashboardFilterState,
} from "@/components/dashboard/dashboard-filters";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BellRing,
  CreditCard,
  Landmark,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatTimeLabel } from "@/lib/dashboardUtils";
import {
  DASHBOARD_REALTIME_ENABLED,
  DASHBOARD_REFRESH_INTERVAL_MS,
  dashboardQueryDefaults,
} from "@/lib/dashboardRefresh";

const dashboardSectionFallback = (height: string) => (
  <div className={`app-loading-skeleton w-full ${height}`} />
);

const ProfitForecast = dynamic(() => import("@/components/dashboard/profit-forecast"), {
  loading: () => dashboardSectionFallback("h-[320px]"),
});
const SalesForecast = dynamic(() => import("@/components/dashboard/sales-forecast"), {
  loading: () => dashboardSectionFallback("h-[320px]"),
});
const InventoryRiskAlerts = dynamic(
  () => import("@/components/dashboard/inventory-risk-alerts"),
  { loading: () => dashboardSectionFallback("h-[340px]") },
);
const TransactionsTable = dynamic(
  () => import("@/components/dashboard/transactions-table"),
  { loading: () => dashboardSectionFallback("h-[380px]") },
);
const CustomerInsights = dynamic(
  () => import("@/components/dashboard/customer-insights"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const SupplierOverview = dynamic(
  () => import("@/components/dashboard/supplier-overview"),
  { loading: () => dashboardSectionFallback("h-[320px]") },
);
const CashFlowChart = dynamic(() => import("@/components/dashboard/cashflow-chart"), {
  loading: () => dashboardSectionFallback("h-[420px]"),
});
const ProductSalesChart = dynamic(
  () => import("@/components/dashboard/product-sales-chart"),
  { loading: () => dashboardSectionFallback("h-[360px]") },
);
const SalesChart = dynamic(() => import("@/components/dashboard/sales-chart"), {
  loading: () => dashboardSectionFallback("h-[420px]"),
});
const PaymentMethodDistribution = dynamic(
  () => import("@/components/dashboard/payment-method-distribution"),
  { loading: () => dashboardSectionFallback("h-[380px]") },
);
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

type DashboardSectionIntroProps = {
  headingId: string;
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
};

const subtitle =
  "A sharper view of sales, cash movement, profit trend, and inventory demand.";

const DashboardSectionIntro = ({
  headingId,
  kicker,
  title,
  description,
  action,
}: DashboardSectionIntroProps) => (
  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
    <div className="max-w-3xl">
      <p className="app-kicker">{kicker}</p>
      <h2
        id={headingId}
        className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-[1.4rem]"
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
    {action ? <div className="flex shrink-0">{action}</div> : null}
  </div>
);

const DashboardClient = ({ name, image, token }: DashboardClientProps) => {
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<DashboardFilterState>({
    range: "30d",
    granularity: "day",
  });
  const deferredFilters = useDeferredValue(filters);

  const hasValidSessionToken =
    typeof token === "string" &&
    token.trim().length > 0 &&
    token !== "undefined" &&
    token !== "null";

  useEffect(() => {
    setHydrated(true);

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

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "overview", deferredFilters],
    queryFn: () => fetchDashboardOverview(deferredFilters),
    enabled: hydrated && hasValidSessionToken,
    ...dashboardQueryDefaults,
    refetchInterval: DASHBOARD_REALTIME_ENABLED
      ? false
      : DASHBOARD_REFRESH_INTERVAL_MS * 2,
    placeholderData: keepPreviousData,
  });

  const { data: recentInvoices = [] } = useQuery({
    queryKey: ["dashboard", "recentInvoices"],
    queryFn: fetchInvoices,
    enabled: hydrated && hasValidSessionToken,
    placeholderData: keepPreviousData,
    select: (invoices) =>
      [...invoices]
        .sort(
          (left, right) =>
            new Date(right.date).getTime() - new Date(left.date).getTime(),
        )
        .slice(0, 5),
    ...dashboardQueryDefaults,
  });

  const metrics = metricsQuery.data?.metrics;
  const metricsUpdatedAt = metricsQuery.dataUpdatedAt;
  const metricsLoading = metricsQuery.isLoading;
  const metricsFetching = metricsQuery.isFetching;
  const metricsError = metricsQuery.isError;
  const invoiceStats = data?.invoiceStats;
  const pendingSalesPayments = data?.pendingPayments ?? [];
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

  const heroStats = [
    { label: "Sales", value: metrics?.totalSales ?? 0, helper: "Booked revenue" },
    {
      label: "Purchases",
      value: metrics?.totalPurchases ?? 0,
      helper: "Stock and supply spend",
    },
    {
      label: "Pending sales",
      value: metrics?.pendingSalesPayments ?? 0,
      helper: "Customer dues",
    },
    {
      label: "Pending purchases",
      value: metrics?.pendingPurchasePayments ?? 0,
      helper: "Supplier dues",
    },
  ];

  const primaryMetricCards = metrics
    ? [
        {
          title: "Total Sales",
          value: metrics.totalSales,
          change: metrics.changes.totalSales,
          icon: <TrendingUp size={18} />,
          description: "Booked revenue across all recorded sales.",
          helperText:
            "Sum of sales total_amount (fallback total) for the selected range.",
          theme: "sales" as const,
        },
        {
          title: "Total Purchases",
          value: metrics.totalPurchases,
          change: metrics.changes.totalPurchases,
          icon: <Banknote size={18} />,
          description: "Spend committed to stock and supply purchases.",
          helperText:
            "Sum of purchase total_amount (fallback total) for the selected range.",
          theme: "purchases" as const,
        },
        {
          title: "Pending Sales Payments",
          value: metrics.pendingSalesPayments,
          change: metrics.changes.pendingSalesPayments,
          icon: <CreditCard size={18} />,
          trendLabel: "to collect",
          description: "Outstanding customer payments still to collect.",
          helperText: "Sum of pending_amount on sales in the selected range.",
          theme: "pending-sales" as const,
        },
        {
          title: "Pending Purchase Payments",
          value: metrics.pendingPurchasePayments,
          change: metrics.changes.pendingPurchasePayments,
          icon: <Banknote size={18} />,
          trendLabel: "to pay",
          description: "Outstanding supplier payments for recorded purchases.",
          helperText:
            "Sum of pending_amount on purchases in the selected range.",
          theme: "pending-purchases" as const,
        },
      ]
    : [];

  const profitMetricCards = metrics
    ? [
        {
          title: "Today's Profit",
          value: metrics.profits.today,
          change: metrics.changes.todayProfit,
          icon: <CreditCard size={18} />,
          description: "Today's net after purchases and expenses.",
          helperText: "(Sales - purchases - expenses) for today.",
        },
        {
          title: "Weekly Profit",
          value: metrics.profits.weekly,
          change: metrics.changes.weeklyProfit,
          icon: <Wallet size={18} />,
          description: "Rolling 7-day profit performance.",
          helperText: "(Sales - purchases - expenses) over the last 7 days.",
        },
        {
          title: "Monthly Profit",
          value: metrics.profits.monthly,
          change: metrics.changes.monthlyProfit,
          icon: <Package size={18} />,
          description: "Current month profit after all outflows.",
          helperText: "(Sales - purchases - expenses) month-to-date.",
        },
        {
          title: "Yearly Profit",
          value: metrics.profits.yearly,
          change: metrics.changes.yearlyProfit,
          icon: <Landmark size={18} />,
          description: "Year-to-date profit after purchases and expenses.",
          helperText: "(Sales - purchases - expenses) year-to-date.",
        },
      ]
    : [];

  const focusCards = [
    {
      label: "Overdue invoices",
      value: invoiceStats?.overdue ?? 0,
      meta: "Needs billing follow-up",
      href: "/invoices/history",
      tone:
        "border-rose-200/80 bg-rose-50/80 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-100",
    },
    {
      label: "Pending collections",
      value: pendingSalesPayments.length,
      meta: formatCurrency(metrics?.pendingSalesPayments ?? 0),
      href: "#operations",
      tone:
        "border-amber-200/80 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
    },
    {
      label: "Low stock alerts",
      value: data?.alerts.lowStock.length ?? 0,
      meta: "Inventory watchlist",
      href: "/inventory",
      tone:
        "border-orange-200/80 bg-orange-50/80 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-100",
    },
    {
      label: "Unread signals",
      value: unreadNotifications,
      meta: "Operational notifications",
      href: "#operations",
      tone:
        "border-border/80 bg-card/90 text-foreground dark:border-border/70 dark:bg-card/70",
    },
  ];

  const sectionLinks = [
    { label: "Overview", href: "#overview" },
    { label: "Performance", href: "#performance" },
    { label: "Forecasting", href: "#forecasting" },
    { label: "Operations", href: "#operations" },
    { label: "Records", href: "#records" },
  ];

  const heroSection = (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
      <header className="dashboard-chart-surface rounded-[1.75rem] px-6 py-6 sm:px-7">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Business command center
          </p>
          {metricsQuery.data?.filters?.label ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {metricsQuery.data.filters.label}
            </div>
          ) : null}
          {metricsUpdatedAt ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Updated {formatTimeLabel(metricsUpdatedAt)}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
              Revenue, receivables, supplier dues, and next actions in one
              operating view.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-[0.95rem]">
              The dashboard now leads with what needs attention first, then steps
              through performance, forecasting, and records so the page is easier
              to scan on every screen size.
            </p>
          </div>
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="#operations">
              Review priority items
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((item) => (
            <div
              key={item.label}
              className="dashboard-chart-metric rounded-2xl px-4 py-4"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-semibold leading-tight text-foreground">
                <AnimatedNumber value={item.value} format={formatCurrency} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker text-[11px]">Collections focus</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {formatCurrency(metrics?.pendingSalesPayments ?? 0)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Outstanding customer payments across {pendingSalesPayments.length}{" "}
                  invoice(s).
                </p>
              </div>
              <span className="app-chip">Receivables</span>
            </div>
          </div>

          <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker text-[11px]">Billing health</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {invoiceStats?.overdue ?? 0} overdue invoice(s)
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Paid: {invoiceStats?.paid ?? 0} of {invoiceStats?.total ?? 0} total.
                </p>
              </div>
              <AlertTriangle size={18} className="mt-1 text-amber-600" />
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4">
        <section className="dashboard-chart-surface rounded-[1.75rem]">
          <div className="dashboard-chart-content p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-2 text-primary shadow-sm">
                <BellRing size={18} />
              </div>
              <div>
                <p className="app-kicker">Today&apos;s focus</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">
                  Priority items
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Surface the tasks most likely to need action before you dive
                  into the charts.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {focusCards.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`group rounded-2xl border px-4 py-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.24)] transition hover:-translate-y-0.5 ${item.tone}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
                        {item.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold leading-none">
                        {item.value}
                      </p>
                      <p className="mt-2 text-sm opacity-80">{item.meta}</p>
                    </div>
                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <QuickActions className="w-full self-auto" />
      </div>
    </section>
  );

  const navSection = (
    <nav
      aria-label="Dashboard sections"
      className="flex flex-wrap items-center gap-2"
    >
      {sectionLinks.map((item) => (
        <Button key={item.href} asChild variant="outline" size="sm" className="rounded-full">
          <Link href={item.href}>{item.label}</Link>
        </Button>
      ))}
    </nav>
  );

  const overviewSection = (
    <section id="overview" aria-labelledby="overview-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="overview-heading"
        kicker="Core metrics"
        title="Business pulse at a glance"
        description="Primary KPIs are grouped together first so revenue, spend, collections, and payables can be compared without hunting through the page."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              formatValue={formatCurrency}
              status={{
                isLoading: metricsLoading,
                isFetching: metricsFetching,
                isError: metricsError,
                dataUpdatedAt: metricsUpdatedAt,
                refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
              }}
            />
          ))
        )}
      </div>
    </section>
  );

  const profitSection = (
    <section aria-labelledby="profit-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="profit-heading"
        kicker="Profit trend"
        title="How profitability is moving over time"
        description="Profit cards are separated from operational balances to reduce cognitive load and make period-over-period changes easier to read."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showLoadingState ? (
          <div className="col-span-full h-28 app-loading-skeleton" />
        ) : (
          profitMetricCards.map((card) => (
            <MetricCard
              key={card.title}
              title={card.title}
              value={card.value}
              change={card.change}
              icon={card.icon}
              description={card.description}
              helperText={card.helperText}
              theme="profit"
              formatValue={formatCurrency}
              status={{
                isLoading: metricsLoading,
                isFetching: metricsFetching,
                isError: metricsError,
                dataUpdatedAt: metricsUpdatedAt,
                refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
              }}
            />
          ))
        )}
      </div>
    </section>
  );

  const performanceSection = (
    <section id="performance" aria-labelledby="performance-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="performance-heading"
        kicker="Performance"
        title="Revenue, cash, and payment mix"
        description="Charts are grouped by financial story so users can move from booked activity to actual cash movement and then to payment behavior."
      />
      <SalesChart filters={deferredFilters} />
      <CashFlowChart />
      <PaymentMethodDistribution />
    </section>
  );

  const forecastingSection = (
    <section id="forecasting" aria-labelledby="forecasting-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="forecasting-heading"
        kicker="Forecasting"
        title="Demand, inventory, and forward-looking signals"
        description="Forecast widgets sit together with product demand and risk alerts so replenishment decisions can be made from one area."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfitForecast className="h-full" />
        <SalesForecast className="h-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ProductSalesChart className="h-full" />
        <InventoryRiskAlerts className="h-full" />
      </div>
    </section>
  );

  const operationsSection = (
    <section id="operations" aria-labelledby="operations-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="operations-heading"
        kicker="Operations"
        title="Alerts, billing health, and collection queue"
        description="Action-oriented cards are grouped ahead of supporting insight panels so the dashboard helps users decide what to do next, not just what happened."
        action={
          <Button asChild variant="outline">
            <Link href="/sales">Open sales ledger</Link>
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
        <div className="grid gap-4">
          {invoiceStats ? (
            <section className="dashboard-chart-surface rounded-[1.75rem]">
              <div className="dashboard-chart-content px-6 pb-5 pt-6">
                <p className="app-kicker">Billing snapshot</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  Invoice statistics
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep invoice totals, pending items, and overdue follow-ups visible
                  without opening the records page.
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
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Total", value: invoiceStats.total },
                    { label: "Paid", value: invoiceStats.paid },
                    { label: "Pending", value: invoiceStats.pending },
                    { label: "Overdue", value: invoiceStats.overdue },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="dashboard-chart-metric rounded-2xl px-4 py-4"
                    >
                      <p className="app-kicker text-[11px]">{item.label}</p>
                      <p className="mt-2.5 text-lg font-semibold text-foreground">
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

        <section className="dashboard-chart-surface rounded-[1.75rem] py-2">
          <div className="dashboard-chart-content flex h-full flex-col p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="app-kicker">Collection queue</p>
                <h3 className="mt-2 text-lg font-semibold text-foreground">
                  Pending sales payments
                </h3>
              </div>
              <span className="app-chip">{pendingSalesPayments.length} invoice(s)</span>
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
            <p className="mt-2 text-sm text-muted-foreground">
              The highest pending balances are surfaced first so collection work
              stays short and targeted.
            </p>
            <div className="mt-4 grid gap-3">
              {prioritizedPendingSalesPayments.length === 0 ? (
                <div className="app-empty-state px-4 py-5 text-sm">
                  No pending sales invoices.
                </div>
              ) : (
                prioritizedPendingSalesPayments.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="app-list-item flex flex-col gap-3 px-4 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {purchase.invoiceNumber} - {purchase.customer}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="app-chip">
                          Total: {formatCurrency(purchase.totalAmount)}
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
                          Paid: {formatCurrency(purchase.paidAmount)}
                        </span>
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                          Pending: {formatCurrency(purchase.pendingAmount)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatusBadgeClass(
                          purchase.paymentStatus,
                        )}`}
                      >
                        {purchase.paymentStatus.replace("_", " ")}
                      </span>
                      <Button asChild type="button" variant="outline">
                        <Link href="/sales">Open sales</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {pendingSalesPayments.length > prioritizedPendingSalesPayments.length ? (
              <div className="mt-4">
                <Button asChild variant="outline">
                  <Link href="/sales">
                    View all pending collections
                    <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CustomerInsights className="h-full" />
        <SupplierOverview className="h-full" />
      </div>

      <ActivityTimeline
        data={data}
        isLoading={showLoadingState}
        isError={isError}
        dataUpdatedAt={dataUpdatedAt}
        isFetching={isFetching}
      />
    </section>
  );

  const recordsSection = (
    <section id="records" aria-labelledby="records-heading" className="grid gap-4">
      <DashboardSectionIntro
        headingId="records-heading"
        kicker="Records"
        title="Transactions and recent invoice history"
        description="Dense data views are pushed toward the end of the page and paired with direct navigation, which keeps the main dashboard focused while still making detail accessible."
        action={
          <Button asChild variant="outline">
            <Link href="/invoices/history">Open records</Link>
          </Button>
        }
      />

      <TransactionsTable filters={deferredFilters} />

      <section className="dashboard-chart-surface rounded-[1.75rem]">
        <div className="dashboard-chart-content p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="app-kicker">Invoice records</p>
              <h3 className="mt-2 text-lg font-semibold text-foreground">
                Recent invoice history
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent invoices are sorted by date and trimmed to the latest five
                so the dashboard stays readable.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/invoices/history">Open records</Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-3">
            {recentInvoices.length === 0 ? (
              <div className="app-empty-state px-4 py-5 text-sm">
                No invoice records yet.
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
                      {invoice.customer?.name ?? "Customer"} -{" "}
                      {new Date(invoice.date).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground">
                      {formatCurrency(Number(invoice.total))}
                    </span>
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 font-medium text-muted-foreground">
                      {invoice.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </section>
  );

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={`Welcome back, ${name}.`}
      subtitle={subtitle}
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
        {heroSection}
        {navSection}
        {overviewSection}
        {profitSection}
        {performanceSection}
        {forecastingSection}
        {operationsSection}
        {recordsSection}
      </div>
    </DashboardLayout>
  );
};

export default DashboardClient;
