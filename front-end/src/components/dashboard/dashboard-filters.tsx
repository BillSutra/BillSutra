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
        "flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
        {(Object.keys(presetLabels) as DashboardRangePreset[]).map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={filters.range === preset ? "default" : "ghost"}
            onClick={() =>
              update({
                range: preset,
                ...(preset !== "custom" ? { startDate: undefined, endDate: undefined } : {}),
              })
            }
            disabled={disabled}
            className={`h-7 px-3 text-xs ${
              filters.range === preset
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {presetLabels[preset]}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
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
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {granularityLabels[preset]}
          </Button>
        ))}
      </div>

      {filters.range === "custom" && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/80 px-2 py-1">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Start
            <input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(event) => update({ startDate: event.target.value })}
              disabled={disabled}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            End
            <input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(event) => update({ endDate: event.target.value })}
              disabled={disabled}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground shadow-sm"
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default DashboardFilters;
