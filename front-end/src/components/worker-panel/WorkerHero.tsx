"use client";

import Link from "next/link";
import {
  CalendarDays,
  Download,
  FileText,
  PencilLine,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import UserAvtar from "@/components/common/UserAvtar";
import type {
  WorkerDashboardOverviewResponse,
  WorkerProfileResponse,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type WorkerHeroProps = {
  profile?: WorkerProfileResponse;
  overview?: WorkerDashboardOverviewResponse;
  image?: string;
  isLoading?: boolean;
  onDownloadReport: () => void;
};

const formatDate = (value?: string | null) => {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPerformanceScore = (overview?: WorkerDashboardOverviewResponse) => {
  const metrics = overview?.metrics;
  if (!metrics) return 0;

  const activityScore = Math.min(metrics.totalOrders * 6, 40);
  const salesScore = Math.min(metrics.thisMonthSales / 2500, 35);
  const collectionScore =
    metrics.pendingPayments > 0 && metrics.totalSales > 0
      ? Math.max(0, 25 - (metrics.pendingPayments / metrics.totalSales) * 25)
      : 25;

  return Math.round(Math.min(activityScore + salesScore + collectionScore, 100));
};

const WorkerHero = ({
  profile,
  overview,
  image,
  isLoading,
  onDownloadReport,
}: WorkerHeroProps) => {
  const score = getPerformanceScore(overview);
  const status = profile?.status?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  if (isLoading) {
    return (
      <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="h-40 animate-pulse rounded-[1.4rem] bg-muted" />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.8rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fbff_48%,#eef8f4_100%)] p-5 shadow-[0_24px_55px_-42px_rgba(15,23,42,0.38)] dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_34%),linear-gradient(135deg,#18181b_0%,#111827_52%,#082f2a_100%)] sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            <div className="rounded-[1.4rem] bg-white/70 p-1 shadow-sm ring-1 ring-white/80 dark:bg-white/10 dark:ring-white/10">
              <UserAvtar
                name={profile?.name ?? "Worker"}
                image={image}
                className="h-20 w-20 text-xl sm:h-24 sm:w-24"
              />
            </div>
            <span
              className={cn(
                "absolute -right-1 bottom-2 h-4 w-4 rounded-full border-2 border-white dark:border-zinc-900",
                status === "ACTIVE" ? "bg-emerald-500" : "bg-rose-500",
              )}
            />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={status === "ACTIVE" ? "paid" : "overdue"}>
                {status === "ACTIVE" ? "Active" : "Inactive"}
              </Badge>
              <Badge className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/25 dark:bg-blue-500/10 dark:text-blue-200">
                <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                {profile?.accessRole ?? profile?.role ?? "STAFF"}
              </Badge>
            </div>

            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {profile?.name ?? "Employee Dashboard"}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-zinc-300">
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Joined {formatDate(profile?.joiningDate ?? profile?.createdAt)}
              </span>
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                ID {profile?.id ? profile.id.slice(-8).toUpperCase() : "Pending"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr] lg:min-w-[360px] lg:grid-cols-1">
          <div className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Performance Score
                </p>
                <p className="mt-2 text-3xl font-semibold text-foreground">{score}</p>
              </div>
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
                <TrendingUp className="h-7 w-7" />
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200/80 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row lg:flex-row">
            <Button asChild className="w-full">
              <Link href="#worker-profile">
                <PencilLine className="h-4 w-4" />
                Edit Profile
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sales">View Sales</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onDownloadReport}
            >
              <Download className="h-4 w-4" />
              Report
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WorkerHero;
