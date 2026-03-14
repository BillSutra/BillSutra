"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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
import QuickActions from "@/components/dashboard/quick-actions";
import ActivityTimeline from "@/components/dashboard/activity-timeline";
import NotificationsPanel from "@/components/dashboard/notifications-panel";
import {
  Banknote,
  CreditCard,
  Package,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardClientProps = {
  name: string;
  image?: string;
  token?: string;
};

const formatCurrency = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const DashboardClient = ({ name, image, token }: DashboardClientProps) => {
  const router = useRouter();
  const [isTokenReady, setIsTokenReady] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(false);

  useEffect(() => {
    const existingToken = window.localStorage.getItem("token")?.trim();
    const hasValidExistingToken =
      Boolean(existingToken) &&
      existingToken !== "undefined" &&
      existingToken !== "null";
    const hasValidSessionToken =
      typeof token === "string" &&
      token.trim().length > 0 &&
      token !== "undefined" &&
      token !== "null";

    if (hasValidSessionToken) {
      window.localStorage.setItem("token", token);
      setHasAuthToken(true);
    } else if (!hasValidExistingToken) {
      window.localStorage.removeItem("token");
      setHasAuthToken(false);
    } else {
      setHasAuthToken(true);
    }

    setIsTokenReady(true);
  }, [token]);

  useEffect(() => {
    if (isTokenReady && !hasAuthToken) {
      router.replace("/login");
    }
  }, [hasAuthToken, isTokenReady, router]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
    enabled: isTokenReady && hasAuthToken,
  });

  const metrics = data?.metrics;
  const invoiceStats = data?.invoiceStats;
  const pendingPayments = data?.pendingPayments ?? [];

  const paymentStatusBadgeClass = (status: string) => {
    if (status === "PAID") return "bg-emerald-100 text-emerald-700";
    if (status === "PARTIAL") return "bg-amber-100 text-amber-700";
    return "bg-rose-100 text-rose-700";
  };

  if (!isTokenReady || !hasAuthToken) {
    return (
      <DashboardLayout
        name={name}
        image={image}
        title={`Welcome back, ${name}.`}
        subtitle="A clean snapshot of revenue, cash flow, inventory health, and customer momentum."
      >
        <div className="mx-auto w-full max-w-7xl">
          <div className="h-48 rounded-2xl bg-[#fdf7f1] animate-pulse" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={`Welcome back, ${name}.`}
      subtitle="A clean snapshot of revenue, cash flow, inventory health, and customer momentum."
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Business analytics
          </p>
          <p className="max-w-2xl text-sm text-gray-500">
            A clean snapshot of revenue, cash flow, inventory health, and
            customer momentum.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && (
            <div className="col-span-full h-28 rounded-2xl bg-[#fdf7f1] animate-pulse" />
          )}
          {metrics && (
            <>
              <MetricCard
                title="Total Sales"
                value={formatCurrency(metrics.totalSales)}
                change={metrics.changes.totalSales}
                icon={<TrendingUp size={18} />}
              />
              <MetricCard
                title="Total Purchases"
                value={formatCurrency(metrics.totalPurchases)}
                change={metrics.changes.totalPurchases}
                icon={<Banknote size={18} />}
              />
              <MetricCard
                title="Today's Profit"
                value={formatCurrency(metrics.profits.today)}
                change={metrics.changes.todayProfit}
                icon={<CreditCard size={18} />}
              />
              <MetricCard
                title="Weekly Profit"
                value={formatCurrency(metrics.profits.weekly)}
                change={metrics.changes.weeklyProfit}
                icon={<Wallet size={18} />}
              />
              <MetricCard
                title="Monthly Profit"
                value={formatCurrency(metrics.profits.monthly)}
                change={metrics.changes.monthlyProfit}
                icon={<Package size={18} />}
              />
              <MetricCard
                title="Pending Payments"
                value={formatCurrency(metrics.pendingPayments)}
                change={metrics.changes.pendingPayments}
                icon={<CreditCard size={18} />}
              />
            </>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <CashFlowChart className="h-full" />
          <div className="flex flex-col gap-4">
            {invoiceStats && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 flex-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Invoice statistics
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Total", value: invoiceStats.total },
                    { label: "Paid", value: invoiceStats.paid },
                    { label: "Pending", value: invoiceStats.pending },
                    { label: "Overdue", value: invoiceStats.overdue },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                        {item.label}
                      </p>
                      <p className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <QuickActions className="flex-1" />
            <NotificationsPanel className="flex-1" />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <ProfitForecast className="h-full" />
          <SalesForecast className="h-full" />
        </section>

        <SalesChart />

        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <ProductSalesChart className="h-full" />
          <InventoryRiskAlerts className="h-full" />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <CustomerInsights className="h-full" />
          <SupplierOverview className="h-full" />
        </section>

        <section className="grid gap-4">
          <TransactionsTable />
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Pending payments
            </p>
            <span className="text-xs text-gray-500">
              {pendingPayments.length} invoice(s)
            </span>
          </div>
          <div className="mt-4 grid gap-3">
            {pendingPayments.length === 0 ? (
              <p className="text-sm text-gray-500">
                No pending sales invoices.
              </p>
            ) : (
              pendingPayments.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {purchase.invoiceNumber} - {purchase.customer}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span>Total: {formatCurrency(purchase.totalAmount)}</span>
                      <span>Paid: {formatCurrency(purchase.paidAmount)}</span>
                      <span>
                        Pending: {formatCurrency(purchase.pendingAmount)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      onClick={() => router.push("/sales")}
                    >
                      Open sales
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <ActivityTimeline />
      </div>
    </DashboardLayout>
  );
};

export default DashboardClient;
