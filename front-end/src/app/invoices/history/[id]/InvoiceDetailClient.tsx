"use client";

import React, { useMemo, useState } from "react";
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
  const { formatCurrency, formatDate } = useI18n();
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

  const invoiceDate = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return formatDate(parsed, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const paymentSnapshot = useMemo(
    () => (data ? getInvoicePaymentSnapshot(data) : null),
    [data],
  );

  const paymentHistory = useMemo(() => {
    if (!data) return [];

    return [...data.payments].sort((left, right) => {
      const leftTime = new Date(left.paid_at ?? "").getTime();
      const rightTime = new Date(right.paid_at ?? "").getTime();
      return rightTime - leftTime;
    });
  }, [data]);

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
        name: data.customer?.name ?? "Customer",
        email: data.customer?.email ?? "",
        phone: data.customer?.phone ?? "",
        address: data.customer?.address ?? "",
      },
      items: data.items.map((item) => ({
        name: item.name,
        description: item.tax_rate ? `GST ${item.tax_rate}%` : "No GST",
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
        statusLabel: paymentSnapshot.label,
        statusTone:
          paymentSnapshot.paymentStatus === "PAID"
            ? "paid"
            : paymentSnapshot.paymentStatus === "PARTIAL"
              ? "partial"
              : "pending",
        statusNote: paymentSnapshot.statusHint,
        paidAmount: paymentSnapshot.paid,
        remainingAmount: paymentSnapshot.remaining,
        history: paymentHistory.map((payment) => ({
          amount: Number(payment.amount ?? 0),
          paidAt: invoiceDate(payment.paid_at),
          method: formatPaymentMethodLabel(payment.method),
        })),
      },
      notes: data.notes ?? "",
      paymentInfo: "Payment balances are updated from recorded invoice collections.",
      closingNote: "Thank you for your business.",
      signatureLabel: "Authorized signatory",
    };
  }, [businessProfile, data, paymentHistory, paymentSnapshot]);

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
      toast.error("Unable to download invoice PDF right now.");
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
        toast.success("Invoice link copied.");
        return;
      }

      toast.success(shareText);
    } catch {
      toast.error("Unable to share the invoice right now.");
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
      setInvoiceEmailError("Enter the customer email to send this invoice.");
      return;
    }

    if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(recipient)) {
      setInvoiceEmailError("Enter a valid email address.");
      return;
    }

    setInvoiceEmailSending(true);
    setInvoiceEmailError(null);

    try {
      await sendInvoiceEmail(data.id, { email: recipient });
      setInvoiceEmailOpen(false);
      toast.success(`Invoice ${data.invoice_number} email sent.`);
    } catch {
      setInvoiceEmailError("Unable to send invoice email right now.");
      toast.error("Failed to send invoice email.");
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
      toast.success("Invoice marked as pending.");
    } catch {
      toast.error("Unable to update invoice status.");
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
      toast.success("Invoice marked as paid.");
    } catch {
      toast.error("Unable to record payment.");
    }
  };

  const handleSavePartial = async () => {
    if (!data || !paymentSnapshot) return;

    const amount = Number(partialAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPartialError("Enter a valid paid amount.");
      return;
    }

    if (amount >= paymentSnapshot.remaining) {
      setPartialError(
        `Partial payment must be less than ${formatCurrency(
          paymentSnapshot.remaining,
          "INR",
        )}.`,
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
      toast.success("Partial payment recorded.");
    } catch {
      setPartialError("Unable to record payment.");
    }
  };

  const headerActions = (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
      <Button asChild variant="outline" className="h-11 rounded-xl">
        <Link href="/invoices/history">Back to history</Link>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={openInvoiceEmailModal}
      >
        <Mail size={16} />
        <span>Send Email</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl"
        onClick={handleShareInvoice}
      >
        <Share2 size={16} />
        <span>Share Invoice</span>
      </Button>
      <Button
        type="button"
        className="h-11 rounded-xl"
        onClick={() => void handleDownloadPdf()}
      >
        <Download size={16} />
        <span>Download PDF</span>
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Invoice workspace"
      subtitle="Track collections, share polished invoices, and keep payment progress visible at a glance."
      actions={headerActions}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading invoice...</p>
        ) : null}
        {isError ? (
          <p className="text-sm text-[#b45309]">Failed to load invoice.</p>
        ) : null}

        {!isLoading && !isError && data && paymentSnapshot && previewData ? (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Invoice summary
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                      {data.invoice_number}
                    </h2>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {data.customer?.name || "Customer"} | Issued {invoiceDate(data.date)}
                    </p>
                  </div>
                  <InvoicePaymentStatusBadge
                    label={paymentSnapshot.label}
                    variant={paymentSnapshot.badgeVariant}
                    hint={paymentSnapshot.statusHint}
                  />
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">Grand total</span>
                      <Wallet className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {formatCurrency(paymentSnapshot.total, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-emerald-700">Paid</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-emerald-950">
                      {formatCurrency(paymentSnapshot.paid, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-700">Balance</span>
                      <Clock3 className="h-4 w-4 text-amber-700" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-amber-950">
                      {formatCurrency(paymentSnapshot.remaining, "INR")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-700">Collection progress</p>
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
                      ? `${formatCurrency(paymentSnapshot.paid, "INR")} collected so far.`
                      : "No collections recorded yet."}
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Quick payment actions
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    Update this bill in one step
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => void handleMarkPending()}
                    >
                      Pending
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
                      Partial
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-xl"
                      onClick={() => void handleMarkPaid()}
                    >
                      Paid
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Partial payments update the remaining balance automatically.
                  </p>
                </div>

                <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Payment history
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    Collection log
                  </h3>

                  {paymentHistory.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                      No payment entries yet. Record a partial or full payment to start tracking collections here.
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
                              {formatPaymentMethodLabel(payment.method)}
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
                    Professional invoice
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">
                    Customer-ready PDF preview
                  </h3>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Consistent layout for print, download, and sharing.
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
          title="Send invoice with Resend"
          description="Review the invoice details and send them through the server-side Resend flow."
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>customer_name: {data?.customer?.name ?? "Customer"}</p>
              <p className="mt-1">invoice_id: {data?.invoice_number ?? "-"}</p>
              <p className="mt-1">
                amount: {formatCurrency(Number(data?.total ?? 0), "INR")}
              </p>
              <p className="mt-1">date: {invoiceDate(data?.date)}</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-email-recipient">email</Label>
              <Input
                id="invoice-email-recipient"
                type="email"
                value={invoiceEmailRecipient}
                onChange={(event) => {
                  setInvoiceEmailRecipient(event.target.value);
                  setInvoiceEmailError(null);
                }}
                placeholder="customer@example.com"
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
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendInvoiceEmail()}
                disabled={invoiceEmailSending}
              >
                {invoiceEmailSending ? "Sending..." : "Send invoice email"}
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
          title="Record partial payment"
          description="Enter the amount collected now. The remaining balance will stay visible automatically."
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>Total: {formatCurrency(paymentSnapshot?.total ?? 0, "INR")}</p>
              <p className="mt-1">Paid: {formatCurrency(paymentSnapshot?.paid ?? 0, "INR")}</p>
              <p className="mt-1">
                Remaining: {formatCurrency(paymentSnapshot?.remaining ?? 0, "INR")}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partial-payment-amount">Amount received</Label>
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
                placeholder="0.00"
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
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSavePartial()}
                disabled={createPayment.isPending}
              >
                Save payment
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceDetailClient;
