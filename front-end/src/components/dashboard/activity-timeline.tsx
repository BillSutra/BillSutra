"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardOverview, type DashboardOverview } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import { formatDateLabel } from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const ActivityTimeline = ({
  data,
  isLoading,
  isError,
  dataUpdatedAt,
  isFetching,
}: {
  data?: DashboardOverview;
  isLoading?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  isFetching?: boolean;
}) => {
  const fallbackQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
    enabled: !data && !isLoading,
    ...dashboardQueryDefaults,
  });

  const resolvedData = data ?? fallbackQuery.data;
  const resolvedLoading = isLoading ?? fallbackQuery.isLoading;
  const resolvedError = isError ?? fallbackQuery.isError;
  const resolvedUpdatedAt = dataUpdatedAt ?? fallbackQuery.dataUpdatedAt;
  const resolvedFetching = isFetching ?? fallbackQuery.isFetching;

  return (
    <Card className="dashboard-chart-surface h-fit self-start gap-0 py-6 rounded-[1.75rem]">
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-2 text-[#8b5e34]">
            <History size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
              Recent movement
            </p>
            <CardTitle className="mt-1 text-lg text-[#1f1b16]">
              Activity timeline
            </CardTitle>
          </div>
        </div>
        <p className="text-sm text-[#5f5144]">
          A quick stream of the latest recorded sales and purchases.
        </p>
        <DashboardCardStatus
          isLoading={resolvedLoading}
          isFetching={resolvedFetching}
          isError={resolvedError}
          dataUpdatedAt={resolvedUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-3">
        {resolvedLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {resolvedError && (
          <p className="text-sm text-[#b45309]">Unable to load activity.</p>
        )}
        {!resolvedLoading &&
          !resolvedError &&
          resolvedData &&
          resolvedData.activity.length === 0 && (
            <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 px-4 py-5 text-sm text-[#5f5144]">
              No activity yet.
            </div>
          )}
        {!resolvedLoading &&
          !resolvedError &&
          resolvedData &&
          resolvedData.activity.length > 0 && (
            <div className="grid gap-3">
              {resolvedData.activity.map((item) => (
                <div
                  key={`${item.time}-${item.label}`}
                  className="relative rounded-2xl border border-[#f2e6dc] bg-white/90 px-4 py-3 text-sm shadow-[0_14px_30px_-24px_rgba(31,27,22,0.3)]"
                >
                  <div className="flex items-center justify-between gap-3 pl-6">
                    <span className="absolute left-4 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#c08457]" />
                    <span className="text-[#4b3a2a]">{item.label}</span>
                    <span className="rounded-full border border-[#f0dfcf] bg-[#fff5ea] px-2.5 py-1 text-xs font-medium text-[#5f5144]">
                      {formatDateLabel(item.time)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
};

export default ActivityTimeline;
