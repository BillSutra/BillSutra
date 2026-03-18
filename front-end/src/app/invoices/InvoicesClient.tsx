"use client";

import type { FormEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoiceTable from "@/components/invoice/InvoiceTable";
import InvoiceTotals from "@/components/invoice/InvoiceTotals";
import InvoiceDraftPanel from "@/components/invoice/InvoiceDraftPanel";
import InvoiceDraftList from "@/components/invoice/InvoiceDraftList";
import InvoiceActions from "@/components/invoice/InvoiceActions";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import { Button } from "@/components/ui/button";
import { fetchBusinessProfile } from "@/lib/apiClient";
import { sendInvoiceSentEmail } from "@/lib/emailService";
import { useInvoiceTotals } from "@/hooks/invoice/useInvoiceTotals";
import { useInvoiceValidation } from "@/hooks/invoice/useInvoiceValidation";
import {
  formatRelativeTime,
  useInvoiceDrafts,
} from "@/hooks/invoice/useInvoiceDrafts";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  InvoiceDraft,
  InvoiceFormState,
  InvoiceItemError,
  InvoiceItemForm,
  TaxMode,
} from "@/types/invoice";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";
import {
  useCreateInvoiceMutation,
  useCustomersQuery,
  useProductsQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";

type InvoiceClientProps = {
  name: string;
  image?: string;
};

const sanitizeItemFieldValue = (
  key: keyof InvoiceItemForm,
  value: string,
) => {
  if (key === "quantity") {
    if (value === "") return value;
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) return value;
    return String(Math.max(1, Math.floor(quantity)));
  }

  if (key === "price" || key === "tax_rate") {
    if (value === "") return value;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return value;
    return String(Math.max(0, numericValue));
  }

  return value;
};

const sanitizeDiscountPercent = (value: string) => {
  if (value === "") return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return String(Math.min(100, Math.max(0, numericValue)));
};

const sanitizeDiscountAmount = (value: string) => {
  if (value === "") return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return String(Math.max(0, numericValue));
};

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
  fontFamily: "var(--font-geist-mono)",
  tableStyle: "grid",
};

