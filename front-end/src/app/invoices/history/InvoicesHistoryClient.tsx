"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/table";
import Modal from "@/components/ui/modal";
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

  const statusVariant = (status: string) => {
    const value = status.toLowerCase();
    if (value === "paid") return "paid" as const;
    if (
      value === "partially_paid" ||
      value === "sent" ||
      value === "draft"
    ) {
      return "pending" as const;
    }
    if (value === "overdue") return "overdue" as const;
    return "default" as const;
  };

  const getPaidTotal = (invoice: Invoice) =>
    invoice.payments.reduce(
      (sum, payment) => sum + Number(payment.amount ?? 0),
      0,
    );

  const openStatusEditor = (invoice: Invoice) => {
    setStatusEditorInvoice(invoice);
    setSelectedStatus(invoice.status);
    setPaidAmount("");
    setStatusError(null);
  };

  const closeStatusEditor = () => {
    setStatusEditorInvoice(null);
    setSelectedStatus("SENT");
    setPaidAmount("");
    setStatusError(null);
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
                  rows={filtered.map((invoice) => ({
                    id: invoice.id,
                    invoice_number: (
                      <span className="font-semibold">
                        {invoice.invoice_number}
                      </span>
                    ),
                    customer: invoice.customer?.name || "-",
                    date: formatInvoiceDate(invoice.date),
                    status: (
                      <div className="flex min-w-[180px] flex-col gap-2">
                        <Badge
                          variant={statusVariant(invoice.status)}
                          className="w-fit"
                        >
                          {formatStatusLabel(invoice.status)}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-fit rounded-lg"
                          onClick={() => openStatusEditor(invoice)}
                        >
                          {t("invoiceHistory.updateStatus")}
                        </Button>
                      </div>
                    ),
                    total: formatCurrencyValue(invoice.total),
                    actions: (
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
                    ),
                  }))}
                  searchPlaceholder={t("invoiceHistory.tableSearchPlaceholder")}
                  searchKeys={["invoice_number", "customer", "date", "total"]}
                  columns={[
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
