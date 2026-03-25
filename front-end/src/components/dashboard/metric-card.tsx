import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedNumber from "@/components/dashboard/AnimatedNumber";
import { clamp, formatPercent } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

type MetricCardTheme =
  | "default"
  | "sales"
  | "purchases"
  | "profit"
  | "pending-sales"
  | "pending-purchases";

type MetricCardProps = {
  title: string;
  value: number;
  change: number;
  icon: React.ReactNode;
  trendLabel?: string;
  description?: string;
  helperText?: string;
  theme?: MetricCardTheme;
  formatValue?: (value: number) => string;
  status?: {
    isLoading?: boolean;
    isFetching?: boolean;
    isError?: boolean;
    dataUpdatedAt?: number;
    refreshIntervalMs?: number;
  };
};

const paletteByTheme: Record<
  MetricCardTheme,
  {
    card: string;
    label: string;
    value: string;
    description: string;
    iconWrap: string;
    accent: string;
    glow: string;
    haze: string;
  }
> = {
  default: {
    card: "border-border/80 bg-card/92",
    label: "text-muted-foreground",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-border/70 bg-muted/60 text-foreground",
    accent: "bg-foreground/80",
    glow: "bg-sky-500/10",
    haze: "bg-primary/8",
  },
  sales: {
    card: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    label: "text-emerald-700 dark:text-emerald-200",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-emerald-200/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200",
    accent: "bg-emerald-500",
    glow: "bg-emerald-500/15",
    haze: "bg-emerald-300/15",
  },
  purchases: {
    card: "border-orange-200/60 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20",
    label: "text-orange-700 dark:text-orange-200",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-orange-200/60 bg-orange-50/80 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-200",
    accent: "bg-orange-500",
    glow: "bg-orange-500/15",
    haze: "bg-orange-300/15",
  },
  profit: {
    card: "border-sky-200/60 bg-sky-50/55 dark:border-sky-900/40 dark:bg-sky-950/20",
    label: "text-sky-700 dark:text-sky-200",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-sky-200/60 bg-sky-50/80 text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-200",
    accent: "bg-sky-500",
    glow: "bg-sky-500/15",
    haze: "bg-sky-300/15",
  },
  "pending-sales": {
    card: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
    label: "text-emerald-700 dark:text-emerald-200",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-emerald-200/60 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200",
    accent: "bg-emerald-600",
    glow: "bg-emerald-500/15",
    haze: "bg-emerald-300/15",
  },
  "pending-purchases": {
    card: "border-orange-200/60 bg-orange-50/50 dark:border-orange-900/40 dark:bg-orange-950/20",
    label: "text-orange-700 dark:text-orange-200",
    value: "text-foreground",
    description: "text-muted-foreground",
    iconWrap: "border-orange-200/60 bg-orange-50/80 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-200",
    accent: "bg-orange-500",
    glow: "bg-orange-500/15",
    haze: "bg-orange-300/15",
  },
};

const MAX_VISIBLE_CHANGE = 999.9;

const formatChange = (change: number) => {
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  const absChange = Math.abs(change);
  if (absChange > MAX_VISIBLE_CHANGE) {
    return `${sign}${formatPercent(MAX_VISIBLE_CHANGE)}+`;
  }
  return `${sign}${formatPercent(absChange)}`;
};

