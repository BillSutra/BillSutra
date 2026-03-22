"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, Wallet } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoicePaymentStatusBadge from "@/components/invoice/InvoicePaymentStatusBadge";
import DataExportDialog from "@/components/export/DataExportDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/table";
import Modal from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  getInvoicePaymentSnapshot,
  sumPaymentAmount,
} from "@/lib/invoicePayments";
import { useI18n } from "@/providers/LanguageProvider";
import {
  useCreatePaymentMutation,
  useInvoicesQuery,
  useUpdateInvoiceMutation,
} from "@/hooks/useInventoryQueries";
import type { Invoice } from "@/lib/apiClient";

type InvoicesHistoryClientProps = {
  name: string;
  image?: string;
};

const invoiceStatusOptions = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "VOID",
] as const;

const humanizeEnum = (status: string) =>
  status
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const InvoicesHistoryClient = ({ name, image }: InvoicesHistoryClientProps) => {
  const { t, formatCurrency, formatDate } = useI18n();
  const { data, isLoading, isError } = useInvoicesQuery();
  const updateInvoice = useUpdateInvoiceMutation();
  const createPayment = useCreatePaymentMutation();
  const [query, setQuery] = useState("");
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [statusEditorInvoice, setStatusEditorInvoice] = useState<Invoice | null>(
    null,
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("SENT");
  const [paidAmount, setPaidAmount] = useState("");
  const [statusError, setStatusError] = useState<string | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  const formatCurrencyValue = (value: string | number) =>
    formatCurrency(Number(value || 0), "INR");

  const formatInvoiceDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatStatusLabel = (status: string) => {
    const key = `invoiceHistory.status.${status}`;
    const translated = t(key);
    return translated === key ? humanizeEnum(status) : translated;
  };

  const invoices = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((invoice) =>
      invoice.invoice_number?.toLowerCase().includes(normalized),
    );
  }, [invoices, query]);

  const getPaidTotal = (invoice: Invoice) =>
    sumPaymentAmount(invoice.payments);

  const openStatusEditor = (
    invoice: Invoice,
    options?: { status?: string },
  ) => {
    setStatusEditorInvoice(invoice);
    setSelectedStatus(options?.status ?? invoice.status);
    setPaidAmount("");
    setStatusError(null);
  };

  const closeStatusEditor = () => {
    setStatusEditorInvoice(null);
    setSelectedStatus("SENT");
    setPaidAmount("");
    setStatusError(null);
  };

  const toggleInvoiceSelection = (invoiceId: number) => {
    setSelectedInvoiceIds((prev) =>
      prev.includes(invoiceId)
        ? prev.filter((id) => id !== invoiceId)
        : [...prev, invoiceId],
    );
  };

  const handleSaveStatus = async () => {
    if (!statusEditorInvoice) return;

    const invoice = statusEditorInvoice;
    const total = Number(invoice.total);
    const currentPaid = getPaidTotal(invoice);
    const remaining = Math.max(total - currentPaid, 0);

    if (selectedStatus === invoice.status) {
      closeStatusEditor();
      return;
    }

    if (selectedStatus === "PARTIALLY_PAID") {
      const amount = Number(paidAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setStatusError(t("invoiceHistory.messages.paidAmountPositive"));
        return;
      }
      if (amount >= remaining) {
        setStatusError(
          t("invoiceHistory.messages.partialLessThanRemaining", {
            amount: formatCurrencyValue(remaining),
          }),
        );
        return;
      }

      try {
        await createPayment.mutateAsync({
          invoice_id: invoice.id,
          amount,
          paid_at: new Date().toISOString(),
        });
        toast.success(t("invoiceHistory.messages.partialRecorded"));
        closeStatusEditor();
      } catch {
        setStatusError(t("invoiceHistory.messages.partialRecordError"));
      }
      return;
    }

    if (selectedStatus === "PAID") {
      if (remaining <= 0) {
        try {
          await updateInvoice.mutateAsync({
            id: invoice.id,
            payload: { status: "PAID" },
          });
          toast.success(t("invoiceHistory.messages.markedPaid"));
          closeStatusEditor();
        } catch {
          setStatusError(t("invoiceHistory.messages.statusUpdateError"));
        }
        return;
      }

      try {
        await createPayment.mutateAsync({
          invoice_id: invoice.id,
          amount: remaining,
          paid_at: new Date().toISOString(),
        });
        toast.success(t("invoiceHistory.messages.remainingPaymentRecorded"));
        closeStatusEditor();
      } catch {
        setStatusError(t("invoiceHistory.messages.paymentRecordError"));
      }
      return;
    }

    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        payload: { status: selectedStatus },
      });
      toast.success(t("invoiceHistory.messages.markedStatus", {
        status: formatStatusLabel(selectedStatus),
      }));
      closeStatusEditor();
    } catch {
      setStatusError(t("invoiceHistory.messages.statusUpdateError"));
    }
  };

  const handleQuickStatusUpdate = async (
    invoice: Invoice,
    status: "PAID" | "SENT",
  ) => {
    const snapshot = getInvoicePaymentSnapshot(invoice);

    try {
      if (status === "PAID") {
        if (snapshot.remaining > 0) {
          await createPayment.mutateAsync({
            invoice_id: invoice.id,
            amount: snapshot.remaining,
            paid_at: new Date().toISOString(),
          });
          toast.success(t("invoiceHistory.messages.remainingPaymentRecorded"));
        } else {
          await updateInvoice.mutateAsync({
            id: invoice.id,
            payload: { status: "PAID" },
          });
          toast.success(t("invoiceHistory.messages.markedPaid"));
        }
        return;
      }

      await updateInvoice.mutateAsync({
        id: invoice.id,
        payload: { status },
      });
      toast.success(t("invoiceHistory.messages.markedStatus", { status: "Pending" }));
    } catch {
      toast.error(t("invoiceHistory.messages.statusUpdateError"));
    }
  };

  const summary = useMemo(() => {
    return filtered.reduce(
      (accumulator, invoice) => {
        const snapshot = getInvoicePaymentSnapshot(invoice);
        accumulator.total += snapshot.total;
        accumulator.paid += snapshot.paid;
        accumulator.remaining += snapshot.remaining;

        if (snapshot.paymentStatus === "PARTIAL") {
          accumulator.partialCount += 1;
        }
        if (snapshot.paymentStatus === "PAID") {
          accumulator.paidCount += 1;
        }
        if (snapshot.paymentStatus === "PENDING") {
          accumulator.pendingCount += 1;
        }

        return accumulator;
      },
      {
        total: 0,
        paid: 0,
        remaining: 0,
        partialCount: 0,
        paidCount: 0,
        pendingCount: 0,
      },
    );
  }, [filtered]);

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("invoiceHistory.title")}
      subtitle={t("invoiceHistory.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
            {t("invoiceHistory.kicker")}
          </p>
          <p className="max-w-2xl text-base text-gray-500">
            {t("invoiceHistory.subtitle")}
          </p>
        </div>

        <section className="mt-6 grid gap-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
                    Collected
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-950 dark:text-emerald-50">
                    {formatCurrencyValue(summary.paid)}
                  </p>
                  <p className="mt-2 text-sm text-emerald-800/80 dark:text-emerald-100/80">
                    {summary.paidCount} invoice(s) fully settled
                  </p>
                </div>
                <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-700 dark:text-emerald-200" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50/80 p-5 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
                    Outstanding
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-950 dark:text-amber-50">
                    {formatCurrencyValue(summary.remaining)}
                  </p>
                  <p className="mt-2 text-sm text-amber-800/80 dark:text-amber-100/80">
                    {summary.pendingCount} pending, {summary.partialCount} partial
                  </p>
                </div>
                <Clock3 className="mt-1 h-5 w-5 text-amber-700 dark:text-amber-200" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-300">
                    Invoice value
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {formatCurrencyValue(summary.total)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Track every bill from issue to settlement
                  </p>
                </div>
                <Wallet className="mt-1 h-5 w-5 text-slate-700 dark:text-slate-200" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("invoiceHistory.searchTitle")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("invoiceHistory.searchDescription")}
                </p>
              </div>
              <div className="flex w-full max-w-md items-center gap-2">
                <Input
                  placeholder={t("invoiceHistory.searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  {t("invoiceHistory.clear")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => setQuickActionsOpen(true)}
                >
                  {t("invoiceHistory.quickActions")}
                </Button>
                <DataExportDialog
                  resource="invoices"
                  title="Invoices"
                  selectedIds={selectedInvoiceIds}
                  initialFilters={{
                    search: query.trim() || undefined,
                  }}
                  disabled={isLoading || isError}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("invoiceHistory.resultsTitle")}
              </h2>
              <span className="text-sm text-gray-500">
                {t("invoiceHistory.resultsShown", { count: filtered.length })}
              </span>
            </div>

            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-gray-500">
                  {t("invoiceHistory.loading")}
                </p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  {t("invoiceHistory.loadError")}
                </p>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <p className="text-sm text-gray-500">
                  {t("invoiceHistory.empty")}
                </p>
              )}
              {!isLoading && !isError && filtered.length > 0 && (
                <DataTable
                  rows={filtered.map((invoice) => {
                    const snapshot = getInvoicePaymentSnapshot(invoice);

                    return ({
                    id: invoice.id,
                    select: (
                      <input
                        type="checkbox"
                        checked={selectedInvoiceIds.includes(invoice.id)}
                        onChange={() => toggleInvoiceSelection(invoice.id)}
                        aria-label={`Select ${invoice.invoice_number}`}
                      />
                    ),
                    invoice_number: (
                      <span className="font-semibold">
                        {invoice.invoice_number}
                      </span>
                    ),
                    customer: invoice.customer?.name || "-",
                    date: formatInvoiceDate(invoice.date),
                    status: (
                      <div className="flex min-w-[220px] flex-col gap-3">
                        <InvoicePaymentStatusBadge
                          label={snapshot.label}
                          variant={snapshot.badgeVariant}
                          hint={snapshot.statusHint}
                        />
                        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                          <div className="flex items-center justify-between gap-3">
                            <span>Paid</span>
                            <span className="font-semibold">
                              {formatCurrencyValue(snapshot.paid)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <span>Balance</span>
                            <span className="font-semibold">
                              {formatCurrencyValue(snapshot.remaining)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ),
                    total: (
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrencyValue(invoice.total)}</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Paid {formatCurrencyValue(snapshot.paid)}
                        </p>
                      </div>
                    ),
                    quick_update: (
                      <div className="flex min-w-[230px] flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={cn(
                            "rounded-full",
                            snapshot.paymentStatus === "PENDING" &&
                              "border-amber-300 bg-amber-50 text-amber-800",
                          )}
                          onClick={() => void handleQuickStatusUpdate(invoice, "SENT")}
                        >
                          Pending
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          onClick={() =>
                            openStatusEditor(invoice, { status: "PARTIALLY_PAID" })
                          }
                        >
                          Partial
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
                          onClick={() => void handleQuickStatusUpdate(invoice, "PAID")}
                        >
                          Paid
                        </Button>
                      </div>
                    ),
                    actions: (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openStatusEditor(invoice)}
                        >
                          {t("invoiceHistory.updateStatus")}
                        </Button>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                        >
                          <Link href={`/invoices/history/${invoice.id}`}>
                            {t("invoiceHistory.view")}
                          </Link>
                        </Button>
                      </div>
                    ),
                  });
                  })}
                  searchPlaceholder={t("invoiceHistory.tableSearchPlaceholder")}
                  searchKeys={["invoice_number", "customer", "date"]}
                  columns={[
                    {
                      key: "select",
                      header: "Select",
                    },
                    {
                      key: "invoice_number",
                      header: t("invoiceHistory.columns.invoiceNumber"),
                    },
                    {
                      key: "customer",
                      header: t("invoiceHistory.columns.customer"),
                    },
                    {
                      key: "date",
                      header: t("invoiceHistory.columns.date"),
                    },
                    {
                      key: "status",
                      header: t("invoiceHistory.columns.status"),
                    },
                    {
                      key: "quick_update",
                      header: "Quick update",
                      className: "text-right",
                    },
                    {
                      key: "total",
                      header: t("invoiceHistory.columns.total"),
                      className: "text-right",
                    },
                    {
                      key: "actions",
                      header: t("invoiceHistory.columns.actions"),
                      className: "text-right",
                    },
                  ]}
                />
              )}
            </div>
          </div>
        </section>

        <Modal
          open={Boolean(statusEditorInvoice)}
          onOpenChange={(open) => {
            if (!open) closeStatusEditor();
          }}
          title={t("invoiceHistory.statusModalTitle")}
          description={t("invoiceHistory.statusModalDescription")}
        >
          {statusEditorInvoice && (
            <div className="grid gap-4">
              <div className="grid gap-1 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-900/40">
                {(() => {
                  const snapshot = getInvoicePaymentSnapshot(statusEditorInvoice);
                  const enteredAmount = Number(paidAmount || 0);
                  const projectedPaid =
                    selectedStatus === "PARTIALLY_PAID" && Number.isFinite(enteredAmount)
                      ? snapshot.paid + Math.max(enteredAmount, 0)
                      : snapshot.paid;
                  const projectedBalance = Math.max(
                    snapshot.total - projectedPaid,
                    0,
                  );

                  return (
                    <>
                <span className="font-semibold">
                  {statusEditorInvoice.invoice_number}
                </span>
                <span>
                  {t("invoiceHistory.summary.total", {
                    amount: formatCurrencyValue(statusEditorInvoice.total),
                  })}
                </span>
                <span>
                  {t("invoiceHistory.summary.paid", {
                    amount: formatCurrencyValue(getPaidTotal(statusEditorInvoice)),
                  })}
                </span>
                <span>
                  {t("invoiceHistory.summary.balance", {
                    amount: formatCurrencyValue(
                      Math.max(
                        Number(statusEditorInvoice.total) -
                          getPaidTotal(statusEditorInvoice),
                        0,
                      ),
                    ),
                  })}
                </span>
                      {selectedStatus === "PARTIALLY_PAID" ? (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          After this payment: paid {formatCurrencyValue(projectedPaid)} | balance{" "}
                          {formatCurrencyValue(projectedBalance)}
                        </span>
                      ) : null}
                    </>
                  );
                })()}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="invoice_status">
                  {t("invoiceHistory.columns.status")}
                </Label>
                <select
                  id="invoice_status"
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm dark:border-gray-600 dark:bg-gray-900"
                  value={selectedStatus}
                  onChange={(event) => {
                    setSelectedStatus(event.target.value);
                    setStatusError(null);
                  }}
                >
                  {invoiceStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              {selectedStatus === "PARTIALLY_PAID" && (
                <div className="grid gap-2">
                  <Label htmlFor="paid_amount">
                    {t("invoiceHistory.paidAmount")}
                  </Label>
                  <Input
                    id="paid_amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder={t("invoiceHistory.paidAmountPlaceholder")}
                    value={paidAmount}
                    onChange={(event) => {
                      setPaidAmount(event.target.value);
                      setStatusError(null);
                    }}
                  />
                </div>
              )}

              {selectedStatus === "PAID" && (
                <p className="text-sm text-gray-500">
                  {t("invoiceHistory.paidRemainingHint")}
                </p>
              )}

              {statusError && (
                <p className="text-sm text-[#b45309]">{statusError}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeStatusEditor}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSaveStatus}
                  disabled={
                    updateInvoice.isPending || createPayment.isPending
                  }
                >
                  {t("invoiceHistory.save")}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        <Modal
          open={quickActionsOpen}
          onOpenChange={setQuickActionsOpen}
          title={t("invoiceHistory.quickActionsTitle")}
          description={t("invoiceHistory.quickActionsDescription")}
        >
          <div className="grid gap-3">
            <Button
              asChild
              variant="primary"
              className="justify-start rounded-xl"
            >
              <Link href="/invoices">{t("invoiceHistory.quickCreateInvoice")}</Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="justify-start rounded-xl"
            >
              <Link href="/customers">{t("invoiceHistory.quickCreateClient")}</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="justify-start rounded-xl"
            >
              <Link href="/products">{t("invoiceHistory.quickEditProduct")}</Link>
            </Button>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoicesHistoryClient;
