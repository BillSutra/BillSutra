"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  Eye,
  FileImage,
  FileSearch,
  Filter,
  Loader2,
  MoreHorizontal,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deletePaymentProof,
  sendInvoiceReminder,
  type Invoice,
  type PaymentRecord,
  uploadPaymentProof,
} from "@/lib/apiClient";
import {
  useCreatePaymentMutation,
  useDeletePaymentMutation,
  useInvoicesQuery,
  usePaymentsQuery,
} from "@/hooks/useInventoryQueries";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from "@/lib/dashboardUtils";
import {
  formatPaymentMethodLabel,
  getInvoicePaymentSnapshot,
} from "@/lib/invoicePayments";
import { cn } from "@/lib/utils";

type PaymentStatusFilter = "all" | "paid" | "pending" | "partial" | "overdue";

type PaymentWorkspaceRow = {
  invoice: Invoice;
  customerName: string;
  invoiceNumber: string;
  dueDate: string | null;
  dueDateLabel: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: "paid" | "pending" | "partial" | "overdue";
  statusLabel: "Paid" | "Pending" | "Partial" | "Overdue";
  latestPayment: PaymentRecord | null;
  proofPayment: PaymentRecord | null;
  proofUploaded: boolean;
  paymentMethodLabel: string;
  reminderEmail: string | null;
};

