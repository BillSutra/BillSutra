"use client";

import React, { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  Download,
  Mail,
  Share2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoicePaymentStatusBadge from "@/components/invoice/InvoicePaymentStatusBadge";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import {
  checkPaymentTransactionReference,
  sendInvoiceEmail,
  type PaymentInput,
} from "@/lib/apiClient";
import {
  formatPaymentMethodLabel,
  getInvoicePaymentSnapshot,
} from "@/lib/invoicePayments";
import {
  createEmptyPaymentFormValues,
  normalizeTransactionReference,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  validatePaymentForm,
} from "@/lib/paymentValidation";
import { buildInvoiceRenderPayload } from "@/lib/invoiceRenderPayload";
import {
  formatBusinessAddressFromRecord,
  formatCustomerAddressFromRecord,
} from "@/lib/indianAddress";
import { buildDiscountLabel } from "@/lib/invoiceDiscount";
import { getStateFromGstin } from "@/lib/gstin";
import { resolveBackendAssetUrl } from "@/lib/backendAssetUrl";
import {
  useCreatePaymentMutation,
  useInvoiceQuery,
  useUpdatePaymentMutation,
  useUpdateInvoiceMutation,
} from "@/hooks/useInventoryQueries";
import { useBusinessProfileQuery } from "@/hooks/useWorkspaceQueries";
import { useActiveInvoiceTemplate } from "@/hooks/invoice/useActiveInvoiceTemplate";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
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
  "tax",
  "discount",
  "payment_info",
  "notes",
  "footer",
];

const DEFAULT_INVOICE_THEME: InvoiceTheme = {
  primaryColor: "#1f2937",
  fontFamily: "var(--font-geist-sans)",
  tableStyle: "grid",
};

const toDateInputValue = (value?: string | null) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return parsed.toISOString().slice(0, 10);
};

type InvoiceDetailClientProps = {
  name: string;
  image?: string;
};