const MetricCard = ({
  title,
  value,
  change,
  icon,
  trendLabel,
  description,
  helperText,
  theme = "default",
  formatValue,
  status,
}: MetricCardProps) => {
  const palette = paletteByTheme[theme];
  const resolvedFormatValue =
    formatValue ?? ((amount: number) => amount.toLocaleString("en-IN"));
  const isProfitLoss = theme === "profit" && value < 0;
  const isChangePositive = change > 0;
  const isChangeNegative = change < 0;
  const isLossImproving = isProfitLoss && isChangePositive;
  const isLossWorsening = isProfitLoss && isChangeNegative;
  const isExtremeChange = Math.abs(change) > MAX_VISIBLE_CHANGE;

  const trendBadgeClass = cn(
    "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
    isLossImproving
      ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
      : isLossWorsening || isChangeNegative
        ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        : isChangePositive
          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  );

  const trendBarClass = isLossImproving
    ? "bg-amber-500"
    : isLossWorsening || isChangeNegative
      ? "bg-red-500"
      : isChangePositive
        ? palette.accent
        : "bg-slate-400";

  const changeCopy =
    theme === "profit" && isExtremeChange
      ? isProfitLoss
        ? isChangePositive
          ? "Loss improved"
          : isChangeNegative
            ? "Loss widened"
            : "Flat"
        : isChangePositive
          ? "Profit surged"
          : isChangeNegative
            ? "Profit dropped"
            : "Flat"
      : formatChange(change);

  const changeIcon = !isChangePositive && !isChangeNegative
    ? <Minus size={14} />
    : isChangePositive
      ? <ArrowUpRight size={14} />
      : <ArrowDownRight size={14} />;

  return (
    <Card
      className={cn(
        "relative min-h-[202px] overflow-hidden rounded-[1.6rem] gap-0 py-0 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_32px_70px_-46px_rgba(31,27,22,0.28)]",
        palette.card,
        isProfitLoss &&
          "border-rose-200/70 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20",
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          isProfitLoss ? "bg-rose-500" : palette.accent,
        )}
      />
      <div
        className={cn(
          "absolute -right-10 top-6 h-28 w-28 rounded-full blur-3xl",
          isProfitLoss ? "bg-rose-500/15" : palette.glow,
        )}
      />
      <div
        className={cn(
          "absolute -bottom-8 left-6 h-24 w-24 rounded-full blur-3xl",
          isProfitLoss ? "bg-rose-300/15" : palette.haze,
        )}
      />
      <CardContent className="relative z-10 flex h-full flex-col gap-2.5 px-5 pb-6.5 pt-7 sm:px-6 sm:pb-7 sm:pt-7.5">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.18em]",
                palette.label,
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                "mt-3 text-[1.9rem] font-medium leading-none tracking-tight sm:text-[2rem]",
                isProfitLoss ? "text-rose-700 dark:text-rose-200" : palette.value,
              )}
            >
              <AnimatedNumber value={value} format={resolvedFormatValue} />
            </p>
            {description ? (
              <p
                className={cn(
                  "mt-1.5 max-w-[20rem] text-sm leading-5.5",
                  palette.description,
                )}
              >
                {description}
              </p>
            ) : null}
            {helperText ? (
              <p className="mt-2 text-xs text-muted-foreground">{helperText}</p>
            ) : null}
          </div>
          <div
            className={cn(
              "ml-3 shrink-0 rounded-2xl border p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]",
              isProfitLoss
                ? "border-rose-200/60 bg-rose-50/80 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-200"
                : palette.iconWrap,
            )}
          >
            {icon}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2 pb-1 pt-1 text-xs text-muted-foreground">
          {status ? (
            <DashboardCardStatus
              isLoading={status.isLoading}
              isFetching={status.isFetching}
              isError={status.isError}
              dataUpdatedAt={status.dataUpdatedAt}
              refreshIntervalMs={
                status.refreshIntervalMs ?? DASHBOARD_REFRESH_INTERVAL_MS
              }
              className="text-[11px]"
            />
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
              <span className={trendBadgeClass}>
                {changeIcon}
                {changeCopy}
              </span>
              <span className="font-medium text-muted-foreground">
                {trendLabel ?? "vs last period"}
              </span>
            </div>
            <span className="h-1.5 w-14 shrink-0 rounded-full bg-white/70 shadow-[inset_0_1px_2px_rgba(31,27,22,0.08)] dark:bg-gray-700">
              <span
                className={cn("block h-1.5 rounded-full", trendBarClass)}
                style={{ width: `${clamp(Math.abs(change) * 2, 4, 100)}%` }}
              />
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
