"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import MetricCard from "@/components/dashboard/metric-card";
import {
  fetchWorkerDashboardOverview,
} from "@/lib/apiClient";
import { ReceiptText, TrendingUp, Wallet, Sparkles } from "lucide-react";

const WorkerPerformanceSection = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["worker", "dashboard", "overview"],
    queryFn: fetchWorkerDashboardOverview,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-[188px] animate-pulse rounded-[1.6rem] bg-muted"
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Failed to load performance data
          </p>
        </CardContent>
      </Card>
    );
  }

  const metrics = data?.metrics;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Invoices"
            value={metrics?.totalInvoices ?? 0}
            change={0}
            trendLabel=""
            icon={<ReceiptText className="h-5 w-5" />}
            theme="sales"
            formatValue={(v) => Math.round(v).toLocaleString("en-IN")}
          />
          <MetricCard
            title="Total Sales"
            value={metrics?.totalSales ?? 0}
            change={0}
            trendLabel=""
            icon={<TrendingUp className="h-5 w-5" />}
            theme="sales"
            formatValue={(v) =>
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(v)
            }
          />
          <MetricCard
            title="This Month"
            value={metrics?.thisMonthSales ?? 0}
            change={0}
            trendLabel=""
            icon={<Wallet className="h-5 w-5" />}
            theme="profit"
            formatValue={(v) =>
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(v)
            }
          />
          <MetricCard
            title="Incentive Earned"
            value={metrics?.incentiveEarned ?? 0}
            change={0}
            trendLabel=""
            icon={<Sparkles className="h-5 w-5" />}
            theme="default"
            formatValue={(v) =>
              new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }).format(v)
            }
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Additional Stats
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="mt-1 text-2xl font-semibold">
                {(metrics?.totalOrders ?? 0).toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Avg Order Value</p>
              <p className="mt-1 text-2xl font-semibold">
                {new Intl.NumberFormat("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                }).format(metrics?.averageOrderValue ?? 0)}
              </p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Incentive Rate</p>
              <p className="mt-1 text-2xl font-semibold">
                {metrics?.totalSales && metrics.totalSales > 0
                  ? (
                      ((metrics.incentiveEarned / metrics.totalSales) * 100) /
                      100
                    ).toFixed(2) +
                    "%"
                  : "0%"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkerPerformanceSection;
