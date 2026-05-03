"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon, Sparkles } from "lucide-react";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  WorkerDashboardOverviewResponse,
  WorkerIncentiveResponse,
} from "@/lib/apiClient";

type PerformanceChartsProps = {
  overview?: WorkerDashboardOverviewResponse;
  incentive?: WorkerIncentiveResponse;
  isLoading?: boolean;
};

const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const tooltipStyle = {
  borderRadius: "14px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
};

const ChartShell = ({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof BarChart3;
  children: React.ReactNode;
}) => (
  <Card className="min-h-[360px]">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </CardTitle>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </CardHeader>
    <CardContent>
      <div className="h-64 w-full">{children}</div>
    </CardContent>
  </Card>
);

const PerformanceCharts = ({
  overview,
  incentive,
  isLoading,
}: PerformanceChartsProps) => {
  if (isLoading) {
    return (
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[360px] animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  const monthlySales = overview?.monthlySales ?? [];
  const weeklyPerformance = overview?.weeklyPerformance ?? [];
  const incentiveTrend = incentive?.monthlyBreakdown?.slice(-6) ?? [];
  const hasChartData =
    monthlySales.some((entry) => entry.sales > 0) ||
    weeklyPerformance.some((entry) => entry.sales > 0 || entry.orders > 0) ||
    incentiveTrend.some((entry) => entry.incentive > 0);

  if (!hasChartData) {
    return (
      <FriendlyEmptyState
        icon={BarChart3}
        title="Analytics will build as work comes in"
        description="Monthly sales, weekly performance, and incentive trends appear here once assigned invoices or sales are recorded."
        hint="Create or complete your first assigned activity to unlock charts."
      />
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ChartShell
        title="Monthly Sales"
        description="Assigned sales and invoice value for the last 6 months."
        icon={BarChart3}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlySales}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(value) => [formatCompact(Number(value)), "Sales"]} contentStyle={tooltipStyle} />
            <Bar dataKey="sales" radius={[8, 8, 0, 0]} fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        title="Weekly Performance"
        description="Daily assigned value and order volume over 7 days."
        icon={LineChartIcon}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weeklyPerformance}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell
        title="Incentive Trend"
        description="Recent incentive movement based on your configured rule."
        icon={Sparkles}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={incentiveTrend}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(value) => formatCompact(Number(value))} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(value) => [formatCompact(Number(value)), "Incentive"]} contentStyle={tooltipStyle} />
            <Bar dataKey="incentive" radius={[8, 8, 0, 0]} fill="#8b5cf6" />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
};

export default PerformanceCharts;
