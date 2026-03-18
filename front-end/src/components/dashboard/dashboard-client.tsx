"use client";

import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchDashboardCardMetrics, fetchDashboardOverview } from "@/lib/apiClient";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import MetricCard from "@/components/dashboard/metric-card";
import ProfitForecast from "@/components/dashboard/profit-forecast";
import SalesForecast from "@/components/dashboard/sales-forecast";
import InventoryRiskAlerts from "@/components/dashboard/inventory-risk-alerts";
import TransactionsTable from "@/components/dashboard/transactions-table";
import CustomerInsights from "@/components/dashboard/customer-insights";
import SupplierOverview from "@/components/dashboard/supplier-overview";
import CashFlowChart from "@/components/dashboard/cashflow-chart";
import ProductSalesChart from "@/components/dashboard/product-sales-chart";
import SalesChart from "@/components/dashboard/sales-chart";
import PaymentMethodDistribution from "@/components/dashboard/payment-method-distribution";
import QuickActions from "@/components/dashboard/quick-actions";
import ActivityTimeline from "@/components/dashboard/activity-timeline";
import NotificationsPanel from "@/components/dashboard/notifications-panel";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { useInvoicesQuery } from "@/hooks/useInventoryQueries";
import DashboardFilters, {
  type DashboardFilters as DashboardFilterState,
} from "@/components/dashboard/dashboard-filters";
import {
  Banknote,
  CreditCard,
  Landmark,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatTimeLabel } from "@/lib/dashboardUtils";
import {
  dashboardQueryDefaults,
  DASHBOARD_REALTIME_ENABLED,
  DASHBOARD_REFRESH_INTERVAL_MS,
} from "@/lib/dashboardRefresh";

type DashboardClientProps = {
  name: string;
  image?: string;
  token?: string;
};

