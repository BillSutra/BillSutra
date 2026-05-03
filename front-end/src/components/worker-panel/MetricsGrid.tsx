"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  ReceiptText,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type { WorkerDashboardOverviewResponse } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type MetricsGridProps = {
  overview?: WorkerDashboardOverviewResponse;
  isLoading?: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  Math.round(value).toLocaleString("en-IN");

const getMonthlyChange = (overview?: WorkerDashboardOverviewResponse) => {
  const months = overview?.monthlySales ?? [];
  const current = months.at(-1)?.sales ?? 0;
  const previous = months.at(-2)?.sales ?? 0;
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};

const MetricTile = ({
  title,
  value,
  change,
  icon: Icon,
  tone,
  helper,
  formatValue = formatNumber,
}: {
  title: string;
  value: number;
  change: number;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "amber" | "rose" | "violet" | "slate";
  helper: string;
  formatValue?: (value: number) => string;
}) => {
  const positive = change >= 0;
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25",
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/25",
    violet:
      "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25",
    slate:
      "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700",
  }[tone];

  return (
    <article className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("rounded-xl p-2.5 ring-1", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
            positive
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
          )}
        >
          {positive ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">
        {formatValue(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p>
    </article>
  );
};

const MetricsGrid = ({ overview, isLoading }: MetricsGridProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  const metrics = overview?.metrics;
  const monthlyChange = getMonthlyChange(overview);
  const totalOrders = metrics?.totalOrders ?? 0;
  const invoiceShare =
    totalOrders > 0 ? Math.round(((metrics?.totalInvoices ?? 0) / totalOrders) * 100) : 0;
  const thisMonthShare =
    (metrics?.totalSales ?? 0) > 0
      ? Math.round(((metrics?.thisMonthSales ?? 0) / (metrics?.totalSales ?? 1)) * 100)
      : 0;
  const pendingRatio =
    (metrics?.totalSales ?? 0) > 0
      ? -Math.round(((metrics?.pendingPayments ?? 0) / (metrics?.totalSales ?? 1)) * 100)
      : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <MetricTile
        title="Total Invoices"
        value={metrics?.totalInvoices ?? 0}
        change={invoiceShare}
        icon={ReceiptText}
        tone="blue"
        helper="Share of assigned activity"
      />
      <MetricTile
        title="Total Sales"
        value={metrics?.totalSales ?? 0}
        change={monthlyChange}
        icon={TrendingUp}
        tone="emerald"
        helper="Monthly momentum"
        formatValue={formatCurrency}
      />
      <MetricTile
        title="This Month Sales"
        value={metrics?.thisMonthSales ?? 0}
        change={thisMonthShare}
        icon={WalletCards}
        tone="amber"
        helper="Contribution to lifetime sales"
        formatValue={formatCurrency}
      />
      <MetricTile
        title="Incentive Earned"
        value={metrics?.incentiveEarned ?? 0}
        change={(metrics?.totalSales ?? 0) > 0 ? 1 : 0}
        icon={Sparkles}
        tone="violet"
        helper="Based on assigned sales"
        formatValue={formatCurrency}
      />
      <MetricTile
        title="Pending Payments"
        value={metrics?.pendingPayments ?? 0}
        change={pendingRatio}
        icon={CircleDollarSign}
        tone="rose"
        helper="Lower pending is better"
        formatValue={formatCurrency}
      />
      <MetricTile
        title="Customers Served"
        value={metrics?.customersServed ?? 0}
        change={totalOrders > 0 ? Math.round(((metrics?.customersServed ?? 0) / totalOrders) * 100) : 0}
        icon={UsersRound}
        tone="slate"
        helper="Distinct assigned customers"
      />
    </div>
  );
};

export default MetricsGrid;
