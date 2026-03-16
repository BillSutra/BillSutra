"use client";

import React, { useEffect, useMemo, useState } from "react";
import { formatTimeLabel } from "@/lib/dashboardUtils";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { cn } from "@/lib/utils";

type StatusVariant = "live" | "updating" | "error";

type DashboardCardStatusProps = {
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  refreshIntervalMs?: number;
  showNextUpdate?: boolean;
  className?: string;
};

const statusMeta: Record<StatusVariant, { label: string; dot: string; text: string }> = {
  live: {
    label: "Live",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  updating: {
    label: "Updating",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  error: {
    label: "Error",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
};

const DashboardCardStatus = ({
  isLoading,
  isFetching,
  isError,
  dataUpdatedAt,
  refreshIntervalMs = DASHBOARD_REFRESH_INTERVAL_MS,
  showNextUpdate = true,
  className,
}: DashboardCardStatusProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!showNextUpdate || refreshIntervalMs <= 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [refreshIntervalMs, showNextUpdate]);

  const status: StatusVariant = useMemo(() => {
    if (isError) return "error";
    if (isLoading || isFetching) return "updating";
    return "live";
  }, [isError, isFetching, isLoading]);

  const nextUpdateAt =
    showNextUpdate && refreshIntervalMs > 0 && dataUpdatedAt
      ? dataUpdatedAt + refreshIntervalMs
      : undefined;

  const nextUpdateInSeconds = nextUpdateAt
    ? Math.max(0, Math.ceil((nextUpdateAt - now) / 1000))
    : undefined;

  const meta = statusMeta[status];

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      <span className={cn("inline-flex items-center gap-2 font-semibold", meta.text)}>
        <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
        {meta.label}
      </span>
      <span className="text-[#8a6d56]">
        Last updated {dataUpdatedAt ? formatTimeLabel(dataUpdatedAt) : "--"}
      </span>
      {nextUpdateInSeconds !== undefined ? (
        <span className="text-[#8a6d56]">Next update in {nextUpdateInSeconds}s</span>
      ) : null}
    </div>
  );
};

export default DashboardCardStatus;
