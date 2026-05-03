"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ActivityFeed from "@/components/worker-panel/ActivityFeed";
import MetricsGrid from "@/components/worker-panel/MetricsGrid";
import PasswordCard from "@/components/worker-panel/PasswordCard";
import QuickActions from "@/components/worker-panel/QuickActions";
import WorkerHero from "@/components/worker-panel/WorkerHero";
import WorkerHistorySection from "@/components/worker-panel/WorkerHistorySection";
import WorkerProfileCard from "@/components/worker-panel/WorkerProfileCard";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";
import {
  fetchWorkerDashboardOverview,
  fetchWorkerHistory,
  fetchWorkerIncentives,
  fetchWorkerProfile,
  type WorkerDashboardOverviewResponse,
  type WorkerHistoryEntry,
  type WorkerIncentiveResponse,
  type WorkerProfileResponse,
} from "@/lib/apiClient";

const PerformanceCharts = dynamic(
  () => import("@/components/worker-panel/PerformanceCharts"),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[360px] animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    ),
  },
);

type WorkerPanelClientProps = {
  name: string;
  image?: string;
};

const WorkerPanelClient = ({ name, image }: WorkerPanelClientProps) => {
  const { safeT } = useI18n();
  const [localActivities, setLocalActivities] = React.useState<
    Array<{
      id: string;
      type: "SECURITY" | "PROFILE";
      title: string;
      description: string;
      createdAt: string;
    }>
  >([]);

  const profileQuery = useQuery<WorkerProfileResponse>({
    queryKey: ["worker", "profile"],
    queryFn: fetchWorkerProfile,
    staleTime: 5 * 60_000,
  });

  const overviewQuery = useQuery<WorkerDashboardOverviewResponse>({
    queryKey: ["worker", "dashboard", "overview"],
    queryFn: fetchWorkerDashboardOverview,
    staleTime: 60_000,
  });

  const incentiveQuery = useQuery<WorkerIncentiveResponse>({
    queryKey: ["worker", "dashboard", "incentives"],
    queryFn: fetchWorkerIncentives,
    staleTime: 60_000,
  });

  const recentHistoryQuery = useQuery({
    queryKey: ["worker", "dashboard", "history", "recent"],
    queryFn: () => fetchWorkerHistory({ page: 1, limit: 6 }),
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (
      profileQuery.isError ||
      overviewQuery.isError ||
      incentiveQuery.isError ||
      recentHistoryQuery.isError
    ) {
      toast.error("Some worker dashboard data could not be loaded.");
    }
  }, [
    incentiveQuery.isError,
    overviewQuery.isError,
    profileQuery.isError,
    recentHistoryQuery.isError,
  ]);

  const addLocalActivity = React.useCallback(
    (activity: Omit<(typeof localActivities)[number], "id" | "createdAt">) => {
      setLocalActivities((current) => [
        {
          ...activity,
          id: `${activity.type}-${Date.now()}`,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    },
    [],
  );

  const downloadReport = React.useCallback(() => {
    const profile = profileQuery.data;
    const overview = overviewQuery.data;
    const incentive = incentiveQuery.data;
    const history = recentHistoryQuery.data?.entries ?? [];

    if (!profile || !overview) {
      toast.error("Report data is still loading.");
      return;
    }

    const rows = [
      ["Worker", profile.name],
      ["Employee ID", profile.id],
      ["Role", profile.accessRole],
      ["Status", profile.status],
      ["Total invoices", overview.metrics.totalInvoices],
      ["Total sales", overview.metrics.totalSales],
      ["This month sales", overview.metrics.thisMonthSales],
      ["Incentive earned", overview.metrics.incentiveEarned],
      ["Pending payments", overview.metrics.pendingPayments],
      ["Customers served", overview.metrics.customersServed],
      ["Incentive model", incentive?.incentiveType ?? "NONE"],
      [],
      ["Recent activity"],
      ["Type", "Reference", "Customer", "Amount", "Status", "Date"],
      ...history.map((entry: WorkerHistoryEntry) => [
        entry.type,
        entry.reference,
        entry.customerName ?? "Walk-in Customer",
        entry.amount,
        entry.status,
        entry.date,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `worker-report-${profile.id.slice(-8)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Worker report downloaded.");
  }, [
    incentiveQuery.data,
    overviewQuery.data,
    profileQuery.data,
    recentHistoryQuery.data?.entries,
  ]);

  const profileImage = profileQuery.data?.imageUrl ?? image;

  if (profileQuery.isError) {
    return (
      <DashboardLayout
        name={name}
        image={image}
        title={safeT("workerPanel.title", "Worker Dashboard")}
        subtitle={safeT(
          "workerPanel.subtitle",
          "Manage your tasks, invoices and attendance",
        )}
      >
        <div className="flex min-h-[420px] items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Worker profile
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              We could not load your profile
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your session is still intact. Retry the request or refresh the page.
            </p>
            <Button
              className="mt-6"
              onClick={() => void profileQuery.refetch()}
              disabled={profileQuery.isFetching}
            >
              {profileQuery.isFetching ? "Retrying..." : "Retry"}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={safeT("workerPanel.title", "Worker Dashboard")}
      subtitle={safeT(
        "workerPanel.subtitle",
        "Manage your tasks, invoices and attendance",
      )}
    >
      <div className="space-y-6 pb-12">
        <WorkerHero
          profile={profileQuery.data}
          overview={overviewQuery.data}
          image={profileImage}
          isLoading={profileQuery.isLoading || overviewQuery.isLoading}
          onDownloadReport={downloadReport}
        />

        <MetricsGrid
          overview={overviewQuery.data}
          isLoading={overviewQuery.isLoading}
        />

        <PerformanceCharts
          overview={overviewQuery.data}
          incentive={incentiveQuery.data}
          isLoading={overviewQuery.isLoading || incentiveQuery.isLoading}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px] 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="space-y-6">
            <WorkerProfileCard
              profile={profileQuery.data}
              image={profileImage}
              isLoading={profileQuery.isLoading}
              onProfileUpdated={() =>
                addLocalActivity({
                  type: "PROFILE",
                  title: "Profile updated",
                  description: "Your worker profile details were saved.",
                })
              }
            />
            <WorkerHistorySection />
          </div>

          <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
            <QuickActions
              profile={profileQuery.data}
              onDownloadReport={downloadReport}
            />
            <ActivityFeed
              entries={recentHistoryQuery.data?.entries}
              localActivities={localActivities}
              isLoading={recentHistoryQuery.isLoading}
            />
            <PasswordCard
              onPasswordChanged={() =>
                addLocalActivity({
                  type: "SECURITY",
                  title: "Password updated",
                  description: "Your worker login password was changed.",
                })
              }
            />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WorkerPanelClient;