const InvoiceDetailClient = ({ name, image }: InvoiceDetailClientProps) => {
  const params = useParams();
  const id = Number(params?.id);
  const queryClient = useQueryClient();
  const { formatCurrency, formatDate, t, safeT } = useI18n();
  const { data, isLoading, isError, refetch: refetchInvoice } = useInvoiceQuery(id);
  const { data: businessProfile } = useBusinessProfileQuery();
  const updateInvoice = useUpdateInvoiceMutation();
  const createPayment = useCreatePaymentMutation();
  const updatePayment = useUpdatePaymentMutation();
  const [partialOpen, setPartialOpen] = useState(false);
  const [partialForm, setPartialForm] = useState(() =>
    createEmptyPaymentFormValues({ status: "PARTIAL" }),
  );
  const [partialError, setPartialError] = useState<string | null>(null);
  const [paymentEditOpen, setPaymentEditOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentEditForm, setPaymentEditForm] = useState(() =>
    createEmptyPaymentFormValues(),
  );
  const [paymentEditError, setPaymentEditError] = useState<string | null>(null);
  const [paymentEditFieldErrors, setPaymentEditFieldErrors] = useState<
    ReturnType<typeof validatePaymentForm>
  >({});
  const [partialFieldErrors, setPartialFieldErrors] = useState<
    ReturnType<typeof validatePaymentForm>
  >({});
  const [invoiceEmailOpen, setInvoiceEmailOpen] = useState(false);
  const [invoiceEmailRecipient, setInvoiceEmailRecipient] = useState("");
  const [invoiceEmailError, setInvoiceEmailError] = useState<string | null>(
    null,
  );
  const [invoiceEmailSending, setInvoiceEmailSending] = useState(false);
  const [checkingEditTransactionId, setCheckingEditTransactionId] =
    useState(false);
  const [checkingPartialTransactionId, setCheckingPartialTransactionId] =
    useState(false);
  const { downloadPdf } = useInvoicePdf();
  const fallbackActiveTemplate = useMemo(
    () => ({
      templateId: "indian-gst-template",
      templateName: "Indian GST Invoice Template",
      enabledSections: DEFAULT_INVOICE_SECTIONS,
      sectionOrder: DEFAULT_INVOICE_SECTIONS,
      theme: DEFAULT_INVOICE_THEME,
      designConfig: normalizeDesignConfig(null),
    }),
    [],
  );
  const activeTemplate = useActiveInvoiceTemplate(fallbackActiveTemplate);
  const activeEnabledSections = activeTemplate.enabledSections;
  const activeSectionOrder = activeTemplate.sectionOrder.length
    ? activeTemplate.sectionOrder
    : activeTemplate.enabledSections;
  const activeTheme = activeTemplate.theme;
  const designConfig = activeTemplate.designConfig;
  const buildInvoicePdfFileName = useCallback((invoiceNumber?: string | null) => {
    const normalized = (invoiceNumber?.trim() || `invoice-${id}`).replace(
      /[^a-zA-Z0-9._-]/g,
      "-",
    );
    return `${normalized || `invoice-${id}`}.pdf`;
  }, [id]);

  const invoiceDate = useCallback(
    (value?: string | null) => {
      if (!value) return "-";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return value;
      return formatDate(parsed, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    },
    [formatDate],
  );

  const paymentSnapshot = useMemo(
    () => (data ? getInvoicePaymentSnapshot(data) : null),
    [data],
  );

  const localizedPaymentLabel = useMemo(() => {
    if (!paymentSnapshot) return "";
    if (paymentSnapshot.paymentStatus === "PAID")
      return t("invoiceDetail.markPaid");
    if (paymentSnapshot.paymentStatus === "PARTIAL")
      return t("invoiceDetail.markPartial");
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

  const editingPayment = useMemo(
    () =>
      paymentHistory.find((payment) => payment.id === editingPaymentId) ?? null,
    [editingPaymentId, paymentHistory],
  );
  const paymentEditDueAmount = useMemo(
    () =>
      paymentSnapshot && editingPayment
        ? paymentSnapshot.remaining + Number(editingPayment.amount ?? 0)
        : paymentSnapshot?.remaining ?? 0,
    [editingPayment, paymentSnapshot],
  );
  const paymentEditLiveErrors = useMemo(
    () =>
      validatePaymentForm(paymentEditForm, {
        dueAmount: paymentEditDueAmount,
        customerName: data?.customer?.name,
        invoiceReference: data?.invoice_number,
      }),
    [
      data?.customer?.name,
      data?.invoice_number,
      paymentEditDueAmount,
      paymentEditForm,
    ],
  );
  const partialPaymentLiveErrors = useMemo(
    () =>
      validatePaymentForm(partialForm, {
        dueAmount: paymentSnapshot?.remaining ?? 0,
        customerName: data?.customer?.name,
        invoiceReference: data?.invoice_number,
      }),
    [
      data?.customer?.name,
      data?.invoice_number,
      partialForm,
      paymentSnapshot?.remaining,
    ],
  );
  const canUpdatePayment =
    Boolean(data && editingPaymentId !== null) &&
    Object.keys(paymentEditLiveErrors).length === 0 &&
    paymentEditFieldErrors.transactionId !== "UTR already used." &&
    !checkingEditTransactionId;
  const canSavePartial =
    Boolean(data && paymentSnapshot) &&
    Object.keys(partialPaymentLiveErrors).length === 0 &&
    partialFieldErrors.transactionId !== "UTR already used." &&
    !checkingPartialTransactionId;

  const formatLocalizedPaymentMethod = useCallback(
    (method?: Parameters<typeof formatPaymentMethodLabel>[0]) => {
      const normalized = (method ?? "MANUAL").toUpperCase();
      const key = `invoiceDetail.paymentMethods.${normalized}`;
      return safeT(key, formatPaymentMethodLabel(method));
    },
    [safeT],
  );

  const previewData = useMemo<InvoicePreviewData | null>(() => {
    if (!data || !paymentSnapshot) return null;

    const tax = Number(data.tax ?? 0);
    const cgst = Number(data.total_cgst ?? 0);
    const sgst = Number(data.total_sgst ?? 0);
    const igst = Number(data.total_igst ?? 0);
    const invoiceCurrency = businessProfile?.currency ?? "INR";
    const businessName = businessProfile?.business_name || "BillSutra";
    const businessState =
      getStateFromGstin(businessProfile?.tax_id) ||
      businessProfile?.businessAddress?.state ||
      businessProfile?.state ||
      "";
    const customerState =
      getStateFromGstin(data.customer?.gstin) ||
      data.customer?.customerAddress?.state ||
      data.customer?.state ||
      "";
    const taxMode =
      igst > 0 && cgst === 0 && sgst === 0
        ? "IGST"
        : cgst > 0 || sgst > 0
          ? "CGST_SGST"
          : data.tax_mode === "IGST" || data.tax_mode === "CGST_SGST"
            ? data.tax_mode
            : tax <= 0
              ? "NONE"
              : businessState && customerState && businessState !== customerState
                ? "IGST"
                : "CGST_SGST";
    const latestPaymentMethod =
      paymentHistory[0]?.method ? formatLocalizedPaymentMethod(paymentHistory[0].method) : "";
    const discountType =
      data.discount_type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED";
    const discountValue =
      Number(data.discount_value ?? data.discount ?? 0) || 0;

    return {
      invoiceTitle: taxMode === "NONE" ? "Bill" : "Tax Invoice",
      invoiceNumber: data.invoice_number,
      invoiceDate: invoiceDate(data.date),
      dueDate: invoiceDate(data.due_date),
      placeOfSupply: customerState || businessState || "",
      taxMode,
      business: {
        businessName,
        businessAddress: businessProfile
          ? {
              addressLine1:
                businessProfile.businessAddress?.addressLine1 ??
                businessProfile.address_line1 ??
                "",
              city:
                businessProfile.businessAddress?.city ??
                businessProfile.city ??
                "",
              state:
                businessProfile.businessAddress?.state ??
                businessProfile.state ??
                "",
              pincode:
                businessProfile.businessAddress?.pincode ??
                businessProfile.pincode ??
                "",
            }
          : undefined,
        address: formatBusinessAddressFromRecord(businessProfile),
        phone: businessProfile?.phone ?? "",
        email: businessProfile?.email ?? "",
        website: businessProfile?.website ?? "",
        logoUrl: resolveBackendAssetUrl(businessProfile?.logo_url),
        taxId: businessProfile?.tax_id ?? "",
        currency: businessProfile?.currency ?? "INR",
        showLogoOnInvoice: businessProfile?.show_logo_on_invoice ?? false,
        showTaxNumber: businessProfile?.show_tax_number ?? true,
        showPaymentQr: businessProfile?.show_payment_qr ?? false,
      },
      client: {
        name:
          data.customer?.type === "business"
            ? data.customer.businessName ||
              data.customer.business_name ||
              data.customer.name ||
              t("invoiceDetail.customerFallback")
            : (data.customer?.name ?? t("invoiceDetail.customerFallback")),
        type: data.customer?.type,
        businessName:
          data.customer?.businessName ?? data.customer?.business_name ?? "",
        gstin: data.customer?.gstin ?? "",
        email: data.customer?.email ?? "",
        phone: data.customer?.phone ?? "",
        address: formatCustomerAddressFromRecord(data.customer) || "",
      },
      items: data.items?.map((item) => ({
        name: item.name,
        description:
          item.gst_type === "IGST"
            ? `IGST ${Number(item.tax_rate ?? 0)}%`
            : item.gst_type === "CGST_SGST"
              ? `CGST ${Number(item.tax_rate ?? 0) / 2}% + SGST ${Number(item.tax_rate ?? 0) / 2}%`
              : "",
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.price) || 0,
        taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
        gstType:
          item.gst_type === "IGST" || item.gst_type === "CGST_SGST"
            ? item.gst_type
            : undefined,
        baseAmount: Number(item.base_amount ?? 0) || undefined,
        gstAmount: Number(item.gst_amount ?? 0) || undefined,
        cgstAmount: Number(item.cgst_amount ?? 0) || undefined,
        sgstAmount: Number(item.sgst_amount ?? 0) || undefined,
        igstAmount: Number(item.igst_amount ?? 0) || undefined,
        taxableValue: Number(item.base_amount ?? 0) || undefined,
        amount: Number(item.total ?? 0),
      })),
      totals: {
        subtotal: Number(data.subtotal ?? 0),
        totalBase: Number(data.total_base ?? data.subtotal ?? 0),
        tax,
        discount: Number(data.discount ?? 0),
        total: Number(data.total ?? 0),
        cgst,
        sgst,
        igst,
        grandTotal: Number(data.grand_total ?? data.total ?? 0),
        roundOff: 0,
      },
      discount: {
        type: discountType,
        value: discountValue,
        calculatedAmount: Number(data.discount_calculated ?? data.discount ?? 0),
        label: buildDiscountLabel({
          discountType,
          discountValue,
          formatCurrency: (value) => formatCurrency(value, invoiceCurrency),
        }),
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
      payment: {
        mode: latestPaymentMethod,
      },
      notes: data.notes ?? "",
      paymentInfo: t("invoiceDetail.paymentInfo"),
      closingNote: t("invoiceDetail.closingNote"),
      signatureLabel: t("invoiceDetail.signatureLabel"),
    };
  }, [
    businessProfile,
    data,
    formatCurrency,
    formatLocalizedPaymentMethod,
    invoiceDate,
    localizedPaymentHint,
    localizedPaymentLabel,
    paymentHistory,
    paymentSnapshot,
    t,
  ]);

  const invoiceRenderPayload = useMemo(() => {
    if (!previewData) {
      return null;
    }

    return buildInvoiceRenderPayload({
      templateId: activeTemplate.templateId,
      templateName: activeTemplate.templateName,
      data: previewData,
      enabledSections: activeEnabledSections,
      sectionOrder: activeSectionOrder,
      theme: activeTheme,
      designConfig,
    });
  }, [
    activeEnabledSections,
    activeSectionOrder,
    activeTemplate.templateId,
    activeTemplate.templateName,
    activeTheme,
    designConfig,
    previewData,
  ]);

  const handleDownloadPdf = async () => {
    if (!data || !invoiceRenderPayload) return;

    try {
      await downloadPdf({
        previewPayload: invoiceRenderPayload,
        fileName: buildInvoicePdfFileName(data.invoice_number),
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
    if (!data || !invoiceRenderPayload) return;

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
      const response = await sendInvoiceEmail(data.id, {
        email: recipient,
        preview_payload: invoiceRenderPayload,
      });
      setInvoiceEmailOpen(false);
      toast.success(
        response.queued
          ? `Invoice email queued for ${data.invoice_number}`
          : t("invoiceDetail.messages.emailSent", {
              number: data.invoice_number,
            }),
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

  const openEditPaymentModal = useCallback(
    (payment: (typeof paymentHistory)[number]) => {
      const dueBeforeWrite =
        (paymentSnapshot?.remaining ?? 0) + Number(payment.amount ?? 0);
      setEditingPaymentId(payment.id);
      setPaymentEditForm(
        createEmptyPaymentFormValues({
          amount: String(Number(payment.amount ?? 0)),
          status: Number(payment.amount ?? 0) < dueBeforeWrite - 0.009 ? "PARTIAL" : "PAID",
          method:
            payment.method && PAYMENT_METHOD_OPTIONS.includes(payment.method)
              ? payment.method
              : "CASH",
          paymentDate: toDateInputValue(payment.paid_at),
          transactionId: payment.transaction_id ?? payment.utrNumber ?? "",
          notes: payment.notes ?? "",
          chequeNumber: payment.chequeNumber ?? "",
          bankName: payment.bankName ?? "",
          depositDate: toDateInputValue(payment.depositDate),
        }),
      );
      setPaymentEditError(null);
      setPaymentEditFieldErrors({});
      setPaymentEditOpen(true);
    },
    [paymentSnapshot],
  );

  const closeEditPaymentModal = useCallback(() => {
    setPaymentEditOpen(false);
    setEditingPaymentId(null);
    setPaymentEditForm(createEmptyPaymentFormValues());
    setPaymentEditError(null);
    setPaymentEditFieldErrors({});
  }, []);

  const handleUpdatePayment = async () => {
    if (!data || editingPaymentId === null) return;
    const nextErrors = validatePaymentForm(paymentEditForm, {
      dueAmount: paymentEditDueAmount,
      customerName: data.customer?.name,
      invoiceReference: data.invoice_number,
    });
    setPaymentEditFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setPaymentEditError("Please fix the payment details before saving.");
      return;
    }

    try {
      await updatePayment.mutateAsync({
        id: editingPaymentId,
        payload: {
          amount: Number(paymentEditForm.amount),
          status: paymentEditForm.status as PaymentInput["status"],
          method: paymentEditForm.method as NonNullable<PaymentInput["method"]>,
          transaction_id: normalizeTransactionReference(
            paymentEditForm.transactionId,
          ) || undefined,
          notes: paymentEditForm.notes.trim() || undefined,
          cheque_number: paymentEditForm.chequeNumber.trim() || undefined,
          bank_name: paymentEditForm.bankName.trim() || undefined,
          deposit_date: paymentEditForm.depositDate
            ? new Date(paymentEditForm.depositDate).toISOString()
            : undefined,
          paid_at: new Date(paymentEditForm.paymentDate).toISOString(),
        },
      });
      await Promise.all([
        refetchInvoice(),
        queryClient.invalidateQueries({ queryKey: ["invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["payments"] }),
      ]);
      toast.success("Payment updated successfully");
      closeEditPaymentModal();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update payment";
      setPaymentEditError(message);
      if (/transaction reference already exists/i.test(message)) {
        setPaymentEditFieldErrors((current) => ({
          ...current,
          transactionId: "UTR already used.",
        }));
      }
      toast.error("Failed to update payment");
    }
  };

  const handleMarkPaid = async () => {
    if (!data || !paymentSnapshot) return;

    try {
      if (paymentSnapshot.remaining > 0) {
        await createPayment.mutateAsync({
          invoice_id: data.id,
          amount: paymentSnapshot.remaining,
          status: "PAID",
          method: "CASH",
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
    const nextErrors = validatePaymentForm(partialForm, {
      dueAmount: paymentSnapshot.remaining,
      customerName: data.customer?.name,
      invoiceReference: data.invoice_number,
    });
    setPartialFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setPartialError("Please fix the payment details before saving.");
      return;
    }

    try {
      await createPayment.mutateAsync({
        invoice_id: data.id,
        amount: Number(partialForm.amount),
        status: partialForm.status as PaymentInput["status"],
        method: partialForm.method as NonNullable<PaymentInput["method"]>,
        transaction_id: normalizeTransactionReference(partialForm.transactionId) || undefined,
        notes: partialForm.notes.trim() || undefined,
        cheque_number: partialForm.chequeNumber.trim() || undefined,
        bank_name: partialForm.bankName.trim() || undefined,
        deposit_date: partialForm.depositDate
          ? new Date(partialForm.depositDate).toISOString()
          : undefined,
        paid_at: new Date(partialForm.paymentDate).toISOString(),
      });
      setPartialForm(createEmptyPaymentFormValues({ status: "PARTIAL" }));
      setPartialError(null);
      setPartialFieldErrors({});
      setPartialOpen(false);
      toast.success(t("invoiceDetail.messages.partialRecorded"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("invoiceDetail.messages.paymentError");
      setPartialError(message);
      if (/transaction reference already exists/i.test(message)) {
        setPartialFieldErrors((current) => ({
          ...current,
          transactionId: "UTR already used.",
        }));
      }
    }
  };

  const verifyEditTransactionReference = async () => {
    if (
      !paymentEditForm.method ||
      paymentEditForm.method === "CASH" ||
      paymentEditForm.method === "CHEQUE"
    ) {
      return;
    }

    const normalizedReference = normalizeTransactionReference(
      paymentEditForm.transactionId,
    );
    if (normalizedReference.length < 6) {
      return;
    }

    try {
      setCheckingEditTransactionId(true);
      const result = await checkPaymentTransactionReference({
        transaction_id: normalizedReference,
        payment_id: editingPaymentId ?? undefined,
      });

      setPaymentEditFieldErrors((current) => ({
        ...current,
        transactionId: result.exists
          ? "UTR already used."
          : current.transactionId === "UTR already used."
            ? undefined
            : current.transactionId,
      }));
    } finally {
      setCheckingEditTransactionId(false);
    }
  };

  const verifyPartialTransactionReference = async () => {
    if (
      !partialForm.method ||
      partialForm.method === "CASH" ||
      partialForm.method === "CHEQUE"
    ) {
      return;
    }

    const normalizedReference = normalizeTransactionReference(
      partialForm.transactionId,
    );
    if (normalizedReference.length < 6) {
      return;
    }

    try {
      setCheckingPartialTransactionId(true);
      const result = await checkPaymentTransactionReference({
        transaction_id: normalizedReference,
      });

      setPartialFieldErrors((current) => ({
        ...current,
        transactionId: result.exists
          ? "UTR already used."
          : current.transactionId === "UTR already used."
            ? undefined
            : current.transactionId,
      }));
    } finally {
      setCheckingPartialTransactionId(false);
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
          <p className="text-sm text-muted-foreground">
            {t("invoiceDetail.loading")}
          </p>
        ) : null}
        {isError ? (
          <p className="text-sm text-[#b45309]">
            {t("invoiceDetail.loadError")}
          </p>
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
                        customer:
                          data.customer?.name ||
                          t("invoiceDetail.customerFallback"),
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
                      <span className="text-sm text-slate-500">
                        {t("invoiceDetail.grandTotal")}
                      </span>
                      <Wallet className="h-4 w-4 text-slate-500" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                      {formatCurrency(paymentSnapshot.total, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-emerald-700">
                        {t("invoiceDetail.paid")}
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-emerald-950">
                      {formatCurrency(paymentSnapshot.paid, "INR")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-amber-700">
                        {t("invoiceDetail.balance")}
                      </span>
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
                              {formatCurrency(
                                Number(payment.amount ?? 0),
                                "INR",
                              )}
                            </p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              {formatLocalizedPaymentMethod(payment.method)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right text-sm text-slate-500 dark:text-slate-400">
                              <p>{invoiceDate(payment.paid_at)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-xl"
                              onClick={() => openEditPaymentModal(payment)}
                            >
                              Edit
                            </Button>
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
                      stackKey={`invoice-detail-${data.id}-${activeTemplate.templateId}-${data.status}-${paymentHistory.length}`}
                    >
                      <InvoiceTemplate
                        templateId={activeTemplate.templateId}
                        templateName={activeTemplate.templateName}
                        data={previewData}
                        enabledSections={activeEnabledSections}
                        sectionOrder={activeSectionOrder}
                        theme={activeTheme}
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
                  value:
                    data?.customer?.name ?? t("invoiceDetail.customerFallback"),
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
              <Label htmlFor="invoice-email-recipient">
                {t("invoiceDetail.emailLabel")}
              </Label>
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
                {invoiceEmailSending
                  ? t("invoiceDetail.sending")
                  : t("invoiceDetail.sendEmail")}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={paymentEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeEditPaymentModal();
              return;
            }

            setPaymentEditOpen(true);
          }}
          title="Update Payment"
          description={
            editingPayment
              ? `Update payment #${editingPayment.id} and sync invoice totals automatically.`
              : "Update the payment details."
          }
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>Customer: {data?.customer?.name ?? t("invoiceDetail.customerFallback")}</p>
              <p className="mt-1">Invoice: {data?.invoice_number ?? "-"}</p>
              <p>
                Invoice total: {formatCurrency(paymentSnapshot?.total ?? 0, "INR")}
              </p>
              <p className="mt-1">
                Current paid: {formatCurrency(paymentSnapshot?.paid ?? 0, "INR")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-payment-amount">Amount</Label>
                <Input
                  id="edit-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paymentEditForm.amount}
                  onChange={(event) => {
                    setPaymentEditForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }));
                    setPaymentEditError(null);
                  }}
                  placeholder="Enter payment amount"
                />
                {paymentEditFieldErrors.amount ? (
                  <p className="text-sm text-amber-700">{paymentEditFieldErrors.amount}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-payment-status">Payment status</Label>
                <select
                  id="edit-payment-status"
                  value={paymentEditForm.status}
                  onChange={(event) => {
                    setPaymentEditForm((current) => ({
                      ...current,
                      status: event.target.value as PaymentInput["status"],
                    }));
                    setPaymentEditError(null);
                  }}
                  className="app-field h-11 w-full rounded-xl px-3 py-2"
                >
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "PAID" ? "Paid" : "Partial"}
                    </option>
                  ))}
                </select>
                {paymentEditFieldErrors.status ? (
                  <p className="text-sm text-amber-700">{paymentEditFieldErrors.status}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-payment-method">Method</Label>
                <select
                  id="edit-payment-method"
                  value={paymentEditForm.method}
                  onChange={(event) => {
                    setPaymentEditForm((current) => ({
                      ...current,
                      method: event.target.value as NonNullable<PaymentInput["method"]>,
                      transactionId:
                        event.target.value === "CASH" ? "" : current.transactionId,
                    }));
                    setPaymentEditError(null);
                  }}
                  className="app-field h-11 w-full rounded-xl px-3 py-2"
                >
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {formatLocalizedPaymentMethod(method)}
                    </option>
                  ))}
                </select>
                {paymentEditFieldErrors.method ? (
                  <p className="text-sm text-amber-700">{paymentEditFieldErrors.method}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-payment-date">Payment date</Label>
                <Input
                  id="edit-payment-date"
                  type="date"
                  value={paymentEditForm.paymentDate}
                  onChange={(event) => {
                    setPaymentEditForm((current) => ({
                      ...current,
                      paymentDate: event.target.value,
                    }));
                    setPaymentEditError(null);
                  }}
                />
                {paymentEditFieldErrors.paymentDate ? (
                  <p className="text-sm text-amber-700">{paymentEditFieldErrors.paymentDate}</p>
                ) : null}
              </div>
            </div>

            {paymentEditForm.method !== "CASH" ? (
              <div className="grid gap-2">
                <Label htmlFor="edit-payment-transaction">
                  {paymentEditForm.method === "CHEQUE"
                    ? "Reference / deposit tracking"
                    : "UTR / transaction reference"}
                </Label>
                <Input
                  id="edit-payment-transaction"
                  value={paymentEditForm.transactionId}
                  onChange={(event) => {
                    setPaymentEditForm((current) => ({
                      ...current,
                      transactionId: event.target.value.toUpperCase(),
                    }));
                    setPaymentEditFieldErrors((current) => ({
                      ...current,
                      transactionId: undefined,
                    }));
                  }}
                  onBlur={() => void verifyEditTransactionReference()}
                  placeholder="Enter payment reference"
                />
                {checkingEditTransactionId ? (
                  <p className="text-xs text-muted-foreground">Checking reference...</p>
                ) : null}
                {paymentEditFieldErrors.transactionId ? (
                  <p className="text-sm text-amber-700">{paymentEditFieldErrors.transactionId}</p>
                ) : null}
              </div>
            ) : null}

            {paymentEditForm.method === "CHEQUE" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-cheque-number">Cheque number</Label>
                  <Input
                    id="edit-payment-cheque-number"
                    value={paymentEditForm.chequeNumber}
                    onChange={(event) =>
                      setPaymentEditForm((current) => ({
                        ...current,
                        chequeNumber: event.target.value,
                      }))
                    }
                    placeholder="Enter cheque number"
                  />
                  {paymentEditFieldErrors.chequeNumber ? (
                    <p className="text-sm text-amber-700">{paymentEditFieldErrors.chequeNumber}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-bank-name">Bank name</Label>
                  <Input
                    id="edit-payment-bank-name"
                    value={paymentEditForm.bankName}
                    onChange={(event) =>
                      setPaymentEditForm((current) => ({
                        ...current,
                        bankName: event.target.value,
                      }))
                    }
                    placeholder="Enter bank name"
                  />
                  {paymentEditFieldErrors.bankName ? (
                    <p className="text-sm text-amber-700">{paymentEditFieldErrors.bankName}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-payment-deposit-date">Deposit date</Label>
                  <Input
                    id="edit-payment-deposit-date"
                    type="date"
                    value={paymentEditForm.depositDate}
                    onChange={(event) =>
                      setPaymentEditForm((current) => ({
                        ...current,
                        depositDate: event.target.value,
                      }))
                    }
                  />
                  {paymentEditFieldErrors.depositDate ? (
                    <p className="text-sm text-amber-700">{paymentEditFieldErrors.depositDate}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="edit-payment-notes">Notes</Label>
              <textarea
                id="edit-payment-notes"
                value={paymentEditForm.notes}
                onChange={(event) =>
                  setPaymentEditForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                className="app-field w-full rounded-xl px-3 py-2"
                placeholder="Optional payment notes"
              />
            </div>

            {paymentEditError ? (
              <p className="text-sm text-[#b45309]">{paymentEditError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditPaymentModal}
                disabled={updatePayment.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleUpdatePayment()}
                disabled={updatePayment.isPending || !canUpdatePayment}
              >
                {updatePayment.isPending ? "Updating..." : "Update Payment"}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={partialOpen}
          onOpenChange={(open) => {
            setPartialOpen(open);
            if (!open) {
              setPartialForm(createEmptyPaymentFormValues({ status: "PARTIAL" }));
              setPartialError(null);
              setPartialFieldErrors({});
            }
          }}
          title={t("invoiceDetail.partialModalTitle")}
          description={t("invoiceDetail.partialModalDescription")}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>
                {t("invoiceDetail.totalLabel")}:{" "}
                {formatCurrency(paymentSnapshot?.total ?? 0, "INR")}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.paid")}:{" "}
                {formatCurrency(paymentSnapshot?.paid ?? 0, "INR")}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.remainingLabel")}:{" "}
                {formatCurrency(paymentSnapshot?.remaining ?? 0, "INR")}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="partial-payment-amount">
                  {t("invoiceDetail.amountReceived")}
                </Label>
                <Input
                  id="partial-payment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={partialForm.amount}
                  onChange={(event) => {
                    setPartialForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }));
                    setPartialError(null);
                  }}
                  placeholder={t("invoiceDetail.amountPlaceholder")}
                />
                {partialFieldErrors.amount ? (
                  <p className="text-sm text-amber-700">{partialFieldErrors.amount}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partial-payment-date">Payment date</Label>
                <Input
                  id="partial-payment-date"
                  type="date"
                  value={partialForm.paymentDate}
                  onChange={(event) =>
                    setPartialForm((current) => ({
                      ...current,
                      paymentDate: event.target.value,
                    }))
                  }
                />
                {partialFieldErrors.paymentDate ? (
                  <p className="text-sm text-amber-700">{partialFieldErrors.paymentDate}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partial-payment-status">Payment status</Label>
                <select
                  id="partial-payment-status"
                  value={partialForm.status}
                  onChange={(event) =>
                    setPartialForm((current) => ({
                      ...current,
                      status: event.target.value as PaymentInput["status"],
                    }))
                  }
                  className="app-field h-11 w-full rounded-xl px-3 py-2"
                >
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === "PAID" ? "Paid" : "Partial"}
                    </option>
                  ))}
                </select>
                {partialFieldErrors.status ? (
                  <p className="text-sm text-amber-700">{partialFieldErrors.status}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="partial-payment-method">Payment method</Label>
                <select
                  id="partial-payment-method"
                  value={partialForm.method}
                  onChange={(event) =>
                    setPartialForm((current) => ({
                      ...current,
                      method: event.target.value as NonNullable<PaymentInput["method"]>,
                      transactionId:
                        event.target.value === "CASH" ? "" : current.transactionId,
                    }))
                  }
                  className="app-field h-11 w-full rounded-xl px-3 py-2"
                >
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <option key={method} value={method}>
                      {formatLocalizedPaymentMethod(method)}
                    </option>
                  ))}
                </select>
                {partialFieldErrors.method ? (
                  <p className="text-sm text-amber-700">{partialFieldErrors.method}</p>
                ) : null}
              </div>
            </div>

            {partialForm.method !== "CASH" ? (
              <div className="grid gap-2">
                <Label htmlFor="partial-payment-transaction">
                  {partialForm.method === "CHEQUE"
                    ? "Reference / deposit tracking"
                    : "UTR / transaction reference"}
                </Label>
                <Input
                  id="partial-payment-transaction"
                  value={partialForm.transactionId}
                  onChange={(event) =>
                    setPartialForm((current) => ({
                      ...current,
                      transactionId: event.target.value.toUpperCase(),
                    }))
                  }
                  onBlur={() => void verifyPartialTransactionReference()}
                  placeholder="Enter payment reference"
                />
                {checkingPartialTransactionId ? (
                  <p className="text-xs text-muted-foreground">Checking reference...</p>
                ) : null}
                {partialFieldErrors.transactionId ? (
                  <p className="text-sm text-amber-700">{partialFieldErrors.transactionId}</p>
                ) : null}
              </div>
            ) : null}

            {partialForm.method === "CHEQUE" ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="partial-payment-cheque-number">Cheque number</Label>
                  <Input
                    id="partial-payment-cheque-number"
                    value={partialForm.chequeNumber}
                    onChange={(event) =>
                      setPartialForm((current) => ({
                        ...current,
                        chequeNumber: event.target.value,
                      }))
                    }
                  />
                  {partialFieldErrors.chequeNumber ? (
                    <p className="text-sm text-amber-700">{partialFieldErrors.chequeNumber}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="partial-payment-bank-name">Bank name</Label>
                  <Input
                    id="partial-payment-bank-name"
                    value={partialForm.bankName}
                    onChange={(event) =>
                      setPartialForm((current) => ({
                        ...current,
                        bankName: event.target.value,
                      }))
                    }
                  />
                  {partialFieldErrors.bankName ? (
                    <p className="text-sm text-amber-700">{partialFieldErrors.bankName}</p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="partial-payment-deposit-date">Deposit date</Label>
                  <Input
                    id="partial-payment-deposit-date"
                    type="date"
                    value={partialForm.depositDate}
                    onChange={(event) =>
                      setPartialForm((current) => ({
                        ...current,
                        depositDate: event.target.value,
                      }))
                    }
                  />
                  {partialFieldErrors.depositDate ? (
                    <p className="text-sm text-amber-700">{partialFieldErrors.depositDate}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor="partial-payment-notes">Notes</Label>
              <textarea
                id="partial-payment-notes"
                value={partialForm.notes}
                onChange={(event) =>
                  setPartialForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
                className="app-field w-full rounded-xl px-3 py-2"
                placeholder="Optional payment notes"
              />
            </div>

            {partialError ? (
              <p className="text-sm text-[#b45309]">{partialError}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPartialOpen(false);
                  setPartialForm(createEmptyPaymentFormValues({ status: "PARTIAL" }));
                  setPartialError(null);
                  setPartialFieldErrors({});
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSavePartial()}
                disabled={createPayment.isPending || !canSavePartial}
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
