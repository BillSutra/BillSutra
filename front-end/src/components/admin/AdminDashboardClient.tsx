"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  Download,
  LayoutDashboard,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { clearAdminToken } from "@/lib/adminAuth";
import {
  AdminBusinessDetail,
  AdminBusinessSummary,
  AdminSummaryResponse,
  AdminWorkerRecord,
  deleteAdminBusiness,
  fetchAdminBusinessDetail,
  fetchAdminBusinesses,
  fetchAdminSummary,
  fetchAdminWorkers,
} from "@/lib/adminApiClient";
import { cn } from "@/lib/utils";

type SectionKey = "dashboard" | "businesses" | "workers";
type BusinessFilterKey = "all" | "staffed" | "idle" | "recent";
type WorkerRoleFilter = "all" | "ADMIN" | "WORKER";

const sectionMeta: Array<{
  key: SectionKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "businesses", label: "Businesses", icon: Building2 },
  { key: "workers", label: "Workers", icon: Users },
];

const businessFilterMeta: Array<{
  key: BusinessFilterKey;
  label: string;
}> = [
  { key: "all", label: "All" },
  { key: "staffed", label: "Staffed" },
  { key: "idle", label: "Idle" },
  { key: "recent", label: "New this week" },
];

const workerRoleFilterMeta: Array<{
  key: WorkerRoleFilter;
  label: string;
}> = [
  { key: "all", label: "All roles" },
  { key: "ADMIN", label: "Admin workers" },
  { key: "WORKER", label: "Workers" },
];

