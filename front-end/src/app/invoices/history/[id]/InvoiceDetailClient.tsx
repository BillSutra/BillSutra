"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, Mail, Share2, Wallet } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoicePaymentStatusBadge from "@/components/invoice/InvoicePaymentStatusBadge";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import { fetchBusinessProfile, sendInvoiceEmail } from "@/lib/apiClient";
import {
  formatPaymentMethodLabel,
  getInvoicePaymentSnapshot,
} from "@/lib/invoicePayments";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import {
  useCreatePaymentMutation,
  useInvoiceQuery,
  useUpdateInvoiceMutation,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";

const DEFAULT_INVOICE_SECTIONS: SectionKey[] = [
  "header",
  "company_details",
  "client_details",
  "items",
  "payment_info",
  "notes",
  "footer",
];

const DEFAULT_INVOICE_THEME: InvoiceTheme = {
  primaryColor: "#1f2937",
  fontFamily: "var(--font-geist-sans)",
  tableStyle: "grid",
};

type InvoiceDetailClientProps = {
  name: string;
  image?: string;
};

const InvoiceDetailClient = ({ name, image }: InvoiceDetailClientProps) => {
  const params = useParams();
  const id = Number(params?.id);
  const { formatCurrency, formatDate, t } = useI18n();
  const { data, isLoading, isError } = useInvoiceQuery(id);
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const { downloadPdf } = useInvoicePdf();
  const updateInvoice = useUpdateInvoiceMutation();
  const createPayment = useCreatePaymentMutation();
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [partialError, setPartialError] = useState<string | null>(null);
  const [invoiceEmailOpen, setInvoiceEmailOpen] = useState(false);
  const [invoiceEmailRecipient, setInvoiceEmailRecipient] = useState("");
  const [invoiceEmailError, setInvoiceEmailError] = useState<string | null>(null);
  const [invoiceEmailSending, setInvoiceEmailSending] = useState(false);
  const designConfig = useMemo(() => normalizeDesignConfig(null), []);

  const invoiceDate = useCallback((value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [formatDate]);

  const paymentSnapshot = useMemo(
    () => (data ? getInvoicePaymentSnapshot(data) : null),
    [data],
  );

  const localizedPaymentLabel = useMemo(() => {
    if (!paymentSnapshot) return "";
    if (paymentSnapshot.paymentStatus === "PAID") return t("invoiceDetail.markPaid");
    if (paymentSnapshot.paymentStatus === "PARTIAL") return t("invoiceDetail.markPartial");
    return t("invoiceDetail.markPending");
  }, [paymentSnapshot, t]);

  const localizedPaymentHint = useMemo(() => {
    if (!paymentSnapshot || !data) return "";

    if (paymentSnapshot.paymentStatus === "PAID") {
      return t("invoiceDetail.settledInFull");
    }

    if (paymentSnapshot.paymentStatus === "PARTIAL") {
      return data.status === "OVERDUE"
        ? t("invoiceDetail.followUpNeeded")
        : t("invoiceDetail.partialCollected");
    }

    if (data.status === "DRAFT") return t("invoiceDetail.draftInvoice");
    if (data.status === "OVERDUE") return t("invoiceDetail.paymentOverdue");
    return t("invoiceDetail.awaitingPayment");
  }, [data, paymentSnapshot, t]);

  const paymentHistory = useMemo(() => {
    if (!data) return [];

    return [...data.payments].sort((left, right) => {
      const leftTime = new Date(left.paid_at ?? "").getTime();
      const rightTime = new Date(right.paid_at ?? "").getTime();
      return rightTime - leftTime;
    });
  }, [data]);

  const formatLocalizedPaymentMethod = useCallback(
    (method?: Parameters<typeof formatPaymentMethodLabel>[0]) => {
      const normalized = (method ?? "MANUAL").toUpperCase();
      const key = `invoiceDetail.paymentMethods.${normalized}`;
      return t(key) === key ? formatPaymentMethodLabel(method) : t(key);
    },
    [t],
  );

  const previewData = useMemo<InvoicePreviewData | null>(() => {
    if (!data || !paymentSnapshot) return null;

    const tax = Number(data.tax ?? 0);
    const businessName = businessProfile?.business_name || "BillSutra";

    return {
      invoiceNumber: data.invoice_number,
      invoiceDate: invoiceDate(data.date),
      dueDate: invoiceDate(data.due_date),
      business: {
        businessName,
        address: businessProfile?.address ?? "",
        phone: businessProfile?.phone ?? "",
        email: businessProfile?.email ?? "",
        website: businessProfile?.website ?? "",
        logoUrl: businessProfile?.logo_url ?? "",
        taxId: businessProfile?.tax_id ?? "",
        currency: businessProfile?.currency ?? "INR",
        showLogoOnInvoice: businessProfile?.show_logo_on_invoice ?? false,
        showTaxNumber: businessProfile?.show_tax_number ?? true,
        showPaymentQr: businessProfile?.show_payment_qr ?? false,
      },
      client: {
        name: data.customer?.name ?? t("invoiceDetail.customerFallback"),
        email: data.customer?.email ?? "",
        phone: data.customer?.phone ?? "",
        address: data.customer?.address ?? "",
      },
      items: data.items.map((item) => ({
        name: item.name,
        description: item.tax_rate ? `GST ${item.tax_rate}%` : t("invoiceComposer.noGst"),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.price) || 0,
        taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
      })),
      totals: {
        subtotal: Number(data.subtotal ?? 0),
        tax,
        discount: Number(data.discount ?? 0),
        total: Number(data.total ?? 0),
        cgst: tax > 0 ? tax / 2 : 0,
        sgst: tax > 0 ? tax / 2 : 0,
      },
      paymentSummary: {
        statusLabel: localizedPaymentLabel,
        statusTone:
          paymentSnapshot.paymentStatus === "PAID"
            ? "paid"
            : paymentSnapshot.paymentStatus === "PARTIAL"
              ? "partial"
              : "pending",
        statusNote: localizedPaymentHint,
        paidAmount: paymentSnapshot.paid,
        remainingAmount: paymentSnapshot.remaining,
        history: paymentHistory.map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount ?? 0),
          paidAt: invoiceDate(payment.paid_at),
          method: formatLocalizedPaymentMethod(payment.method),
        })),
      },
      notes: data.notes ?? "",
      paymentInfo: t("invoiceDetail.paymentInfo"),
      closingNote: t("invoiceDetail.closingNote"),
      signatureLabel: t("invoiceDetail.signatureLabel"),
    };
  }, [
    businessProfile,
    data,
    formatLocalizedPaymentMethod,
    invoiceDate,
    localizedPaymentHint,
    localizedPaymentLabel,
    paymentHistory,
    paymentSnapshot,
    t,
  ]);

  const handleDownloadPdf = async () => {
    if (!previewData || !data) return;

    try {
      await downloadPdf({
        previewPayload: {
          data: previewData,
          enabledSections: DEFAULT_INVOICE_SECTIONS,
          sectionOrder: DEFAULT_INVOICE_SECTIONS,
          theme: DEFAULT_INVOICE_THEME,
          designConfig,
        },
        fileName: `${data.invoice_number}.pdf`,
      });
    } catch {
      toast.error(t("invoiceDetail.messages.downloadError"));
    }
  };

  const handleShareInvoice = async () => {
    if (!data) return;

    const shareUrl =
      typeof window !== "undefined" ? window.location.href : undefined;
    const shareText = `Invoice ${data.invoice_number} for ${formatCurrency(
      Number(data.total ?? 0),
      "INR",
    )}`;

    try {
      if (
        typeof navigator !== "undefined" &&
        "share" in navigator &&
        shareUrl
      ) {
        await navigator.share({
          title: data.invoice_number,
          text: shareText,
          url: shareUrl,
        });
        return;
      }

      if (typeof navigator !== "undefined" && navigator.clipboard && shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t("invoiceDetail.messages.linkCopied"));
        return;
      }

      toast.success(shareText);
    } catch {
      toast.error(t("invoiceDetail.messages.shareError"));
    }
  };

  const openInvoiceEmailModal = () => {
    if (!data) return;

    setInvoiceEmailRecipient(data.customer?.email?.trim() ?? "");
    setInvoiceEmailError(null);
    setInvoiceEmailOpen(true);
  };

  const handleSendInvoiceEmail = async () => {
    if (!data) return;

    const recipient = invoiceEmailRecipient.trim();
    if (!recipient) {
      setInvoiceEmailError(t("invoiceDetail.messages.enterCustomerEmail"));
      return;
    }

    if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(recipient)) {
      setInvoiceEmailError(t("invoiceDetail.messages.enterValidEmail"));
      return;
    }

    setInvoiceEmailSending(true);
    setInvoiceEmailError(null);

    try {
      await sendInvoiceEmail(data.id, { email: recipient });
      setInvoiceEmailOpen(false);
      toast.success(
        t("invoiceDetail.messages.emailSent", { number: data.invoice_number }),
      );
    } catch {
      setInvoiceEmailError(t("invoiceDetail.messages.emailError"));
      toast.error(t("invoiceDetail.messages.emailFailureToast"));
    } finally {
      setInvoiceEmailSending(false);
    }
  };

  const handleMarkPending = async () => {
    if (!data) return;

    try {
      await updateInvoice.mutateAsync({
        id: data.id,
        payload: { status: "SENT" },
      });
      toast.success(t("invoiceDetail.messages.markedPending"));
    } catch {
      toast.error(t("invoiceDetail.messages.statusError"));
    }
  };

  const handleMarkPaid = async () => {
    if (!data || !paymentSnapshot) return;

    try {
      if (paymentSnapshot.remaining > 0) {
        await createPayment.mutateAsync({
          invoice_id: data.id,
          amount: paymentSnapshot.remaining,
          paid_at: new Date().toISOString(),
        });
      } else {
        await updateInvoice.mutateAsync({
          id: data.id,
          payload: { status: "PAID" },
        });
      }
      toast.success(t("invoiceDetail.messages.markedPaid"));
    } catch {
      toast.error(t("invoiceDetail.messages.paymentError"));
    }
  };

  const handleSavePartial = async () => {
    if (!data || !paymentSnapshot) return;

    const amount = Number(partialAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPartialError(t("invoiceDetail.messages.enterValidPaidAmount"));
      return;
    }

    if (amount >= paymentSnapshot.remaining) {
      setPartialError(
        t("invoiceDetail.messages.partialLessThanRemaining", {
          amount: formatCurrency(paymentSnapshot.remaining, "INR"),
        }),
      );
      return;
    }

    try {
      await createPayment.mutateAsync({
        invoice_id: data.id,
        amount,
        paid_at: new Date().toISOString(),
      });
      setPartialAmount("");
      setPartialError(null);
      setPartialOpen(false);
      toast.success(t("invoiceDetail.messages.partialRecorded"));
    } catch {
      setPartialError(t("invoiceDetail.messages.paymentError"));
    }
  };

  const headerActions = (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Button asChild variant="outline" className="h-11 rounded-xl">
        <Link href="/invoices/history">{t("invoiceDetail.back")}</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={openInvoiceEmailModal}
      >
        <Mail size={16} />
        <span>{t("invoiceDetail.sendEmail")}</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={handleShareInvoice}
      >
        <Share2 size={16} />
        <span>{t("invoiceDetail.shareInvoice")}</span>
      </Button>
      <Button
        type="button"
        className="h-11 rounded-xl"
        onClick={() => void handleDownloadPdf()}
      >
        <Download size={16} />
        <span>{t("invoiceDetail.downloadPdf")}</span>
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("invoiceDetail.workspaceTitle")}
      subtitle={t("invoiceDetail.workspaceSubtitle")}
      actions={headerActions}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("invoiceDetail.loading")}</p>
        ) : null}
        {isError ? (
          <p className="text-sm text-[#b45309]">{t("invoiceDetail.loadError")}</p>
        ) : null}

        {!isLoading && !isError && data && paymentSnapshot && previewData ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      {t("invoiceDetail.summaryKicker")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                      {data.invoice_number}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {t("invoiceDetail.issuedOn", {
                        customer: data.customer?.name || t("invoiceDetail.customerFallback"),
                        date: invoiceDate(data.date),
                      })}
                    </p>
                  </div>
                  <InvoicePaymentStatusBadge
                    label={localizedPaymentLabel}
                    variant={paymentSnapshot.badgeVariant}
                    hint={localizedPaymentHint}
                  />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">{t("invoiceDetail.grandTotal")}</span>
                      <Wallet className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {formatCurrency(paymentSnapshot.total, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-emerald-700">{t("invoiceDetail.paid")}</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-emerald-950">
                      {formatCurrency(paymentSnapshot.paid, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-700">{t("invoiceDetail.balance")}</span>
                      <Clock3 className="h-4 w-4 text-amber-700" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-amber-950">
                      {formatCurrency(paymentSnapshot.remaining, "INR")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">
                      {t("invoiceDetail.collectionProgress")}
                    </p>
                    <p className="text-sm font-semibold text-slate-950">
                      {paymentSnapshot.progress.toFixed(0)}%
                    </p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${paymentSnapshot.progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    {paymentSnapshot.paid > 0
                      ? t("invoiceDetail.collectedSoFar", {
                          amount: formatCurrency(paymentSnapshot.paid, "INR"),
                        })
                      : t("invoiceDetail.noCollections")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t("invoiceDetail.quickActionsKicker")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    {t("invoiceDetail.quickActionsTitle")}
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => void handleMarkPending()}
                    >
                      {t("invoiceDetail.markPending")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => {
                        setPartialError(null);
                        setPartialOpen(true);
                      }}
                    >
                      {t("invoiceDetail.markPartial")}
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-xl"
                      onClick={() => void handleMarkPaid()}
                    >
                      {t("invoiceDetail.markPaid")}
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {t("invoiceDetail.partialHint")}
                  </p>
                </div>

                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t("invoiceDetail.paymentHistoryKicker")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    {t("invoiceDetail.paymentHistoryTitle")}
                  </h3>

                  {paymentHistory.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      {t("invoiceDetail.paymentHistoryEmpty")}
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {paymentHistory.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40"
                        >
                          <div>
                            <p className="font-semibold text-slate-950 dark:text-slate-50">
                              {formatCurrency(Number(payment.amount ?? 0), "INR")}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {formatLocalizedPaymentMethod(payment.method)}
                            </p>
                          </div>
                          <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                            <p>{invoiceDate(payment.paid_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {t("invoiceDetail.previewKicker")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    {t("invoiceDetail.previewTitle")}
                  </h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("invoiceDetail.previewDescription")}
                </p>
              </div>

              <div className="printable">
                <DesignConfigProvider
                  value={{
                    designConfig,
                    updateSection: () => {},
                    resetSection: () => {},
                    resetAll: () => {},
                  }}
                >
                  <div
                    id="invoice-detail-preview-root"
                    className="rounded-[1.75rem] border border-slate-200 bg-white p-2 dark:border-slate-700"
                  >
                    <A4PreviewStack
                      stackKey={`invoice-detail-${data.id}-${data.status}-${paymentHistory.length}`}
                    >
                      <TemplatePreviewRenderer
                        data={previewData}
                        enabledSections={DEFAULT_INVOICE_SECTIONS}
                        sectionOrder={DEFAULT_INVOICE_SECTIONS}
                        theme={DEFAULT_INVOICE_THEME}
                      />
                    </A4PreviewStack>
                  </div>
                </DesignConfigProvider>
              </div>
            </section>
          </>
        ) : null}

        <Modal
          open={invoiceEmailOpen}
          onOpenChange={(open) => {
            setInvoiceEmailOpen(open);
            if (!open) {
              setInvoiceEmailError(null);
            }
          }}
          title={t("invoiceDetail.emailModalTitle")}
          description={t("invoiceDetail.emailModalDescription")}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>
                {t("invoiceDetail.emailDebugCustomer", {
                  value: data?.customer?.name ?? t("invoiceDetail.customerFallback"),
                })}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.emailDebugInvoice", {
                  value: data?.invoice_number ?? "-",
                })}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.emailDebugAmount", {
                  value: formatCurrency(Number(data?.total ?? 0), "INR"),
                })}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.emailDebugDate", {
                  value: invoiceDate(data?.date),
                })}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-email-recipient">{t("invoiceDetail.emailLabel")}</Label>
              <Input
                id="invoice-email-recipient"
                type="email"
                value={invoiceEmailRecipient}
                onChange={(event) => {
                  setInvoiceEmailRecipient(event.target.value);
                  setInvoiceEmailError(null);
                }}
                placeholder={t("invoiceDetail.emailPlaceholder")}
                autoComplete="email"
              />
            </div>

            {invoiceEmailError ? (
              <p className="text-sm text-[#b45309]">{invoiceEmailError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInvoiceEmailOpen(false)}
                disabled={invoiceEmailSending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendInvoiceEmail()}
                disabled={invoiceEmailSending}
              >
                {invoiceEmailSending ? t("invoiceDetail.sending") : t("invoiceDetail.sendEmail")}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={partialOpen}
          onOpenChange={(open) => {
            setPartialOpen(open);
            if (!open) {
              setPartialAmount("");
              setPartialError(null);
            }
          }}
          title={t("invoiceDetail.partialModalTitle")}
          description={t("invoiceDetail.partialModalDescription")}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>
                {t("invoiceDetail.totalLabel")}: {formatCurrency(paymentSnapshot?.total ?? 0, "INR")}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.paid")}: {formatCurrency(paymentSnapshot?.paid ?? 0, "INR")}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.remainingLabel")}: {formatCurrency(paymentSnapshot?.remaining ?? 0, "INR")}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partial-payment-amount">{t("invoiceDetail.amountReceived")}</Label>
              <Input
                id="partial-payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={partialAmount}
                onChange={(event) => {
                  setPartialAmount(event.target.value);
                  setPartialError(null);
                }}
                placeholder={t("invoiceDetail.amountPlaceholder")}
              />
            </div>

            {partialError ? (
              <p className="text-sm text-[#b45309]">{partialError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartialOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSavePartial()}
                disabled={createPayment.isPending}
              >
                {t("invoiceDetail.savePayment")}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceDetailClient;
