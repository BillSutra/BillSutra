"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearAdminToken } from "@/lib/adminAuth";
import {
  approveAdminPayment,
  fetchAdminPayments,
  rejectAdminPayment,
  type AdminAccessPaymentRecord,
} from "@/lib/adminApiClient";

type FilterKey = "all" | "pending" | "approved" | "rejected";

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(value);

const formatFileSize = (value?: number | null) => {
  if (!value || Number.isNaN(value)) return null;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const statusBadgeVariant = (
  status: AdminAccessPaymentRecord["status"],
): "default" | "paid" | "pending" | "overdue" => {
  if (status === "pending") return "pending";
  if (status === "approved" || status === "success") return "paid";
  if (status === "rejected") return "overdue";
  return "default";
};

const getProofUrl = (payment: AdminAccessPaymentRecord) =>
  payment.proofUrl ?? payment.screenshotUrl ?? null;

const isImageProof = (payment: AdminAccessPaymentRecord) =>
  payment.proofMimeType?.startsWith("image/") ?? false;

const getPaymentUserName = (payment: AdminAccessPaymentRecord) =>
  payment.user?.name?.trim() || payment.name?.trim() || "Unknown user";

const getPaymentUserEmail = (payment: AdminAccessPaymentRecord) =>
  payment.user?.email?.trim() || "Email unavailable";

export default function AdminPaymentsClient() {
  const router = useRouter();
  const [payments, setPayments] = useState<AdminAccessPaymentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const handleUnauthorized = () => {
    clearAdminToken();
    router.replace("/admin/login");
  };

  const loadPayments = async () => {
    try {
      setError(null);
      const nextPayments = await fetchAdminPayments();
      setPayments(nextPayments);
    } catch (loadError) {
      if (
        isAxiosError(loadError) &&
        [401, 403].includes(loadError.response?.status ?? 0)
      ) {
        handleUnauthorized();
        return;
      }

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load admin payments.",
      );
    }
  };

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      await loadPayments();
      setIsLoading(false);
    };

    void run();
  }, []);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesFilter = filter === "all" || payment.status === filter;
      const haystack = [
        getPaymentUserName(payment),
        getPaymentUserEmail(payment),
        payment.planId,
        payment.billingCycle,
        payment.utr ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery =
        deferredQuery.length === 0 || haystack.includes(deferredQuery);

      return matchesFilter && matchesQuery;
    });
  }, [deferredQuery, filter, payments]);

  const stats = useMemo(
    () => ({
      total: payments.length,
      pending: payments.filter((payment) => payment.status === "pending").length,
      approved: payments.filter((payment) => payment.status === "approved").length,
      rejected: payments.filter((payment) => payment.status === "rejected").length,
    }),
    [payments],
  );

  const reviewPayment = async (
    paymentId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      setActivePaymentId(paymentId);
      setError(null);
      const adminNote = adminNotes[paymentId]?.trim() || undefined;
      const updated =
        status === "approved"
          ? await approveAdminPayment({ paymentId, adminNote })
          : await rejectAdminPayment({ paymentId, adminNote });
      setPayments((current) =>
        current.map((payment) => (payment.id === updated.id ? updated : payment)),
      );
      setAdminNotes((current) => ({
        ...current,
        [paymentId]: "",
      }));
    } catch (reviewError) {
      if (
        isAxiosError(reviewError) &&
        [401, 403].includes(reviewError.response?.status ?? 0)
      ) {
        handleUnauthorized();
        return;
      }

      setError(
        reviewError instanceof Error
          ? reviewError.message
          : "Unable to update payment status.",
      );
    } finally {
      setActivePaymentId(null);
    }
  };

  const refresh = async () => {
    setIsRefreshing(true);
    await loadPayments();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-3xl border border-white/70 bg-white/85 p-20 shadow-xl">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <RefreshCw className="size-4 animate-spin" />
            Loading payment review queue...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.10),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="overflow-hidden border-0 bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#38bdf8_100%)] text-white shadow-[0_38px_90px_-58px_rgba(37,99,235,0.75)]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/78">
                  Super admin payment desk
                </p>
                <CardTitle className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  Review manual UPI submissions quickly and safely
                </CardTitle>
                <CardDescription className="mt-3 max-w-3xl whitespace-normal text-blue-50/88">
                  Approve valid payments to unlock access, or reject invalid proof
                  so duplicates and bad UTR entries do not leak into the system.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  variant="secondary"
                  className="bg-white text-slate-950 hover:bg-blue-50"
                >
                  <Link href="/admin/dashboard">
                    <ArrowLeft className="size-4" />
                    Back to dashboard
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/16 hover:text-white"
                  onClick={() => void refresh()}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total", value: stats.total, icon: Clock3 },
            { label: "Pending", value: stats.pending, icon: Clock3 },
            { label: "Approved", value: stats.approved, icon: CheckCircle2 },
            { label: "Rejected", value: stats.rejected, icon: XCircle },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="bg-white/92">
                <CardContent className="flex items-center justify-between py-6">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold text-slate-950">
                      {stat.value}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-3 text-white">
                    <Icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-white/95">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Manual UPI queue</CardTitle>
                <CardDescription className="whitespace-normal">
                  Search by user, email, plan, or UTR and process each request
                  with one click.
                </CardDescription>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "approved", "rejected"] as const).map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={filter === item ? "default" : "outline"}
                    onClick={() => setFilter(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by user, plan, email, or UTR"
                className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredPayments.length ? (
              filteredPayments.map((payment) => {
                const isWorking = activePaymentId === payment.id;
                const proofUrl = getProofUrl(payment);
                const noteValue = adminNotes[payment.id] ?? "";
                const fileSize = formatFileSize(payment.proofSize);
                const userName = getPaymentUserName(payment);
                const userEmail = getPaymentUserEmail(payment);

                return (
                  <div
                    key={payment.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-lg font-semibold text-slate-950">
                            {userName}
                          </p>
                          <Badge variant={statusBadgeVariant(payment.status)}>
                            {payment.status}
                          </Badge>
                          <Badge variant="default">
                            {(payment.planId === "pro-plus" ? "Pro Plus" : "Pro")} •{" "}
                            {payment.billingCycle}
                          </Badge>
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                          <p>Email: {userEmail}</p>
                          <p>UTR: {payment.utr ?? "N/A"}</p>
                          <p>Amount: {formatCurrency(payment.amount)}</p>
                          <p>Created: {formatDateTime(payment.createdAt)}</p>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
                          <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-sm font-medium text-slate-800">
                              Payment proof
                            </p>

                            {proofUrl ? (
                              <>
                                {isImageProof(payment) ? (
                                  <a
                                    href={proofUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-3 block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                                  >
                                    <img
                                      src={proofUrl}
                                      alt={`Payment proof for ${userName}`}
                                      className="h-48 w-full object-contain"
                                    />
                                  </a>
                                ) : (
                                  <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                    <FileText className="size-4" />
                                    PDF proof attached
                                  </div>
                                )}

                                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                                  {payment.proofOriginalName ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                      {payment.proofOriginalName}
                                    </span>
                                  ) : null}
                                  {fileSize ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                      {fileSize}
                                    </span>
                                  ) : null}
                                  {payment.proofUploadedAt ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                      Uploaded {formatDateTime(payment.proofUploadedAt)}
                                    </span>
                                  ) : null}
                                </div>

                                <a
                                  href={proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-300"
                                >
                                  View proof
                                  <ExternalLink className="size-3.5" />
                                </a>
                              </>
                            ) : (
                              <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                                No payment proof uploaded.
                              </div>
                            )}
                          </div>

                          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                              {payment.reviewedAt ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                  Reviewed {formatDateTime(payment.reviewedAt)}
                                </span>
                              ) : (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                  Awaiting admin review
                                </span>
                              )}
                              {payment.reviewedByAdminEmail ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                                  Reviewer {payment.reviewedByAdminEmail}
                                </span>
                              ) : null}
                            </div>

                            {payment.adminNote ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                                <span className="font-medium text-slate-900">
                                  Latest note:
                                </span>{" "}
                                {payment.adminNote}
                              </div>
                            ) : null}

                            <div>
                              <label
                                htmlFor={`admin-note-${payment.id}`}
                                className="text-sm font-medium text-slate-800"
                              >
                                Admin note
                              </label>
                              <textarea
                                id={`admin-note-${payment.id}`}
                                value={noteValue}
                                onChange={(event) =>
                                  setAdminNotes((current) => ({
                                    ...current,
                                    [payment.id]: event.target.value,
                                  }))
                                }
                                rows={3}
                                maxLength={500}
                                placeholder="Optional note for approval or rejection"
                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                              />
                              <p className="mt-2 text-xs text-slate-500">
                                {noteValue.trim().length}/500 characters
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={() => void reviewPayment(payment.id, "approved")}
                          disabled={isWorking || payment.status === "approved"}
                        >
                          <CheckCircle2 className="size-4" />
                          {isWorking && payment.status !== "approved"
                            ? "Updating..."
                            : "Approve"}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => void reviewPayment(payment.id, "rejected")}
                          disabled={isWorking || payment.status === "rejected"}
                        >
                          <XCircle className="size-4" />
                          {isWorking && payment.status !== "rejected"
                            ? "Updating..."
                            : "Reject"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-14 text-center text-sm text-slate-500">
                No payments match the current filters.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
