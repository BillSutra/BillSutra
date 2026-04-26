"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchDashboardOverview, type DashboardOverview } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BellRing } from "lucide-react";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";

const NotificationsPanel = ({
  className,
  data,
  isLoading,
  isError,
  dataUpdatedAt,
  isFetching,
}: {
  className?: string;
  data?: DashboardOverview;
  isLoading?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  isFetching?: boolean;
}) => {
  const router = useRouter();
  const fallbackQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: () => fetchDashboardOverview(),
    enabled: !data && !isLoading,
    ...dashboardQueryDefaults,
  });

  const resolvedData = data ?? fallbackQuery.data;
  const resolvedLoading = isLoading ?? fallbackQuery.isLoading;
  const resolvedError = isError ?? fallbackQuery.isError;
  const resolvedUpdatedAt = dataUpdatedAt ?? fallbackQuery.dataUpdatedAt;
  const resolvedFetching = isFetching ?? fallbackQuery.isFetching;

  const notifications = resolvedData?.notifications ?? [];

  const typeVariant = (type: string) => {
    if (type === "LOW_STOCK") return "pending";
    if (type === "PENDING_INVOICE") return "overdue";
    return "default";
  };

  return (
    <Card
      className={`dashboard-chart-surface h-fit self-start gap-0 rounded-[1.85rem] py-6 ${className}`}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 text-primary shadow-[0_10px_22px_-18px_rgba(37,99,235,0.18)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400">
            <BellRing size={18} />
          </div>
          <div>
            <p className="app-kicker">Attention center</p>
            <CardTitle className="mt-1 text-xl text-foreground dark:text-white">Notifications & alerts</CardTitle>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground dark:text-zinc-400">
          Review stock issues, unpaid invoices, and supplier reminders.
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
          <div className="h-20 app-loading-skeleton" />
        )}
        {resolvedError && (
          <p className="text-sm text-rose-600 dark:text-rose-300">Unable to load alerts.</p>
        )}
        {!resolvedLoading && !resolvedError && (
          <>
            {notifications.length === 0 ? (
              <div className="app-empty-state px-4 py-5 text-sm">
                No alerts right now.
              </div>
            ) : (
              <div className="grid gap-2 text-sm">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => router.push(notification.redirectUrl)}
                    className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_14px_30px_-24px_rgba(15,23,42,0.12)] transition-all duration-200 hover:scale-[1.01] hover:border-blue-200 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 font-semibold leading-5 text-foreground dark:text-white">
                        {notification.title}
                      </p>
                      <Badge variant={typeVariant(notification.type)} className="shrink-0">
                        {notification.type.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground dark:text-zinc-400">
                      {notification.message}
                    </p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Open details
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;