const subtitle =
  "A sharper view of sales, cash movement, profit trend, and inventory demand.";

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

  const {
    data,
    isLoading,
    isError,
    dataUpdatedAt,
    isFetching,
  } = useQuery({
    queryKey: ["dashboard", "overview", deferredFilters],
    queryFn: () => fetchDashboardOverview(deferredFilters),
    enabled: hydrated && hasValidSessionToken,
    ...dashboardQueryDefaults,
    refetchInterval: DASHBOARD_REALTIME_ENABLED
      ? false
      : DASHBOARD_REFRESH_INTERVAL_MS * 2,
    placeholderData: keepPreviousData,
  });

  const metrics = metricsQuery.data?.metrics;
  const metricsUpdatedAt = metricsQuery.dataUpdatedAt;
  const metricsLoading = metricsQuery.isLoading;
  const metricsFetching = metricsQuery.isFetching;
  const metricsError = metricsQuery.isError;
  const invoiceStats = data?.invoiceStats;
  const pendingSalesPayments = data?.pendingPayments ?? [];
  const { data: invoices = [] } = useInvoicesQuery();
  const recentInvoices = invoices.slice(0, 5);

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const showLoadingState = !hydrated || (hasValidSessionToken && metricsLoading);

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
        />
      }
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="dashboard-chart-surface rounded-[1.5rem] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Business command center
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="max-w-3xl text-2xl font-semibold tracking-tight text-foreground">
                Revenue, purchases, receivables, and supplier dues in one
                operating view.
              </p>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Use the charts below to compare demand, stocking pressure,
                payment mix, pending cash to collect, and supplier payments
                without leaving the dashboard.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Sales",
                  value: metrics?.totalSales ?? 0,
                },
                {
                  label: "Purchases",
                  value: metrics?.totalPurchases ?? 0,
                },
                {
                  label: "Pending Sales",
                  value: metrics?.pendingSalesPayments ?? 0,
                },
                {
                  label: "Pending Purchases",
                  value: metrics?.pendingPurchasePayments ?? 0,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-base font-semibold leading-tight text-foreground">
                    <AnimatedNumber value={item.value} format={formatCurrency} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Dashboard pulse -- at-a-glance from your books
        </p>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {showLoadingState ? (
            <div className="col-span-full h-28 animate-pulse rounded-2xl bg-[#fdf7f1]" />
          ) : metrics ? (
            <>
              <MetricCard
                title="Total Sales"
                value={metrics.totalSales}
                change={metrics.changes.totalSales}
                icon={<TrendingUp size={18} />}
                description="Booked revenue across all recorded sales."
                helperText="Sum of sales total_amount (fallback total) for the selected range."
                theme="sales"
                formatValue={formatCurrency}
                status={{
                  isLoading: metricsLoading,
                  isFetching: metricsFetching,
                  isError: metricsError,
                  dataUpdatedAt: metricsUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Total Purchases"
                value={metrics.totalPurchases}
                change={metrics.changes.totalPurchases}
                icon={<Banknote size={18} />}
                description="Spend committed to stock and supply purchases."
                helperText="Sum of purchase total_amount (fallback total) for the selected range."
                theme="purchases"
                formatValue={formatCurrency}
                status={{
                  isLoading: metricsLoading,
                  isFetching: metricsFetching,
                  isError: metricsError,
                  dataUpdatedAt: metricsUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Pending Sales Payments"
                value={metrics.pendingSalesPayments}
                change={metrics.changes.pendingSalesPayments}
                icon={<CreditCard size={18} />}
                trendLabel="to collect"
                description="Outstanding customer payments still to collect."
                helperText="Sum of pending_amount on sales in the selected range."
                theme="pending-sales"
                formatValue={formatCurrency}
                status={{
                  isLoading: metricsLoading,
                  isFetching: metricsFetching,
                  isError: metricsError,
                  dataUpdatedAt: metricsUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Pending Purchase Payments"
                value={metrics.pendingPurchasePayments}
                change={metrics.changes.pendingPurchasePayments}
                icon={<Banknote size={18} />}
                trendLabel="to pay"
                description="Outstanding supplier payments for recorded purchases."
                helperText="Sum of pending_amount on purchases in the selected range."
                theme="pending-purchases"
                formatValue={formatCurrency}
                status={{
                  isLoading: metricsLoading,
                  isFetching: metricsFetching,
                  isError: metricsError,
                  dataUpdatedAt: metricsUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Today's Profit"
                value={metrics.profits.today}
                change={metrics.changes.todayProfit}
                icon={<CreditCard size={18} />}
                description="Today's net after purchases and expenses."
                helperText="(Sales - purchases - expenses) for today."
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
              <MetricCard
                title="Weekly Profit"
                value={metrics.profits.weekly}
                change={metrics.changes.weeklyProfit}
                icon={<Wallet size={18} />}
                description="Rolling 7-day profit performance."
                helperText="(Sales - purchases - expenses) over the last 7 days."
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
              <MetricCard
                title="Monthly Profit"
                value={metrics.profits.monthly}
                change={metrics.changes.monthlyProfit}
                icon={<Package size={18} />}
                description="Current month profit after all outflows."
                helperText="(Sales - purchases - expenses) month-to-date."
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
              <MetricCard
                title="Yearly Profit"
                value={metrics.profits.yearly}
                change={metrics.changes.yearlyProfit}
                icon={<Landmark size={18} />}
                description="Year-to-date profit after purchases and expenses."
                helperText="(Sales - purchases - expenses) year-to-date."
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
            </>
          ) : null}
        </section>

        <SalesChart filters={deferredFilters} />

        <section className="grid gap-4">
          <CashFlowChart />
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ProfitForecast className="h-full" />
          <SalesForecast className="h-full" />
        </section>

        <PaymentMethodDistribution />

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ProductSalesChart className="h-full" />
          <InventoryRiskAlerts className="h-full" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <CustomerInsights className="h-full" />
          <SupplierOverview className="h-full" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
          <div className="grid gap-4 self-start">
            {invoiceStats && (
              <div className="dashboard-chart-surface h-fit self-start rounded-[1.75rem]">
                <div className="dashboard-chart-content px-6 pb-5 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                    Billing snapshot
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                    Invoice statistics
                  </p>
                  <p className="mt-1 text-sm text-[#6f6257]">
                    Monitor issued invoices, settled ones, and what still needs
                    follow-up.
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
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                          {item.label}
                        </p>
                        <p className="mt-2.5 text-lg font-semibold text-[#1f1b16] dark:text-gray-100">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <NotificationsPanel
              data={data}
              isLoading={showLoadingState}
              isError={isError}
              dataUpdatedAt={dataUpdatedAt}
              isFetching={isFetching}
            />
          </div>

          <div className="flex h-full flex-col gap-4 self-stretch">
            <QuickActions className="w-full self-auto" />
            <section className="dashboard-chart-surface flex-1 rounded-[1.75rem] py-2">
              <div className="dashboard-chart-content flex h-full flex-col p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                      Collection queue
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                      Pending sales payments
                    </p>
                  </div>
                  <span className="rounded-full border border-[#ecdccf] bg-white/90 px-3 py-1 text-xs font-medium text-[#5c4331]">
                    {pendingSalesPayments.length} invoice(s)
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
                <p className="mt-2 text-sm text-[#5f5144]">
                  Follow up on unpaid and partially paid sales before they age
                  further.
                </p>
                <div className="mt-4 grid gap-3">
                  {pendingSalesPayments.length === 0 ? (
                    <div className="rounded-2xl border border-[#f2e6dc] bg-white/85 px-4 py-5 text-sm text-[#5f5144]">
                      No pending sales invoices.
                    </div>
                  ) : (
                    pendingSalesPayments.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="flex flex-col gap-3 rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.32)] dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#1f1b16] dark:text-gray-100">
                            {purchase.invoiceNumber} - {purchase.customer}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#5f5144]">
                            <span className="rounded-full border border-[#f0dfcf] bg-[#fff5ea] px-2.5 py-1 font-medium">
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
                          <Button
                            type="button"
                            variant="outline"
                            className="border-[#d8d4cf] bg-[#f5f5f4] text-[#1f1b16] hover:bg-white"
                          >
                            Open sales
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-4">
          <TransactionsTable filters={deferredFilters} />
        </section>

        <section className="grid gap-4">
          <ActivityTimeline
            data={data}
            isLoading={showLoadingState}
            isError={isError}
            dataUpdatedAt={dataUpdatedAt}
            isFetching={isFetching}
          />
        </section>

        <section className="dashboard-chart-surface rounded-[1.75rem]">
          <div className="dashboard-chart-content p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                  Invoice records
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  Invoice history
                </p>
                <p className="mt-1 text-sm text-[#5f5144]">
                  Review the most recent invoices, totals, and current billing status.
                </p>
              </div>
              <Button asChild variant="outline" className="border-[#d8d4cf] bg-[#f5f5f4] text-[#1f1b16] hover:bg-white">
                <Link href="/invoices/history">Open records</Link>
              </Button>
            </div>
            <div className="mt-4 grid gap-3">
              {recentInvoices.length === 0 ? (
                <div className="rounded-2xl border border-[#f2e6dc] bg-white/85 px-4 py-5 text-sm text-[#5f5144]">
                  No invoice records yet.
                </div>
              ) : (
                recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-4 shadow-[0_16px_34px_-26px_rgba(31,27,22,0.32)] dark:border-gray-700 dark:bg-gray-900"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#1f1b16] dark:text-gray-100">
                        {invoice.invoice_number}
                      </p>
                      <p className="mt-1 text-xs text-[#5f5144]">
                        {invoice.customer?.name ?? "Customer"} • {new Date(invoice.date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-[#f0dfcf] bg-[#fff5ea] px-2.5 py-1 font-medium">
                        {formatCurrency(Number(invoice.total))}
                      </span>
                      <span className="rounded-full border border-[#ecdccf] bg-white px-2.5 py-1 font-medium text-[#5c4331]">
                        {invoice.status.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default DashboardClient;