const PAGE_SIZE = 10;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data
      ?.message === "string"
  ) {
    return (
      (error as { response?: { data?: { message?: string } } }).response?.data
        ?.message?.trim() || fallback
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
};

const formatDate = (value?: string | null, fallback = "No date") => {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const isPastDue = (value?: string | null) => {
  if (!value) return false;
  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return false;
  return dueDate.getTime() < startOfToday().getTime();
};

const getStatusVariant = (status: PaymentWorkspaceRow["status"]) => {
  if (status === "paid") return "paid";
  if (status === "overdue") return "overdue";
  if (status === "pending") return "pending";
  return "default";
};

const getStatusClassName = (status: PaymentWorkspaceRow["status"]) => {
  if (status === "partial") {
    return "border-sky-300/70 bg-sky-100/75 text-sky-900 dark:border-sky-400/35 dark:bg-sky-500/15 dark:text-sky-200";
  }

  return undefined;
};

const getProofSummary = (row: PaymentWorkspaceRow) => {
  if (!row.proofUploaded || !row.proofPayment) {
    return {
      label: "No",
      detail: "No proof attached",
    };
  }

  return {
    label: "Yes",
    detail: row.proofPayment.proofFileName ?? "Proof attached",
  };
};

const buildRows = (invoices: Invoice[], payments: PaymentRecord[]) => {
  const paymentsByInvoice = new Map<number, PaymentRecord[]>();

  payments.forEach((payment) => {
    const existing = paymentsByInvoice.get(payment.invoice_id) ?? [];
    existing.push(payment);
    paymentsByInvoice.set(payment.invoice_id, existing);
  });

  paymentsByInvoice.forEach((invoicePayments) => {
    invoicePayments.sort((left, right) => {
      const leftTime = new Date(left.paid_at ?? left.created_at).getTime();
      const rightTime = new Date(right.paid_at ?? right.created_at).getTime();
      return rightTime - leftTime;
    });
  });

  return invoices
    .filter((invoice) => invoice.status !== "DRAFT" && invoice.status !== "VOID")
    .map<PaymentWorkspaceRow>((invoice) => {
      const snapshot = getInvoicePaymentSnapshot(invoice);
      const invoicePayments = paymentsByInvoice.get(invoice.id) ?? [];
      const latestPayment = invoicePayments[0] ?? null;
      const proofPayment =
        invoicePayments.find((payment) => payment.hasProof) ?? latestPayment;

      let status: PaymentWorkspaceRow["status"] = "pending";
      let statusLabel: PaymentWorkspaceRow["statusLabel"] = "Pending";

      if (snapshot.paymentStatus === "PAID") {
        status = "paid";
        statusLabel = "Paid";
      } else if (isPastDue(invoice.due_date) || invoice.status === "OVERDUE") {
        status = "overdue";
        statusLabel = "Overdue";
      } else if (snapshot.paymentStatus === "PARTIAL") {
        status = "partial";
        statusLabel = "Partial";
      }

      return {
        invoice,
        customerName: invoice.customer?.name?.trim() || "Walk-in customer",
        invoiceNumber: invoice.invoice_number,
        dueDate: invoice.due_date ?? null,
        dueDateLabel: formatDate(invoice.due_date, "No due date"),
        totalAmount: Number(invoice.total ?? 0),
        paidAmount: snapshot.paid,
        remainingAmount: snapshot.remaining,
        status,
        statusLabel,
        latestPayment,
        proofPayment,
        proofUploaded: invoicePayments.some((payment) => payment.hasProof),
        paymentMethodLabel: formatPaymentMethodLabel(latestPayment?.method ?? null),
        reminderEmail: invoice.customer?.email?.trim() || null,
      };
    })
    .sort((left, right) => {
      const leftWeight =
        left.status === "overdue"
          ? 0
          : left.status === "partial"
            ? 1
            : left.status === "pending"
              ? 2
              : 3;
      const rightWeight =
        right.status === "overdue"
          ? 0
          : right.status === "partial"
            ? 1
            : right.status === "pending"
              ? 2
              : 3;

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      const leftTime = new Date(left.dueDate ?? left.invoice.date).getTime();
      const rightTime = new Date(right.dueDate ?? right.invoice.date).getTime();
      return leftTime - rightTime;
    });
};

export default function PaymentsWorkspaceClient() {
  const queryClient = useQueryClient();
  const { data: invoices = [], isLoading: isInvoicesLoading } = useInvoicesQuery();
  const { data: payments = [], isLoading: isPaymentsLoading } = usePaymentsQuery();
  const createPayment = useCreatePaymentMutation();
  const deletePayment = useDeletePaymentMutation();

  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<PaymentWorkspaceRow | null>(null);
  const [uploadTarget, setUploadTarget] = useState<PaymentWorkspaceRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadSaving, setIsUploadSaving] = useState(false);
  const [isRemovingProof, setIsRemovingProof] = useState(false);
  const [isSendingReminderId, setIsSendingReminderId] = useState<number | null>(null);
  const [isMarkingPaidId, setIsMarkingPaidId] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const rows = useMemo(
    () => buildRows(invoices, payments),
    [invoices, payments],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const thisMonthPayments = payments.filter((payment) => {
      const paymentDate = new Date(payment.paid_at ?? payment.created_at);
      return paymentDate >= currentMonthStart;
    });

    const previousMonthPayments = payments.filter((payment) => {
      const paymentDate = new Date(payment.paid_at ?? payment.created_at);
      return paymentDate >= previousMonthStart && paymentDate <= previousMonthEnd;
    });

    const totalReceived = payments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const thisMonthCollection = thisMonthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );
    const previousMonthCollection = previousMonthPayments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );

    const pendingRows = rows.filter(
      (row) => row.status === "pending" || row.status === "partial",
    );
    const overdueRows = rows.filter((row) => row.status === "overdue");

    const pendingAmount = pendingRows.reduce(
      (sum, row) => sum + row.remainingAmount,
      0,
    );
    const overdueAmount = overdueRows.reduce(
      (sum, row) => sum + row.remainingAmount,
      0,
    );

    const collectionTrend =
      previousMonthCollection > 0
        ? ((thisMonthCollection - previousMonthCollection) / previousMonthCollection) * 100
        : thisMonthCollection > 0
          ? 100
          : 0;

    return {
      totalReceived,
      pendingAmount,
      overdueAmount,
      thisMonthCollection,
      openPendingCount: pendingRows.length,
      overdueCount: overdueRows.length,
      thisMonthCount: thisMonthPayments.length,
      collectionTrend,
    };
  }, [payments, rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTime = dateTo ? new Date(dateTo).getTime() : null;

    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) {
        return false;
      }

      if (normalizedSearch) {
        const haystack = `${row.customerName} ${row.invoiceNumber}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      const compareDate = new Date(row.dueDate ?? row.invoice.date).getTime();
      if (fromTime !== null && compareDate < fromTime) {
        return false;
      }
      if (toTime !== null && compareDate > toTime + 86_399_999) {
        return false;
      }

      return true;
    });
  }, [dateFrom, dateTo, rows, searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo, searchTerm, statusFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    if (selectedFile.type === "application/pdf") {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedFile]);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Upload a JPG, PNG, or PDF file.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "Proof file size must not exceed 5MB.";
    }

    return null;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      setSelectedFile(null);
      setUploadError(validationError);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
  };

  const resetUploadModal = () => {
    setUploadTarget(null);
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(0);
    setIsUploadSaving(false);
    setIsRemovingProof(false);
  };

  const handleMarkPaid = async (row: PaymentWorkspaceRow) => {
    if (row.remainingAmount <= 0 || isMarkingPaidId === row.invoice.id) {
      return;
    }

    try {
      setIsMarkingPaidId(row.invoice.id);
      await createPayment.mutateAsync({
        invoice_id: row.invoice.id,
        amount: row.remainingAmount,
        status: "PAID",
        method: "CASH",
        paid_at: new Date().toISOString(),
      });
      toast.success(`Invoice ${row.invoiceNumber} marked as paid.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not mark this invoice as paid."));
    } finally {
      setIsMarkingPaidId(null);
    }
  };

  const handleSendReminder = async (row: PaymentWorkspaceRow) => {
    if (row.status === "paid" || isSendingReminderId === row.invoice.id) {
      return;
    }

    try {
      setIsSendingReminderId(row.invoice.id);
      await sendInvoiceReminder(row.invoice.id);
      toast.success(`Reminder sent for ${row.invoiceNumber}.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not send reminder right now."));
    } finally {
      setIsSendingReminderId(null);
    }
  };

  const handleDeletePayment = async () => {
    if (!deleteTarget?.latestPayment) return;

    try {
      await deletePayment.mutateAsync(deleteTarget.latestPayment.id);
      toast.success(`Payment deleted for ${deleteTarget.invoiceNumber}.`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not delete this payment."));
    }
  };

  const handleSaveProof = async () => {
    if (!uploadTarget?.latestPayment) {
      setUploadError("Record a payment before uploading proof.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Choose a file to upload.");
      return;
    }

    try {
      setIsUploadSaving(true);
      setUploadProgress(8);
      await uploadPaymentProof(uploadTarget.latestPayment.id, selectedFile, {
        onUploadProgress: (progressPercent) => {
          setUploadProgress(progressPercent);
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment proof uploaded successfully.");
      resetUploadModal();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Could not upload proof."));
    } finally {
      setIsUploadSaving(false);
    }
  };

  const handleRemoveProof = async () => {
    if (!uploadTarget?.proofPayment) return;

    try {
      setIsRemovingProof(true);
      await deletePaymentProof(uploadTarget.proofPayment.id);
      await queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment proof removed.");
      resetUploadModal();
    } catch (error) {
      setUploadError(getErrorMessage(error, "Could not remove this proof."));
    } finally {
      setIsRemovingProof(false);
    }
  };

  const isLoading = isInvoicesLoading || isPaymentsLoading;
  const hasRows = rows.length > 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="space-y-3 px-6 py-6">
              <div className="h-4 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-36 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!hasRows) {
    return (
      <FriendlyEmptyState
        icon={ReceiptText}
        title="Payments will appear here once invoices are created."
        description="Create an invoice first, then collections, reminders, proof uploads, and payment history will be managed from this screen."
        primaryAction={{ href: "/invoices", label: "Create invoice" }}
        secondaryAction={{ href: "/invoices/history", label: "View invoices", variant: "outline" }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          title="Total Received"
          value={formatCompactCurrency(stats.totalReceived)}
          detail={`${payments.length} payment entries recorded`}
          trend={
            stats.totalReceived > 0
              ? `${formatPercent(stats.collectionTrend)} vs last month`
              : "No collections recorded yet"
          }
          icon={CircleDollarSign}
          accent="emerald"
        />
        <SummaryCard
          title="Pending Payments"
          value={formatCompactCurrency(stats.pendingAmount)}
          detail={`${stats.openPendingCount} invoices awaiting payment`}
          trend="Upcoming dues still open"
          icon={FileSearch}
          accent="amber"
        />
        <SummaryCard
          title="Overdue Payments"
          value={formatCompactCurrency(stats.overdueAmount)}
          detail={`${stats.overdueCount} invoices need follow-up`}
          trend="Escalate reminders on priority"
          icon={AlertCircle}
          accent="rose"
        />
        <SummaryCard
          title="This Month Collection"
          value={formatCompactCurrency(stats.thisMonthCollection)}
          detail={`${stats.thisMonthCount} payments captured this month`}
          trend={
            stats.thisMonthCollection > 0
              ? `${formatPercent(stats.collectionTrend)} vs last month`
              : "No collections this month yet"
          }
          icon={CreditCard}
          accent="sky"
        />
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b border-border/70">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-xl">Payment collection workspace</CardTitle>
              <p className="text-sm text-muted-foreground">
                Clean up dues, record receipts, send reminders, and keep proof files attached to real payments.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:flex">
              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search customer or invoice"
                  className="pl-9"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-date-from" className="text-xs text-muted-foreground">
                    From
                  </Label>
                  <Input
                    id="payment-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="payment-date-to" className="text-xs text-muted-foreground">
                    To
                  </Label>
                  <Input
                    id="payment-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["paid", "Paid"],
                ["pending", "Pending"],
                ["partial", "Partial"],
                ["overdue", "Overdue"],
              ] satisfies Array<[PaymentStatusFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                  statusFilter === value
                    ? "border-primary/25 bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:border-primary/20 hover:bg-accent/60",
                )}
              >
                <Filter className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/45 text-muted-foreground">
                <tr>
                  {[
                    "Customer Name",
                    "Invoice / Bill No.",
                    "Amount",
                    "Due Date",
                    "Status",
                    "Payment Method",
                    "Proof Uploaded",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading} className="px-6 py-4 text-left font-medium">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => {
                  const proof = getProofSummary(row);
                  return (
                    <tr
                      key={row.invoice.id}
                      className="border-t border-border/65 align-top transition-colors hover:bg-accent/35"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{row.customerName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.reminderEmail ?? "No customer email on file"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{row.invoiceNumber}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Issued {formatDate(row.invoice.date)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">
                          {formatCurrency(row.totalAmount)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Balance {formatCurrency(row.remainingAmount)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{row.dueDateLabel}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={getStatusVariant(row.status)}
                          className={getStatusClassName(row.status)}
                        >
                          {row.statusLabel}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {row.latestPayment ? row.paymentMethodLabel : "Not recorded"}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-foreground">{proof.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{proof.detail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <ActionsMenu
                          row={row}
                          isDeleting={deletePayment.isPending}
                          isMarkingPaid={isMarkingPaidId === row.invoice.id}
                          isSendingReminder={isSendingReminderId === row.invoice.id}
                          onDelete={() => setDeleteTarget(row)}
                          onMarkPaid={() => void handleMarkPaid(row)}
                          onSendReminder={() => void handleSendReminder(row)}
                          onUploadProof={() => setUploadTarget(row)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {paginatedRows.map((row) => {
              const proof = getProofSummary(row);
              return (
                <div
                  key={row.invoice.id}
                  className="rounded-2xl border border-border/75 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{row.customerName}</p>
                      <p className="text-sm text-muted-foreground">{row.invoiceNumber}</p>
                    </div>
                    <Badge
                      variant={getStatusVariant(row.status)}
                      className={getStatusClassName(row.status)}
                    >
                      {row.statusLabel}
                    </Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Metric label="Amount" value={formatCurrency(row.totalAmount)} />
                    <Metric label="Balance" value={formatCurrency(row.remainingAmount)} />
                    <Metric label="Due date" value={row.dueDateLabel} />
                    <Metric
                      label="Proof"
                      value={proof.label === "Yes" ? "Uploaded" : "Not uploaded"}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/invoices/history/${row.invoice.id}`}>
                        <Eye className="size-4" />
                        View
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={row.status === "paid" || isMarkingPaidId === row.invoice.id}
                      onClick={() => void handleMarkPaid(row)}
                    >
                      {isMarkingPaidId === row.invoice.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Mark Paid
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={row.status === "paid" || isSendingReminderId === row.invoice.id}
                      onClick={() => void handleSendReminder(row)}
                    >
                      {isSendingReminderId === row.invoice.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Reminder
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setUploadTarget(row)}
                    >
                      <Upload className="size-4" />
                      Upload Proof
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!row.latestPayment || deletePayment.isPending}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredRows.length === 0 ? (
            <div className="border-t border-border/65 px-6 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No payments match these filters.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different status, date range, or search term.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {paginatedRows.length} of {filteredRows.length} payment items
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={Boolean(uploadTarget)} onOpenChange={(open) => !open && resetUploadModal()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload payment proof</DialogTitle>
            <DialogDescription>
              Attach a JPG, PNG, or PDF proof file to the latest payment for{" "}
              <span className="font-medium text-foreground">
                {uploadTarget?.invoiceNumber ?? "this invoice"}
              </span>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {uploadTarget?.customerName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Balance {formatCurrency(uploadTarget?.remainingAmount ?? 0)}
                  </p>
                </div>
                <Badge
                  variant={getStatusVariant(uploadTarget?.status ?? "pending")}
                  className={getStatusClassName(uploadTarget?.status ?? "pending")}
                >
                  {uploadTarget?.statusLabel ?? "Pending"}
                </Badge>
              </div>
            </div>

            {!uploadTarget?.latestPayment ? (
              <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 text-sm text-amber-900">
                Record a payment first. Once a payment exists, proof files can be safely attached and replaced.
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-[1.5rem] border border-dashed p-5 transition",
                  uploadError
                    ? "border-rose-300 bg-rose-50/60"
                    : "border-border bg-card/80 hover:border-primary/30 hover:bg-accent/35",
                )}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleFileSelect(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Drag and drop a proof file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supported formats: JPG, PNG, PDF. Maximum size: 5MB.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,application/pdf"
                      className="sr-only"
                      onChange={(event) =>
                        handleFileSelect(event.target.files?.[0] ?? null)
                      }
                    />
                    <span className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent/70">
                      Choose file
                    </span>
                  </label>
                </div>

                {selectedFile ? (
                  <div className="mt-5 rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          {selectedFile.type === "application/pdf" ? (
                            <FileSearch className="size-5" />
                          ) : (
                            <FileImage className="size-5" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedFile(null)}
                        >
                          Remove
                        </Button>
                        <label className="inline-flex cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,application/pdf"
                            className="sr-only"
                            onChange={(event) =>
                              handleFileSelect(event.target.files?.[0] ?? null)
                            }
                          />
                          <span className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-accent/70">
                            Replace
                          </span>
                        </label>
                      </div>
                    </div>

                    {previewUrl ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
                        <img
                          src={previewUrl}
                          alt="Selected proof preview"
                          className="max-h-72 w-full object-cover"
                        />
                      </div>
                    ) : null}

                    {selectedFile.type === "application/pdf" ? (
                      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                        PDF preview isn&apos;t embedded here, but the file name and upload validation are ready.
                      </div>
                    ) : null}
                  </div>
                ) : uploadTarget?.proofUploaded && uploadTarget.proofPayment ? (
                  <div className="mt-5 rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {uploadTarget.proofPayment.proofFileName ?? "Existing proof"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Uploaded {formatDate(uploadTarget.proofPayment.uploadedAt)}
                        </p>
                      </div>
                      {uploadTarget.proofPayment.proofUrl ? (
                        <Button asChild type="button" size="sm" variant="outline">
                          <a
                            href={uploadTarget.proofPayment.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" />
                            Open proof
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {uploadProgress > 0 && isUploadSaving ? (
                  <div className="mt-5 space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploading... {uploadProgress}%
                    </p>
                  </div>
                ) : null}
              </div>
            )}

            {uploadError ? (
              <p className="text-sm font-medium text-rose-600">{uploadError}</p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            {uploadTarget?.proofUploaded && uploadTarget.proofPayment ? (
              <Button
                type="button"
                variant="outline"
                disabled={isUploadSaving || isRemovingProof}
                onClick={() => void handleRemoveProof()}
              >
                {isRemovingProof ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Remove file
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={resetUploadModal}
              disabled={isUploadSaving || isRemovingProof}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveProof()}
              disabled={!uploadTarget?.latestPayment || !selectedFile || isUploadSaving}
            >
              {isUploadSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Save proof
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the latest recorded payment for{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.invoiceNumber ?? "this invoice"}
              </span>{" "}
              and recalculates the invoice balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePayment.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deletePayment.isPending}
              onClick={(event) => {
                event.preventDefault();
                void handleDeletePayment();
              }}
            >
              {deletePayment.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const SummaryCard = ({
  title,
  value,
  detail,
  trend,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  trend: string;
  icon: typeof CircleDollarSign;
  accent: "emerald" | "amber" | "rose" | "sky";
}) => {
  const accentStyles = {
    emerald:
      "bg-emerald-100 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/30",
    amber:
      "bg-amber-100 text-amber-900 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30",
    rose:
      "bg-rose-100 text-rose-900 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:ring-rose-500/30",
    sky:
      "bg-sky-100 text-sky-900 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-500/30",
  } as const;

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 px-6 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl ring-1",
              accentStyles[accent],
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{trend}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-border/70 bg-muted/25 p-3">
    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-2 font-medium text-foreground">{value}</p>
  </div>
);

const ActionsMenu = ({
  row,
  isDeleting,
  isMarkingPaid,
  isSendingReminder,
  onDelete,
  onMarkPaid,
  onSendReminder,
  onUploadProof,
}: {
  row: PaymentWorkspaceRow;
  isDeleting: boolean;
  isMarkingPaid: boolean;
  isSendingReminder: boolean;
  onDelete: () => void;
  onMarkPaid: () => void;
  onSendReminder: () => void;
  onUploadProof: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="outline" size="icon-sm">
        <MoreHorizontal className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-56">
      <DropdownMenuItem asChild>
        <Link href={`/invoices/history/${row.invoice.id}`}>
          <Eye className="size-4" />
          View
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={row.status === "paid" || isMarkingPaid}
        onClick={onMarkPaid}
      >
        {isMarkingPaid ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Mark Paid
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={row.status === "paid" || isSendingReminder}
        onClick={onSendReminder}
      >
        {isSendingReminder ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        Send Reminder
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={onUploadProof}
      >
        <Upload className="size-4" />
        Upload Proof
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        disabled={!row.latestPayment || isDeleting}
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
