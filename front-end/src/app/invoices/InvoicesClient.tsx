"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import Link from "next/link";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoiceTable from "@/components/invoice/InvoiceTable";
import InvoiceHeader from "@/components/invoice/InvoiceHeader";
import InvoiceTotals from "@/components/invoice/InvoiceTotals";
import InvoiceDraftPanel from "@/components/invoice/InvoiceDraftPanel";
import InvoiceDraftList from "@/components/invoice/InvoiceDraftList";
import InvoiceActions from "@/components/invoice/InvoiceActions";
import {
  DesignConfigProvider,
  type DesignConfig,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import {
  fetchInvoicePdfFile,
  fetchBusinessProfile,
  sendInvoiceEmail,
  fetchTemplates,
  fetchUserTemplates,
  saveUserTemplate,
} from "@/lib/apiClient";
import { SECTION_LABELS, TEMPLATE_CATALOG } from "@/lib/invoiceTemplateData";
import { useInvoiceTotals } from "@/hooks/invoice/useInvoiceTotals";
import { useInvoiceValidation } from "@/hooks/invoice/useInvoiceValidation";
import { useInvoiceDrafts } from "@/hooks/invoice/useInvoiceDrafts";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import type {
  InvoiceDraft,
  InvoiceFormState,
  InvoiceItemError,
  InvoiceItemForm,
  TaxMode,
} from "@/types/invoice";
import type { InvoicePreviewData, SectionKey } from "@/types/invoice-template";
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

const InvoiceClient = ({ name, image }: InvoiceClientProps) => {
  const { data: customers } = useCustomersQuery();
  const { data: products } = useProductsQuery();
  const { data: warehouses } = useWarehousesQuery();
  const { data: templateRecords = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });
  const { data: userTemplateRecords = [] } = useQuery({
    queryKey: ["user-templates"],
    queryFn: fetchUserTemplates,
  });
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const saveTemplateMutation = useMutation({
    mutationFn: saveUserTemplate,
    onSuccess: () => {
      toast.success("Template applied");
    },
    onError: () => {
      toast.error("Unable to apply template");
    },
  });
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: sendInvoiceEmail,
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

  const [form, setForm] = useState<InvoiceFormState>({
    customer_id: "",
    date: "",
    due_date: "",
    discount: "0",
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [hasManualTemplateSelection, setHasManualTemplateSelection] =
    useState(false);
  const validation = useInvoiceValidation(form, items);
  const totals = useInvoiceTotals(items, form.discount, taxMode);
  const knownSections = useMemo(
    () => new Set<SectionKey>(Object.keys(SECTION_LABELS) as SectionKey[]),
    [],
  );
  const normalizeSection = useCallback(
    (section: string): SectionKey | null => {
      return knownSections.has(section as SectionKey)
        ? (section as SectionKey)
        : null;
    },
    [knownSections],
  );

  const templatesFromApi = useMemo(() => {
    if (!templateRecords.length) return null;

    const mapFontFamily = (font: string) => {
      const value = font.toLowerCase();
      if (value.includes("sora")) return "var(--font-sora)";
      if (value.includes("fraunces")) return "var(--font-fraunces)";
      if (value.includes("mono")) return "var(--font-geist-mono)";
      return "var(--font-geist-sans)";
    };

    return templateRecords.map((template) => {
      const orderedSections = (template.sections ?? [])
        .slice()
        .sort((a, b) => a.section_order - b.section_order)
        .map((section) => normalizeSection(section.section_key))
        .filter((section): section is SectionKey => Boolean(section));
      const defaultSections = (template.sections ?? [])
        .filter((section) => section.is_default)
        .sort((a, b) => a.section_order - b.section_order)
        .map((section) => normalizeSection(section.section_key))
        .filter((section): section is SectionKey => Boolean(section));

      return {
        id: String(template.id),
        name: template.name,
        description: template.description ?? "",
        layout: template.layout_config.layout,
        defaultSections: defaultSections.length
          ? defaultSections
          : orderedSections,
        theme: {
          primaryColor: template.layout_config.primaryColor,
          fontFamily: mapFontFamily(template.layout_config.font),
          tableStyle: template.layout_config.tableStyle,
        },
        sectionOrder: orderedSections.length
          ? orderedSections
          : defaultSections,
      };
    });
  }, [templateRecords, normalizeSection]);

  const templates = templatesFromApi ?? TEMPLATE_CATALOG;
  const activeUserTemplate = useMemo(() => {
    if (!userTemplateRecords.length) return null;
    return [...userTemplateRecords].sort((a, b) => {
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    })[0];
  }, [userTemplateRecords]);

  const activeTemplate = useMemo(() => {
    if (activeUserTemplate) {
      return (
        templates.find(
          (template) => Number(template.id) === activeUserTemplate.template_id,
        ) ?? templates[0]
      );
    }
    return templates[0];
  }, [activeUserTemplate, templates]);

  useEffect(() => {
    if (hasManualTemplateSelection) return;
    if (activeTemplate) {
      setSelectedTemplateId(activeTemplate.id);
    }
  }, [activeTemplate, hasManualTemplateSelection]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return activeTemplate;
    return (
      templates.find((template) => template.id === selectedTemplateId) ??
      activeTemplate
    );
  }, [activeTemplate, selectedTemplateId, templates]);

  const selectedUserTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    const selectedId = Number(selectedTemplateId);
    if (!selectedId || Number.isNaN(selectedId)) return null;
    return (
      userTemplateRecords.find((item) => item.template_id === selectedId) ??
      null
    );
  }, [selectedTemplateId, userTemplateRecords]);

  const activeEnabledSections = useMemo(() => {
    if (!selectedUserTemplate) return selectedTemplate.defaultSections;
    const normalized = selectedUserTemplate.enabled_sections
      .map((section) => normalizeSection(section))
      .filter((section): section is SectionKey => Boolean(section));
    return normalized.length ? normalized : selectedTemplate.defaultSections;
  }, [selectedTemplate, selectedUserTemplate, normalizeSection]);

  const activeSectionOrder = useMemo(() => {
    if (!selectedUserTemplate) {
      return selectedTemplate.sectionOrder ?? selectedTemplate.defaultSections;
    }
    const normalized = selectedUserTemplate.section_order
      .map((section) => normalizeSection(section))
      .filter((section): section is SectionKey => Boolean(section));
    return normalized.length
      ? normalized
      : (selectedTemplate.sectionOrder ?? selectedTemplate.defaultSections);
  }, [selectedTemplate, selectedUserTemplate, normalizeSection]);

  const activeTheme = useMemo(() => {
    if (!selectedUserTemplate?.theme_color) return selectedTemplate.theme;
    return {
      ...selectedTemplate.theme,
      primaryColor: selectedUserTemplate.theme_color,
    };
  }, [selectedTemplate, selectedUserTemplate]);

  const activeDesignConfig = useMemo(() => {
    return normalizeDesignConfig(
      (selectedUserTemplate?.design_config as Partial<DesignConfig> | null) ??
        null,
    );
  }, [selectedUserTemplate]);

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
    () =>
      form.date
        ? new Date(form.date).toLocaleDateString("en-IN")
        : new Date().toLocaleDateString("en-IN"),
    [form.date],
  );

  const dueDate = useMemo(() => {
    if (form.due_date) {
      return new Date(form.due_date).toLocaleDateString("en-IN");
    }
    return invoiceDate;
  }, [form.due_date, invoiceDate]);

  const invoicePreviewData: InvoicePreviewData = useMemo(() => {
    const businessName = businessProfile?.business_name || "BillSutra";
    return {
      invoiceNumber: "INV-NEW",
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
        name: customer?.name ?? "Customer",
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        address: customer?.address ?? "",
      },
      items: items.map((item) => ({
        name: item.name || "Item",
        description: "",
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.price) || 0,
        taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
      })),
      notes: form.notes || "",
      paymentInfo: "",
    };
  }, [businessProfile, customer, dueDate, form.notes, invoiceDate, items]);

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
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, [key]: value } : item,
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
                price: product?.price ? String(product.price) : item.price,
                tax_rate: product?.gst_rate
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
      setForm(next);
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
          templateId: selectedTemplate.id,
          data: invoicePreviewData,
          enabledSections: activeEnabledSections,
          sectionOrder: activeSectionOrder,
          theme: activeTheme,
          designConfig: activeDesignConfig,
        },
        fileName: `invoice-${invoicePreviewData.invoiceNumber}.pdf`,
      });
    } catch {
      toast.error("Unable to generate PDF from preview");
    }
  }, [
    activeDesignConfig,
    activeEnabledSections,
    activeSectionOrder,
    activeTheme,
    downloadPdf,
    invoicePreviewData,
    selectedTemplate.id,
  ]);

  const handleTemplateSelect = async (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setHasManualTemplateSelection(true);

    const normalizedOrder = template.sectionOrder ?? template.defaultSections;
    await saveTemplateMutation.mutateAsync({
      template_id: Number(templateId),
      enabled_sections: template.defaultSections,
      section_order: normalizedOrder,
      theme_color: template.theme.primaryColor,
      design_config: selectedUserTemplate?.design_config ?? null,
    });
  };

  const handleSectionToggle = async (section: SectionKey) => {
    const templateIdNumber = Number(selectedTemplate.id);
    if (!templateIdNumber || Number.isNaN(templateIdNumber)) return;

    const isEnabled = activeEnabledSections.includes(section);
    const nextEnabled = isEnabled
      ? activeEnabledSections.filter((item) => item !== section)
      : [...activeEnabledSections, section];
    const nextOrder = isEnabled
      ? activeSectionOrder.filter((item) => item !== section)
      : [...activeSectionOrder, section];

    await saveTemplateMutation.mutateAsync({
      template_id: templateIdNumber,
      enabled_sections: nextEnabled,
      section_order: nextOrder,
      theme_color: activeTheme.primaryColor,
      design_config: selectedUserTemplate?.design_config ?? null,
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setServerError(null);

    setItemErrors(validation.errors);
    setSummaryErrors(validation.summary);
    if (validation.summary.length > 0) return;

    try {
      const createdInvoice = await createInvoice.mutateAsync({
        customer_id: Number(form.customer_id),
        date: form.date || undefined,
        due_date: form.due_date || undefined,
        discount: totals.discount || undefined,
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
      setLastCreatedCustomerEmail(createdInvoice.customer?.email ?? null);

      try {
        const pdfFile = await fetchInvoicePdfFile(
          createdInvoice.id,
          createdInvoice.invoice_number,
        );
        const pdfUrl = URL.createObjectURL(pdfFile.blob);
        const anchor = document.createElement("a");
        anchor.href = pdfUrl;
        anchor.download = pdfFile.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(pdfUrl);
      } catch (pdfError) {
        toast.error(
          parseServerErrors(
            pdfError,
            "Invoice saved, but PDF download failed.",
          ),
        );
      }

      setForm({
        customer_id: "",
        date: "",
        due_date: "",
        discount: "0",
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
      setServerError(parseServerErrors(error, "Unable to create invoice."));
    }
  };

  const handleSendInvoiceEmail = useCallback(async () => {
    if (!lastCreatedInvoiceId) {
      toast.error("Create and save the invoice first");
      return;
    }

    if (!lastCreatedCustomerEmail) {
      toast.error("Customer email is missing on the saved invoice");
      return;
    }

    try {
      await sendInvoiceEmailMutation.mutateAsync(lastCreatedInvoiceId);
      toast.success(
        `Invoice ${lastCreatedInvoiceNumber ?? `#${lastCreatedInvoiceId}`} email sent`,
      );
    } catch (error) {
      setServerError(parseServerErrors(error, "Unable to send invoice email."));
      toast.error("Unable to send invoice email");
    }
  }, [
    lastCreatedCustomerEmail,
    lastCreatedInvoiceId,
    lastCreatedInvoiceNumber,
    parseServerErrors,
    sendInvoiceEmailMutation,
  ]);

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Create invoice"
      subtitle="Build GST-ready invoices with live totals, customer details, and preview-ready layouts for printing."
    >
      <div className="mx-auto w-full max-w-7xl font-[var(--font-sora),var(--font-geist-sans)]">
        <InvoiceHeader isDirty={isDirty} lastSavedAt={lastSavedAt} />

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
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
            <div className="no-print rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Invoice template</h3>
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                  {selectedTemplate.name}
                </span>
              </div>
              <label className="mt-3 block text-xs text-gray-500">
                Choose template
                <select
                  value={selectedTemplate.id}
                  onChange={(event) => handleTemplateSelect(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                <span>Theme color: {activeTheme.primaryColor}</span>
                <Link
                  href="/templates"
                  className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-semibold text-gray-900 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  Manage templates
                </Link>
              </div>
            </div>
            <div className="no-print rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-sm font-semibold">Sections</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {activeSectionOrder.map((section) => (
                  <label
                    key={section}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-700"
                  >
                    <span>{SECTION_LABELS[section]}</span>
                    <div className="flex items-center gap-2">
                      {saveTemplateMutation.isPending ? (
                        <span className="h-3 w-3 animate-spin rounded-full border border-[#d6c8b8] border-t-transparent" />
                      ) : null}
                      <input
                        type="checkbox"
                        checked={activeEnabledSections.includes(section)}
                        onChange={() => handleSectionToggle(section)}
                        disabled={saveTemplateMutation.isPending}
                        className="h-4 w-4 rounded border-[#d6c8b8] text-primary disabled:opacity-60"
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
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
                    stackKey={`invoices-preview-${selectedTemplate.id}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}-${activeTheme.primaryColor}`}
                  >
                    <TemplatePreviewRenderer
                      key={`${selectedTemplate.id}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}`}
                      templateId={selectedTemplate.id}
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
            <InvoiceTotals totals={totals} taxMode={taxMode} />
            <div className="no-print rounded-xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                GST note
              </p>
              <p className="mt-2">
                Choose CGST + SGST for intra-state invoices and IGST for
                inter-state billing. Use “No GST” for exempt invoices.
              </p>
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
