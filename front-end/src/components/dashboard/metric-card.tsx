import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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
    card:
      "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800",
    label: "text-gray-500",
    value: "text-gray-900 dark:text-gray-100",
    description: "text-gray-500 dark:text-gray-400",
    iconWrap:
      "border border-gray-200 bg-gray-50 text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-300",
    accent: "bg-slate-500",
    glow: "bg-slate-200/60",
    haze: "bg-slate-100/50",
  },
  sales: {
    card:
      "border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,244,0.98),rgba(255,255,255,1))] shadow-[0_20px_48px_-36px_rgba(22,101,52,0.55)]",
    label: "text-emerald-700",
    value: "text-emerald-950",
    description: "text-emerald-700/75",
    iconWrap:
      "border border-emerald-200 bg-emerald-50 text-emerald-700",
    accent: "bg-emerald-500",
    glow: "bg-emerald-200/70",
    haze: "bg-emerald-100/60",
  },
  purchases: {
    card:
      "border-orange-200 bg-[linear-gradient(180deg,rgba(255,247,237,0.98),rgba(255,255,255,1))] shadow-[0_20px_48px_-36px_rgba(194,65,12,0.45)]",
    label: "text-orange-700",
    value: "text-orange-950",
    description: "text-orange-700/75",
    iconWrap:
      "border border-orange-200 bg-orange-50 text-orange-700",
    accent: "bg-orange-500",
    glow: "bg-orange-200/70",
    haze: "bg-orange-100/60",
  },
  profit: {
    card:
      "border-[#e7d8c9] bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(255,255,255,1))] shadow-[0_20px_48px_-38px_rgba(120,53,15,0.34)]",
    label: "text-[#8a6d56]",
    value: "text-[#1f1b16]",
    description: "text-[#8a6d56]",
    iconWrap:
      "border border-[#ecdccf] bg-white/80 text-[#8b5e34]",
    accent: "bg-[#c08457]",
    glow: "bg-[#ecdccf]/70",
    haze: "bg-[#fff0df]/70",
  },
  "pending-sales": {
    card:
      "border-emerald-300 bg-[linear-gradient(135deg,rgba(220,252,231,0.98),rgba(255,255,255,0.96))] shadow-[0_28px_70px_-44px_rgba(22,101,52,0.62)] ring-1 ring-emerald-200/80",
    label: "text-emerald-800",
    value: "text-emerald-950",
    description: "text-emerald-800/75",
    iconWrap:
      "border border-emerald-300 bg-white text-emerald-700",
    accent: "bg-emerald-600",
    glow: "bg-emerald-300/70",
    haze: "bg-emerald-100/70",
  },
  "pending-purchases": {
    card:
      "border-orange-300 bg-[linear-gradient(135deg,rgba(255,237,213,0.98),rgba(255,255,255,0.96))] shadow-[0_28px_70px_-44px_rgba(194,65,12,0.55)] ring-1 ring-orange-200/90",
    label: "text-orange-800",
    value: "text-orange-950",
    description: "text-orange-800/75",
    iconWrap:
      "border border-orange-300 bg-white text-orange-700",
    accent: "bg-orange-500",
    glow: "bg-orange-300/70",
    haze: "bg-orange-100/70",
  },
};

const formatChange = (change: number) => {
  const sign = change > 0 ? "+" : change < 0 ? "-" : "";
  return `${sign}${formatPercent(Math.abs(change))}`;
};

const MetricCard = ({
  title,
  value,
  change,
  icon,
  trendLabel,
  description,
  theme = "default",
  formatValue,
  status,
}: MetricCardProps) => {
  const isPositive = change >= 0;
  const palette = paletteByTheme[theme];
  const resolvedFormatValue =
    formatValue ?? ((amount: number) => amount.toLocaleString("en-IN"));

  return (
    <Card
      className={cn(
        "relative min-h-[202px] overflow-hidden rounded-[1.6rem] gap-0 py-0 transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_32px_70px_-46px_rgba(31,27,22,0.42)]",
        palette.card,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", palette.accent)} />
      <div
        className={cn(
          "absolute -right-10 top-6 h-28 w-28 rounded-full blur-3xl",
          palette.glow,
        )}
      />
      <div
        className={cn(
          "absolute -bottom-8 left-6 h-24 w-24 rounded-full blur-3xl",
          palette.haze,
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
                palette.value,
              )}
            >
              <AnimatedNumber value={value} format={resolvedFormatValue} />
            </p>
            {description ? (
              <p
                className={cn("mt-1.5 max-w-[20rem] text-sm leading-5.5", palette.description)}
              >
                {description}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "ml-3 shrink-0 rounded-2xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
              palette.iconWrap,
            )}
          >
            {icon}
          </div>
        </div>
        <div className="mt-auto flex flex-col gap-2 pb-1 pt-1 text-xs text-[#5f5144]">
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
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                isPositive
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              {formatChange(change)}
            </span>
            <span className="font-medium text-[#6f6257]">
              {trendLabel ?? "vs last period"}
            </span>
          </div>
          <span className="h-1.5 w-14 shrink-0 rounded-full bg-white/70 shadow-[inset_0_1px_2px_rgba(31,27,22,0.08)] dark:bg-gray-700">
          <span
            className={`block h-1.5 rounded-full ${isPositive ? palette.accent : "bg-red-500"}`}
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
