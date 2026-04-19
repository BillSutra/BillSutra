"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { HelpCircle, Info, Sparkles } from "lucide-react";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  fetchWorkerIncentives,
  type WorkerIncentiveResponse,
} from "@/lib/apiClient";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const getIncentiveTypeLabel = (
  type: WorkerIncentiveResponse["incentiveType"],
) => {
  if (type === "PERCENTAGE") return "Percentage based";
  if (type === "PER_SALE") return "Per activity";
  return "Not configured";
};

const getIncentiveValueLabel = (
  type: WorkerIncentiveResponse["incentiveType"],
  value: number,
) => {
  if (type === "PERCENTAGE") return `${value}% of assigned value`;
  if (type === "PER_SALE") return `${formatCurrency(value)} per invoice / sale`;
  return "No rate set";
};

const IncentiveSkeleton = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="h-5 w-5" />
        Incentives
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="h-28 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
        <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-muted" />
    </CardContent>
  </Card>
);

const WorkerIncentiveSection = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["worker", "dashboard", "incentives"],
    queryFn: fetchWorkerIncentives,
    staleTime: 60_000,
  });

  React.useEffect(() => {
    if (isError) {
      toast.error("Unable to load incentive details right now.");
    }
  }, [isError]);

  if (isLoading) {
    return <IncentiveSkeleton />;
  }

  const incentive = data as WorkerIncentiveResponse | undefined;
  const hasIncentiveData =
    incentive &&
    (incentive.totalIncentiveEarned > 0 ||
      incentive.incentiveType !== "NONE" ||
      incentive.monthlyBreakdown.some((entry) => entry.incentive > 0));

  return (
    <Card className="transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Incentives
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Track what you have earned and how it is calculated.
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="How incentives are calculated"
                >
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="font-medium">How incentives are calculated</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {incentive?.calculationNote ??
                    "Your admin can configure either a percentage-based or per-activity incentive."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isError ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            Incentive details could not be loaded. Please try again in a moment.
          </div>
        ) : !hasIncentiveData ? (
          <FriendlyEmptyState
            icon={Sparkles}
            title="No incentives yet"
            description="Your incentive summary will appear here as soon as incentive rules or eligible activity are available."
            hint="If you expect incentives, check with your admin to confirm your plan is configured."
          />
        ) : (
          <>
            <div className="rounded-[1.75rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm dark:border-amber-900/40 dark:from-amber-950/20 dark:to-orange-950/10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-300">
                Total Incentive Earned
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {formatCurrency(incentive?.totalIncentiveEarned ?? 0)}
              </p>
              <p className="mt-2 text-sm text-amber-900/75 dark:text-amber-100/75">
                {incentive?.calculationNote}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Incentive Model
                </p>
                <p className="mt-3 text-xl font-semibold text-foreground">
                  {getIncentiveTypeLabel(incentive?.incentiveType ?? "NONE")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getIncentiveValueLabel(
                    incentive?.incentiveType ?? "NONE",
                    incentive?.incentiveValue ?? 0,
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                    Current Rule
                  </p>
                </div>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  {incentive?.calculationNote}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Monthly Incentive Breakdown
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    A rolling view of your earnings over the last 12 months.
                  </p>
                </div>
              </div>

              <div className="mt-4 h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incentive?.monthlyBreakdown ?? []}>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                      tickFormatter={(value) =>
                        new Intl.NumberFormat("en-IN", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        }).format(Number(value))
                      }
                    />
                    <RechartsTooltip
                      formatter={(value) => [
                        formatCurrency(Number(value ?? 0)),
                        "Incentive",
                      ]}
                      contentStyle={{
                        borderRadius: "14px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="incentive" radius={[8, 8, 0, 0]}>
                      {(incentive?.monthlyBreakdown ?? []).map((entry, index) => (
                        <Cell
                          key={`${entry.month}-${index}`}
                          fill={
                            entry.incentive > 0
                              ? "hsl(var(--primary))"
                              : "hsl(var(--muted))"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkerIncentiveSection;
