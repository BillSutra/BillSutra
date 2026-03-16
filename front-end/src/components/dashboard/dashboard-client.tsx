"use client";

import React, { startTransition, useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardOverview } from "@/lib/apiClient";
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
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

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
  });

  const metrics = data?.metrics;
  const invoiceStats = data?.invoiceStats;
  const pendingSalesPayments = data?.pendingPayments ?? [];

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  const showLoadingState = !hydrated || (hasValidSessionToken && isLoading);

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
        <header className="rounded-[1.75rem] border border-[#ecdccf] bg-[linear-gradient(135deg,rgba(255,247,239,0.96),rgba(255,255,255,0.92))] px-6 py-5 shadow-[0_28px_70px_-48px_rgba(31,27,22,0.42)]">
          <p className="text-xs uppercase tracking-[0.28em] text-[#8a6d56]">
            Business command center
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {data?.filters?.label ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ecdccf] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                {data.filters.label}
              </div>
            ) : null}
            {dataUpdatedAt ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#ecdccf] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                Updated {formatTimeLabel(dataUpdatedAt)}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="max-w-3xl text-2xl font-semibold tracking-tight text-[#1f1b16]">
                Revenue, purchases, receivables, and supplier dues in one
                operating view.
              </p>
              <p className="mt-2 max-w-2xl text-sm text-[#8a6d56]">
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
                  className:
                    "border-emerald-200 bg-emerald-50/80 text-emerald-900",
                },
                {
                  label: "Purchases",
                  value: metrics?.totalPurchases ?? 0,
                  className:
                    "border-orange-200 bg-orange-50/80 text-orange-900",
                },
                {
                  label: "Pending Sales",
                  value: metrics?.pendingPayments ?? 0,
                  className:
                    "border-emerald-300 bg-[linear-gradient(135deg,rgba(220,252,231,0.9),rgba(255,255,255,0.9))] text-emerald-900",
                },
                {
                  label: "Pending Purchases",
                  value: metrics?.payables ?? 0,
                  className:
                    "border-orange-300 bg-[linear-gradient(135deg,rgba(255,237,213,0.9),rgba(255,255,255,0.9))] text-orange-900",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-4 py-3 shadow-[0_14px_30px_-24px_rgba(31,27,22,0.35)] ${item.className}`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-90">
                    {item.label}
                  </p>
                  <p className="mt-1 text-base font-semibold leading-tight">
                    <AnimatedNumber value={item.value} format={formatCurrency} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

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
                theme="sales"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Total Purchases"
                value={metrics.totalPurchases}
                change={metrics.changes.totalPurchases}
                icon={<Banknote size={18} />}
                description="Spend committed to stock and supply purchases."
                theme="purchases"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Pending Sales Payments"
                value={metrics.pendingPayments}
                change={metrics.changes.pendingPayments}
                icon={<CreditCard size={18} />}
                trendLabel="to collect"
                description="Outstanding customer payments still to collect."
                theme="pending-sales"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Pending Purchase Payments"
                value={metrics.payables}
                change={metrics.changes.payables}
                icon={<Banknote size={18} />}
                trendLabel="to pay"
                description="Outstanding supplier payments for recorded purchases."
                theme="pending-purchases"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Today's Profit"
                value={metrics.profits.today}
                change={metrics.changes.todayProfit}
                icon={<CreditCard size={18} />}
                description="Today's net after purchases and expenses."
                theme="profit"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Weekly Profit"
                value={metrics.profits.weekly}
                change={metrics.changes.weeklyProfit}
                icon={<Wallet size={18} />}
                description="Rolling 7-day profit performance."
                theme="profit"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Monthly Profit"
                value={metrics.profits.monthly}
                change={metrics.changes.monthlyProfit}
                icon={<Package size={18} />}
                description="Current month profit after all outflows."
                theme="profit"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
                  refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
                }}
              />
              <MetricCard
                title="Yearly Profit"
                value={metrics.profits.yearly}
                change={metrics.changes.yearlyProfit}
                icon={<Landmark size={18} />}
                description="Year-to-date profit after purchases and expenses."
                theme="profit"
                formatValue={formatCurrency}
                status={{
                  isLoading,
                  isFetching,
                  isError,
                  dataUpdatedAt,
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
      </div>
    </DashboardLayout>
  );
};

export default DashboardClient;
