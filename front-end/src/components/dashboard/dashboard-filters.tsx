"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardRangePreset = "7d" | "30d" | "90d" | "ytd" | "custom";
export type DashboardGranularity = "day" | "week" | "month";

export type DashboardFilters = {
  range: DashboardRangePreset;
  startDate?: string;
  endDate?: string;
  granularity?: DashboardGranularity;
};

const presetLabels: Record<DashboardRangePreset, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
  custom: "Custom",
};

const granularityLabels: Record<DashboardGranularity, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
};

const DashboardFilters = ({
  filters,
  onChange,
  className,
  disabled,
}: {
  filters: DashboardFilters;
  onChange: (next: DashboardFilters) => void;
  className?: string;
  disabled?: boolean;
}) => {
  const update = (partial: Partial<DashboardFilters>) =>
    onChange({ ...filters, ...partial });

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow-[0_12px_28px_-22px_rgba(15,23,42,0.12)] sm:w-auto sm:flex-row sm:flex-wrap sm:items-center dark:border-zinc-800 dark:bg-zinc-950/95",
        className,
      )}
    >
      <div className="overflow-x-auto pb-1 sm:pb-0">
        <div className="flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(Object.keys(presetLabels) as DashboardRangePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={filters.range === preset ? "default" : "ghost"}
              onClick={() =>
                update({
                  range: preset,
                  ...(preset !== "custom"
                    ? { startDate: undefined, endDate: undefined }
                    : {}),
                })
              }
              disabled={disabled}
              className={`h-7 px-3 text-xs ${
                filters.range === preset
                  ? "bg-primary text-white hover:bg-primary/92"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }`}
            >
              {presetLabels[preset]}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-1 sm:pb-0">
        <div className="flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(Object.keys(granularityLabels) as DashboardGranularity[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={filters.granularity === preset ? "default" : "ghost"}
              onClick={() => update({ granularity: preset })}
              disabled={disabled}
              className={`h-7 px-3 text-xs ${
                filters.granularity === preset
                  ? "bg-primary text-white hover:bg-primary/92"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }`}
            >
              {granularityLabels[preset]}
            </Button>
          ))}
        </div>
      </div>

      {filters.range === "custom" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.1)] dark:border-zinc-800 dark:bg-zinc-900">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-zinc-400">
            Start
            <input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(event) => update({ startDate: event.target.value })}
              disabled={disabled}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:[color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground dark:text-zinc-400">
            End
            <input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(event) => update({ endDate: event.target.value })}
              disabled={disabled}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:[color-scheme:dark]"
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