const formatDate = (value?: string | Date | null) => {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const downloadCsv = (fileName: string, rows: string[][]) => {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ??
      fallback
    );
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const isUnauthorizedError = (error: unknown) =>
  isAxiosError(error) &&
  (error.response?.status === 401 || error.response?.status === 403);

export default function AdminDashboardClient() {
  const router = useRouter();
  const [section, setSection] = useState<SectionKey>("dashboard");
  const [businesses, setBusinesses] = useState<AdminBusinessSummary[]>([]);
  const [workers, setWorkers] = useState<AdminWorkerRecord[]>([]);
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(
    null,
  );
  const [selectedBusiness, setSelectedBusiness] =
    useState<AdminBusinessDetail | null>(null);
  const [businessQuery, setBusinessQuery] = useState("");
  const [workerQuery, setWorkerQuery] = useState("");
  const [businessFilter, setBusinessFilter] =
    useState<BusinessFilterKey>("all");
  const [workerRoleFilter, setWorkerRoleFilter] =
    useState<WorkerRoleFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminBusinessSummary | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const deferredBusinessQuery = useDeferredValue(
    businessQuery.trim().toLowerCase(),
  );
  const deferredWorkerQuery = useDeferredValue(workerQuery.trim().toLowerCase());

  const handleUnauthorized = () => {
    clearAdminToken();
    router.replace("/admin/login");
  };

  const loadBusinessDetail = async (businessId: string | null) => {
    if (!businessId) {
      setSelectedBusiness(null);
      return null;
    }

    const detail = await fetchAdminBusinessDetail(businessId);
    setSelectedBusiness(detail);
    return detail;
  };

  const loadPanel = async (requestedBusinessId?: string | null) => {
    try {
      setError(null);
      const [businessList, workerList, summaryResponse] = await Promise.all([
        fetchAdminBusinesses(),
        fetchAdminWorkers(),
        fetchAdminSummary(),
      ]);

      setBusinesses(businessList);
      setWorkers(workerList);
      setSummary(summaryResponse);

      const nextSelectedBusinessId =
        requestedBusinessId === undefined
          ? selectedBusinessId ?? businessList[0]?.id ?? null
          : requestedBusinessId;

      const resolvedBusinessId =
        nextSelectedBusinessId &&
        businessList.some((business) => business.id === nextSelectedBusinessId)
          ? nextSelectedBusinessId
          : businessList[0]?.id ?? null;

      setSelectedBusinessId(resolvedBusinessId);
      await loadBusinessDetail(resolvedBusinessId);
      setLastSyncedAt(new Date().toISOString());
    } catch (loadError) {
      if (isUnauthorizedError(loadError)) {
        handleUnauthorized();
        return;
      }

      setError(getErrorMessage(loadError, "Unable to load admin dashboard."));
    }
  };

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      await loadPanel();
      setIsLoading(false);
    };

    void run();
  }, []);

  const filteredBusinesses = useMemo(() => {
    const now = Date.now();

    return businesses.filter((business) => {
      const matchesQuery =
        deferredBusinessQuery.length === 0 ||
        [
          business.name,
          business.ownerId,
          business.ownerName ?? "",
          business.ownerEmail ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredBusinessQuery);

      const isRecent =
        now - new Date(business.createdAt).getTime() <=
        7 * 24 * 60 * 60 * 1000;

      const matchesFilter =
        businessFilter === "all" ||
        (businessFilter === "staffed" && business.workerCount > 0) ||
        (businessFilter === "idle" && business.workerCount === 0) ||
        (businessFilter === "recent" && isRecent);

      return matchesQuery && matchesFilter;
    });
  }, [businessFilter, businesses, deferredBusinessQuery]);

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const matchesQuery =
        deferredWorkerQuery.length === 0 ||
        [
          worker.name,
          worker.email,
          worker.phone ?? "",
          worker.business.name,
          worker.business.ownerId,
        ]
          .join(" ")
          .toLowerCase()
          .includes(deferredWorkerQuery);

      const matchesRole =
        workerRoleFilter === "all" || worker.role === workerRoleFilter;

      return matchesQuery && matchesRole;
    });
  }, [deferredWorkerQuery, workerRoleFilter, workers]);

  const selectedBusinessSummary = useMemo(
    () =>
      businesses.find((business) => business.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId],
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadPanel();
    setIsRefreshing(false);
  };

  const handleSelectBusiness = async (businessId: string) => {
    try {
      setError(null);
      setSelectedBusinessId(businessId);
      setSection("businesses");
      await loadBusinessDetail(businessId);
    } catch (detailError) {
      if (isUnauthorizedError(detailError)) {
        handleUnauthorized();
        return;
      }

      setError(
        getErrorMessage(detailError, "Unable to load the selected business."),
      );
    }
  };

  const handleDeleteBusiness = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      setError(null);
      await deleteAdminBusiness(deleteTarget.id);
      setDeleteTarget(null);
      const fallbackBusinessId =
        selectedBusinessId === deleteTarget.id ? null : selectedBusinessId;
      await loadPanel(fallbackBusinessId);
    } catch (deleteError) {
      if (isUnauthorizedError(deleteError)) {
        handleUnauthorized();
        return;
      }

      setError(
        getErrorMessage(deleteError, "Unable to delete the selected business."),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    clearAdminToken();
    router.replace("/admin/login");
  };

  const exportBusinesses = () => {
    downloadCsv("bill-sutra-businesses.csv", [
      ["Business", "Owner", "Owner Email", "Workers", "Created At", "Owner ID"],
      ...filteredBusinesses.map((business) => [
        business.name,
        business.ownerName ?? "N/A",
        business.ownerEmail ?? "N/A",
        String(business.workerCount),
        formatDateTime(business.createdAt),
        business.ownerId,
      ]),
    ]);
  };

  const exportWorkers = () => {
    downloadCsv("bill-sutra-workers.csv", [
      [
        "Name",
        "Email",
        "Phone",
        "Role",
        "Business",
        "Owner ID",
        "Created At",
      ],
      ...filteredWorkers.map((worker) => [
        worker.name,
        worker.email,
        worker.phone ?? "N/A",
        worker.role,
        worker.business.name,
        worker.business.ownerId,
        formatDateTime(worker.createdAt),
      ]),
    ]);
  };

  const metricCards = summary
    ? [
        {
          label: "Businesses",
          value: summary.totals.totalBusinesses,
          hint: `${summary.totals.businessesCreatedLast7Days} added in the last 7 days`,
          icon: Building2,
        },
        {
          label: "Workers",
          value: summary.totals.totalWorkers,
          hint: `${summary.totals.workersCreatedLast7Days} onboarded this week`,
          icon: Users,
        },
        {
          label: "Active Businesses",
          value: summary.totals.activeBusinesses,
          hint: `${summary.totals.zeroWorkerBusinesses} businesses still have no team`,
          icon: Shield,
        },
        {
          label: "Avg. Workers / Business",
          value: summary.totals.averageWorkersPerBusiness,
          hint: `${summary.totals.adminWorkers} workers carry admin permissions`,
          icon: UserCog,
        },
      ]
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.08),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-center rounded-3xl border border-white/70 bg-white/80 p-16 shadow-xl backdrop-blur">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <RefreshCw className="size-4 animate-spin" />
            Loading super admin console...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.12),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.1),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200/80 bg-slate-950 p-5 text-slate-50 shadow-[0_28px_60px_-36px_rgba(15,23,42,0.7)]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-300/80">
              Bill Sutra
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Super Admin
            </h1>
            <p className="text-sm text-slate-400">
              Operational control across every business and worker account.
            </p>
          </div>

          <div className="mt-8 grid gap-2">
            {sectionMeta.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSection(item.key)}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition",
                    section === item.key
                      ? "bg-white text-slate-950 shadow-lg"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                  <ArrowUpRight
                    className={cn(
                      "size-4 transition",
                      section === item.key ? "opacity-100" : "opacity-40",
                    )}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Live state
            </p>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="text-2xl font-semibold">
                  {summary?.totals.totalBusinesses ?? 0}
                </p>
                <p className="text-sm text-slate-400">managed businesses</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">
                  {summary?.totals.totalWorkers ?? 0}
                </p>
                <p className="text-sm text-slate-400">worker identities</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("size-4", isRefreshing && "animate-spin")}
              />
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-white text-slate-950 hover:bg-slate-200"
              onClick={handleLogout}
            >
              Sign out
            </Button>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.5)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <Badge className="border-teal-200 bg-teal-50 text-teal-700">
                  Super admin console
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Run the platform with sharper visibility.
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-slate-600">
                  Review business growth, inspect worker access, and intervene
                  safely with business-level detail before taking action.
                </p>
              </div>

              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <Clock3 className="size-4" />
                    Last synced
                  </div>
                  <p>{lastSyncedAt ? formatDateTime(lastSyncedAt) : "Just now"}</p>
                </div>
                <div className="flex flex-wrap gap-2 lg:hidden">
                  {sectionMeta.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Button
                        key={item.key}
                        type="button"
                        variant={section === item.key ? "default" : "outline"}
                        onClick={() => setSection(item.key)}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          {section === "dashboard" ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <Card
                      key={card.label}
                      className="border-white/70 bg-white/90 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.45)]"
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                        <div>
                          <CardDescription>{card.label}</CardDescription>
                          <CardTitle className="mt-3 text-3xl font-semibold">
                            {card.value}
                          </CardTitle>
                        </div>
                        <div className="rounded-2xl bg-slate-950 p-3 text-white">
                          <Icon className="size-5" />
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm text-slate-600">
                        {card.hint}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
                <Card className="border-white/70 bg-white/90">
                  <CardHeader>
                    <CardDescription>Workforce leaderboard</CardDescription>
                    <CardTitle>Top businesses by team size</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary?.topBusinessesByWorkers.length ? (
                        summary.topBusinessesByWorkers.map((business, index) => (
                          <button
                            key={business.id}
                            type="button"
                            onClick={() => void handleSelectBusiness(business.id)}
                            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-slate-900">
                                  {business.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  Owner ID {business.ownerId}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-semibold text-slate-900">
                                {business.workerCount}
                              </p>
                              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                                workers
                              </p>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                          No businesses available yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-white/70 bg-slate-950 text-slate-50">
                  <CardHeader>
                    <CardDescription className="text-slate-400">
                      Operational watchlist
                    </CardDescription>
                    <CardTitle>What needs attention now</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-slate-400">
                        Businesses without workers
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary?.totals.zeroWorkerBusinesses ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-slate-400">
                        Businesses created this week
                      </p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary?.totals.businessesCreatedLast7Days ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-sm text-slate-400">Admin workers</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary?.totals.adminWorkers ?? 0}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {section === "businesses" ? (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card className="border-white/70 bg-white/90">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardDescription>Business directory</CardDescription>
                      <CardTitle>Search, filter, and inspect accounts</CardTitle>
                    </div>
                    <Button type="button" variant="outline" onClick={exportBusinesses}>
                      <Download className="size-4" />
                      Export CSV
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={businessQuery}
                        onChange={(event) => setBusinessQuery(event.target.value)}
                        placeholder="Search by business, owner, or email"
                        className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {businessFilterMeta.map((filter) => (
                        <Button
                          key={filter.key}
                          type="button"
                          size="sm"
                          variant={
                            businessFilter === filter.key ? "default" : "outline"
                          }
                          onClick={() => setBusinessFilter(filter.key)}
                        >
                          {filter.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {filteredBusinesses.length ? (
                    filteredBusinesses.map((business) => {
                      const isSelected = selectedBusinessId === business.id;

                      return (
                        <button
                          key={business.id}
                          type="button"
                          onClick={() => void handleSelectBusiness(business.id)}
                          className={cn(
                            "w-full rounded-2xl border px-4 py-4 text-left transition",
                            isSelected
                              ? "border-slate-950 bg-slate-950 text-white shadow-lg"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white",
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {business.name}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 truncate text-sm",
                                  isSelected ? "text-slate-300" : "text-slate-500",
                                )}
                              >
                                {business.ownerName ?? "Unknown owner"}
                                {business.ownerEmail
                                  ? ` • ${business.ownerEmail}`
                                  : ""}
                              </p>
                            </div>

                            <Badge
                              className={cn(
                                "border text-xs",
                                business.workerCount > 0
                                  ? isSelected
                                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : isSelected
                                    ? "border-amber-400/30 bg-amber-400/15 text-amber-100"
                                    : "border-amber-200 bg-amber-50 text-amber-700",
                              )}
                            >
                              {business.workerCount > 0 ? "Staffed" : "Idle"}
                            </Badge>
                          </div>

                          <div
                            className={cn(
                              "mt-3 flex items-center justify-between text-sm",
                              isSelected ? "text-slate-300" : "text-slate-500",
                            )}
                          >
                            <span>{business.workerCount} workers</span>
                            <span>{formatDate(business.createdAt)}</span>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
                      No businesses match the current filters.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-white/70 bg-white/90">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardDescription>Business detail</CardDescription>
                      <CardTitle>
                        {selectedBusiness?.name ?? "Select a business"}
                      </CardTitle>
                    </div>
                    {selectedBusinessSummary ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setDeleteTarget(selectedBusinessSummary)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent>
                  {selectedBusiness ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            Owner
                          </p>
                          <p className="mt-3 font-semibold text-slate-900">
                            {selectedBusiness.owner?.name ?? "Unknown owner"}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {selectedBusiness.owner?.email ?? "N/A"}
                          </p>
                          <p className="mt-3 text-xs text-slate-500">
                            Owner ID {selectedBusiness.ownerId}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            Contact
                          </p>
                          <div className="mt-3 space-y-1 text-sm text-slate-700">
                            <p>{selectedBusiness.businessProfile?.phone ?? "N/A"}</p>
                            <p>{selectedBusiness.businessProfile?.email ?? "N/A"}</p>
                            <p className="truncate">
                              {selectedBusiness.businessProfile?.website ?? "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: "Workers",
                            value: selectedBusiness.stats.workerCount,
                          },
                          {
                            label: "Sales",
                            value: selectedBusiness.stats.salesCount,
                          },
                          {
                            label: "Invoices",
                            value: selectedBusiness.stats.invoiceCount,
                          },
                          {
                            label: "Purchases",
                            value: selectedBusiness.stats.purchaseCount,
                          },
                          {
                            label: "Products",
                            value: selectedBusiness.stats.productCount,
                          },
                          {
                            label: "Customers",
                            value: selectedBusiness.stats.customerCount,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <p className="text-sm text-slate-500">{item.label}</p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              Worker roster
                            </p>
                            <p className="text-sm text-slate-500">
                              Created {formatDate(selectedBusiness.createdAt)}
                            </p>
                          </div>
                          <Badge>{selectedBusiness.workers.length} linked</Badge>
                        </div>

                        <div className="mt-4 space-y-3">
                          {selectedBusiness.workers.length ? (
                            selectedBusiness.workers.map((worker) => (
                              <div
                                key={worker.id}
                                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                              >
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-slate-900">
                                    {worker.name}
                                  </p>
                                  <p className="truncate text-sm text-slate-500">
                                    {worker.email}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <Badge>{worker.role}</Badge>
                                  <p className="mt-2 text-xs text-slate-500">
                                    {formatDate(worker.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                              This business has no workers yet.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
                      Pick a business from the directory to inspect it here.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {section === "workers" ? (
            <Card className="border-white/70 bg-white/90">
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardDescription>Cross-business workforce</CardDescription>
                    <CardTitle>Monitor admin access and staff footprint</CardTitle>
                  </div>
                  <Button type="button" variant="outline" onClick={exportWorkers}>
                    <Download className="size-4" />
                    Export CSV
                  </Button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={workerQuery}
                      onChange={(event) => setWorkerQuery(event.target.value)}
                      placeholder="Search by worker, email, phone, or business"
                      className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {workerRoleFilterMeta.map((filter) => (
                      <Button
                        key={filter.key}
                        type="button"
                        size="sm"
                        variant={
                          workerRoleFilter === filter.key ? "default" : "outline"
                        }
                        onClick={() => setWorkerRoleFilter(filter.key)}
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div className="overflow-hidden rounded-3xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">
                            Worker
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            Contact
                          </th>
                          <th className="px-4 py-3 text-left font-medium">Role</th>
                          <th className="px-4 py-3 text-left font-medium">
                            Business
                          </th>
                          <th className="px-4 py-3 text-left font-medium">
                            Created
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWorkers.length ? (
                          filteredWorkers.map((worker, index) => (
                            <tr
                              key={worker.id}
                              className={cn(
                                "border-t border-slate-200",
                                index % 2 === 0 ? "bg-white" : "bg-slate-50/80",
                              )}
                            >
                              <td className="px-4 py-4">
                                <div>
                                  <p className="font-medium text-slate-900">
                                    {worker.name}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    ID {worker.id.slice(0, 8)}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1">
                                  <p className="flex items-center gap-2 text-slate-700">
                                    <Mail className="size-3.5 text-slate-400" />
                                    {worker.email}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {worker.phone ?? "No phone"}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <Badge
                                  className={
                                    worker.role === "ADMIN"
                                      ? "border-violet-200 bg-violet-50 text-violet-700"
                                      : undefined
                                  }
                                >
                                  {worker.role}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-2">
                                  <p className="font-medium text-slate-900">
                                    {worker.business.name}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-sm text-primary"
                                    onClick={() =>
                                      void handleSelectBusiness(worker.businessId)
                                    }
                                  >
                                    Open business
                                  </Button>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {formatDate(worker.createdAt)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-12 text-center text-sm text-slate-500"
                            >
                              No workers match the current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this business?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `This will permanently remove ${deleteTarget.name}, its workers, and related business data.`
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteBusiness();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete business"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