const InvoiceClient = ({ name, image }: InvoiceClientProps) => {
  const { formatDate, locale, t } = useI18n();
  const { data: customers } = useCustomersQuery();
  const { data: products } = useProductsQuery();
  const { data: warehouses } = useWarehousesQuery();
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: sendInvoiceSentEmail,
  });
  const createInvoice = useCreateInvoiceMutation();
  const { downloadPdf } = useInvoicePdf();
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<
    number | null
  >(null);
  const [lastCreatedInvoiceNumber, setLastCreatedInvoiceNumber] = useState<
    string | null
  >(null);
  const [lastCreatedCustomerEmail, setLastCreatedCustomerEmail] = useState<
    string | null
  >(null);
  const [lastCreatedInvoiceEmailPayload, setLastCreatedInvoiceEmailPayload] =
    useState<Parameters<typeof sendInvoiceSentEmail>[0] | null>(null);

  const [form, setForm] = useState<InvoiceFormState>({
    customer_id: "",
    date: "",
    due_date: "",
    discount: "0",
    discount_type: "PERCENTAGE",
    notes: "",
    sync_sales: true,
    warehouse_id: "",
  });
  const [taxMode, setTaxMode] = useState<TaxMode>("CGST_SGST");
  const [items, setItems] = useState<InvoiceItemForm[]>([
    { product_id: "", name: "", quantity: "1", price: "", tax_rate: "" },
  ]);
  const [itemErrors, setItemErrors] = useState<InvoiceItemError[]>([]);
  const [summaryErrors, setSummaryErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const validation = useInvoiceValidation(form, items);
  const totals = useInvoiceTotals(
    items,
    form.discount,
    form.discount_type,
    taxMode,
  );
  const activeEnabledSections = DEFAULT_INVOICE_SECTIONS;
  const activeSectionOrder = DEFAULT_INVOICE_SECTIONS;
  const activeTheme = DEFAULT_INVOICE_THEME;
  const activeDesignConfig = useMemo(() => normalizeDesignConfig(null), []);

  const parseServerErrors = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[] | string> }
        | undefined;
      const messages = new Set<string>();
      if (data?.message) messages.add(data.message);
      if (data?.errors) {
        Object.values(data.errors).forEach((values) => {
          const list = Array.isArray(values) ? values : [values];
          list.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const customer = useMemo(
    () =>
      (customers ?? []).find((item) => String(item.id) === form.customer_id),
    [customers, form.customer_id],
  );

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (customers ?? []).forEach((item) => {
      map.set(String(item.id), item.name);
    });
    return map;
  }, [customers]);

  const invoiceDate = useMemo(
    () => (form.date ? formatDate(form.date) : formatDate(new Date())),
    [form.date, formatDate],
  );

  const dueDate = useMemo(() => {
    if (form.due_date) {
      return formatDate(form.due_date);
    }
    return invoiceDate;
  }, [form.due_date, formatDate, invoiceDate]);

  const invoicePreviewData: InvoicePreviewData = useMemo(() => {
    const businessName = businessProfile?.business_name || "BillSutra";
    return {
      invoiceNumber: t("invoice.invoicePreviewNumber"),
      invoiceDate,
      dueDate,
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
        showTaxNumber: businessProfile?.show_tax_number ?? false,
        showPaymentQr: businessProfile?.show_payment_qr ?? false,
      },
      client: {
        name: customer?.name ?? t("invoice.fallbackCustomer"),
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        address: customer?.address ?? "",
      },
      items: items.map((item) => ({
        name: item.name || t("invoice.fallbackItem"),
        description: "",
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.price) || 0,
        taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
      })),
      totals,
      discount: {
        type: form.discount_type,
        value: Number(form.discount) || 0,
        label:
          form.discount_type === "PERCENTAGE"
            ? t("invoice.discountPercentageLabel", {
                value: Math.min(100, Math.max(0, Number(form.discount) || 0)).toFixed(
                  2,
                ),
              })
            : t("invoice.discountFixedLabel"),
      },
      notes: form.notes || "",
      paymentInfo: "",
    };
  }, [
    businessProfile,
    customer,
    dueDate,
    form.discount,
    form.discount_type,
    form.notes,
    invoiceDate,
    items,
    t,
    totals,
  ]);

  const handleLoadDraft = useCallback((draft: InvoiceDraft) => {
    setForm({
      ...draft.form,
      sync_sales: draft.form.sync_sales ?? true,
      warehouse_id: draft.form.warehouse_id ?? "",
    });
    setTaxMode(draft.taxMode);
    setItems(draft.items);
    setItemErrors([]);
    setSummaryErrors([]);
    setServerError(null);
  }, []);

  const {
    drafts,
    draftId,
    lastSavedAt,
    isDirty,
    markDirty,
    saveNewDraft,
    loadDraft,
    deleteDraft,
    clearDraft,
  } = useInvoiceDrafts({
    form,
    items,
    taxMode,
    onLoadDraft: handleLoadDraft,
  });

  const handleItemChange = useCallback(
    (index: number, key: keyof InvoiceItemForm, value: string) => {
      const nextValue = sanitizeItemFieldValue(key, value);
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, [key]: nextValue } : item,
        ),
      );
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty],
  );

  const handleProductSelect = useCallback(
    (index: number, productId: string) => {
      const product = (products ?? []).find(
        (item) => String(item.id) === productId,
      );
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                product_id: productId,
                name: product?.name ?? item.name,
                price:
                  product?.price !== undefined && product?.price !== null
                    ? String(product.price)
                    : item.price,
                tax_rate:
                  product?.gst_rate !== undefined &&
                  product?.gst_rate !== null
                    ? String(product.gst_rate)
                    : item.tax_rate,
              }
            : item,
        ),
      );
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty, products],
  );

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { product_id: "", name: "", quantity: "1", price: "", tax_rate: "" },
    ]);
    setItemErrors([]);
    setSummaryErrors([]);
    setServerError(null);
    markDirty();
  }, [markDirty]);

  const removeItem = useCallback(
    (index: number) => {
      setItems((prev) => prev.filter((_, idx) => idx !== index));
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty],
  );

  const handleFormChange = useCallback(
    (next: InvoiceFormState) => {
      const discount =
        next.discount_type === "PERCENTAGE"
          ? sanitizeDiscountPercent(next.discount)
          : sanitizeDiscountAmount(next.discount);
      setForm({
        ...next,
        discount,
      });
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty],
  );

  const handleTaxModeChange = useCallback(
    (mode: TaxMode) => {
      setTaxMode(mode);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    try {
      await downloadPdf({
        previewPayload: {
          data: invoicePreviewData,
          enabledSections: activeEnabledSections,
          sectionOrder: activeSectionOrder,
          theme: activeTheme,
          designConfig: activeDesignConfig,
        },
        fileName: `invoice-${invoicePreviewData.invoiceNumber}.pdf`,
      });
    } catch {
      toast.error(t("invoice.pdfError"));
    }
  }, [
    activeDesignConfig,
    activeEnabledSections,
    activeSectionOrder,
    activeTheme,
    downloadPdf,
    invoicePreviewData,
    t,
  ]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);

    setItemErrors(validation.errors);
    setSummaryErrors(validation.summary);
    if (validation.summary.length > 0) return;

    try {
      const selectedCustomer =
        customers?.find((customer) => customer.id === Number(form.customer_id)) ??
        null;
      const itemsSummary = items
        .map((item) => {
          const quantity = Number(item.quantity || 0);
          const price = Number(item.price || 0);
          return t("invoice.itemsSummaryLine", {
            name: item.name || t("invoice.fallbackItem"),
            quantity,
            currency: t("common.currencyCode"),
            price: price.toFixed(2),
          });
        })
        .join("\n");

      const createdInvoice = await createInvoice.mutateAsync({
        customer_id: Number(form.customer_id),
        date: form.date || undefined,
        due_date: form.due_date || undefined,
        discount: Number(form.discount) || undefined,
        discount_type: form.discount_type,
        sync_sales: form.sync_sales,
        warehouse_id: form.warehouse_id ? Number(form.warehouse_id) : undefined,
        items: items.map((item) => ({
          product_id: item.product_id ? Number(item.product_id) : undefined,
          name: item.name.trim(),
          quantity: Number(item.quantity),
          price: Number(item.price),
          tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
        })),
      });

      setLastCreatedInvoiceId(createdInvoice.id);
      setLastCreatedInvoiceNumber(createdInvoice.invoice_number);
      setLastCreatedCustomerEmail(selectedCustomer?.email ?? null);
      setLastCreatedInvoiceEmailPayload(
        selectedCustomer?.email
          ? {
              user_email: selectedCustomer.email,
              customer_name: selectedCustomer.name,
              invoice_number: createdInvoice.invoice_number,
              invoice_date: form.date || new Date().toISOString().slice(0, 10),
              due_date: form.due_date || null,
              total: `INR ${totals.total.toFixed(2)}`,
              business_name: businessProfile?.business_name ?? "BillSutra",
              business_email: businessProfile?.email ?? null,
              business_phone: businessProfile?.phone ?? null,
              notes: form.notes || null,
              items_summary: itemsSummary || t("invoice.noItemsSummary"),
            }
          : null,
      );
      toast.success(
        t("invoice.createSuccess", { invoiceNumber: createdInvoice.invoice_number }),
      );

      setForm({
        customer_id: "",
        date: "",
        due_date: "",
        discount: "0",
        discount_type: "PERCENTAGE",
        notes: "",
        sync_sales: true,
        warehouse_id: "",
      });
      setItems([
        { product_id: "", name: "", quantity: "1", price: "", tax_rate: "" },
      ]);
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      clearDraft();
    } catch (error) {
      setServerError(parseServerErrors(error, t("invoice.createError")));
    }
  };

  const handleSendInvoiceEmail = useCallback(async () => {
    if (!lastCreatedInvoiceId) {
      toast.error(t("invoice.sendEmailMissingInvoice"));
      return;
    }

    if (!lastCreatedCustomerEmail || !lastCreatedInvoiceEmailPayload) {
      toast.error(t("invoice.sendEmailMissingCustomer"));
      return;
    }

    try {
      await sendInvoiceEmailMutation.mutateAsync(lastCreatedInvoiceEmailPayload);
      toast.success(t("invoice.sendEmailSuccess"));
      toast.success(
        t("invoice.sendEmailSuccessInvoice", {
          invoiceNumber: lastCreatedInvoiceNumber ?? `#${lastCreatedInvoiceId}`,
        }),
      );
    } catch (error) {
      console.error("Invoice email failed:", error);
      setServerError(parseServerErrors(error, t("invoice.sendEmailError")));
      toast.error(t("invoice.sendEmailFailureToast"));
    }
  }, [
    lastCreatedCustomerEmail,
    lastCreatedInvoiceEmailPayload,
    lastCreatedInvoiceId,
    lastCreatedInvoiceNumber,
    t,
    parseServerErrors,
    sendInvoiceEmailMutation,
  ]);

  const headerActions = (
    <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
      <div className="flex min-w-[150px] flex-col items-start gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:items-end sm:text-right">
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs uppercase tracking-[0.25em] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {isDirty ? t("common.draft") : t("common.saved")}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isDirty
            ? t("invoice.statusUnsavedChanges")
            : lastSavedAt
              ? t("invoiceDrafts.savedRelative", {
                  time: formatRelativeTime(lastSavedAt, locale),
                })
              : t("common.ready")}
        </span>
      </div>
      <Button asChild variant="outline" className="h-11 rounded-xl px-4">
        <Link href="/invoices/history">{t("invoice.viewHistory")}</Link>
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("invoice.pageTitle")}
      subtitle={t("invoice.pageSubtitle")}
      actions={headerActions}
    >
      <div className="mx-auto w-full max-w-7xl font-[var(--font-sora),var(--font-geist-sans)]">
        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
          <div className="grid gap-6">
            <InvoiceForm
              form={form}
              customers={customers ?? []}
              warehouses={warehouses ?? []}
              taxMode={taxMode}
              onFormChange={handleFormChange}
              onTaxModeChange={handleTaxModeChange}
              onSubmit={handleSubmit}
              isSubmitting={createInvoice.isPending}
              summaryErrors={summaryErrors}
              serverError={serverError}
            />
            <InvoiceTable
              items={items}
              errors={itemErrors}
              products={products ?? []}
              onItemChange={handleItemChange}
              onProductSelect={handleProductSelect}
              onAddItem={addItem}
              onRemoveItem={removeItem}
            />
          </div>

          <aside className="grid gap-4 lg:sticky lg:top-8">
            <div className="printable">
              <DesignConfigProvider
                value={{
                  designConfig: activeDesignConfig,
                  updateSection: () => {},
                  resetSection: () => {},
                  resetAll: () => {},
                }}
              >
                <div
                  id="invoice-preview-pdf-root"
                  className="rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 print:border-0 print:bg-transparent print:p-0 print:shadow-none"
                >
                  <A4PreviewStack
                    stackKey={`invoices-preview-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}-${activeTheme.primaryColor}`}
                  >
                    <TemplatePreviewRenderer
                      key={`${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}`}
                      data={invoicePreviewData}
                      enabledSections={activeEnabledSections}
                      sectionOrder={activeSectionOrder}
                      theme={activeTheme}
                    />
                  </A4PreviewStack>
                </div>
              </DesignConfigProvider>
            </div>

            <InvoiceDraftPanel
              isDirty={isDirty}
              lastSavedAt={lastSavedAt}
              onSaveDraft={saveNewDraft}
            />
            <InvoiceDraftList
              drafts={drafts}
              currentDraftId={draftId}
              customerNameById={customerNameById}
              onLoadDraft={loadDraft}
              onDeleteDraft={deleteDraft}
            />
            <InvoiceTotals
              totals={totals}
              taxMode={taxMode}
              discountValue={form.discount}
              discountType={form.discount_type}
            />
            <div className="no-print rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {t("invoice.gstNoteTitle")}
              </p>
              <p className="mt-2">{t("invoice.gstNoteBody")}</p>
            </div>
            <InvoiceActions
              onPrint={handlePrint}
              onDownloadPdf={handleDownloadPdf}
              onSendEmail={handleSendInvoiceEmail}
              isSendingEmail={sendInvoiceEmailMutation.isPending}
              canSendEmail={Boolean(
                lastCreatedInvoiceId && lastCreatedCustomerEmail,
              )}
            />
          </aside>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceClient;
