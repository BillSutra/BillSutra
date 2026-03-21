"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import type { AsyncProductSelectHandle } from "@/components/products/AsyncProductSelect";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useCreateCustomerMutation,
  useCreateInvoiceMutation,
  useCreateProductMutation,
  useCustomersQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import type { Customer, Product } from "@/lib/apiClient";

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

type ShortcutHighlightSection = "entry" | "form" | "items" | "actions" | null;

type QuickProductForm = {
  name: string;
  price: string;
  barcode: string;
};

type QuickCustomerForm = {
  name: string;
  phone: string;
};

const createEmptyInvoiceForm = (): InvoiceFormState => ({
  customer_id: "",
  date: "",
  due_date: "",
  discount: "0",
  discount_type: "PERCENTAGE",
  notes: "",
  sync_sales: true,
  warehouse_id: "",
});

const createEmptyInvoiceItem = (): InvoiceItemForm => ({
  product_id: "",
  name: "",
  quantity: "1",
  price: "",
  tax_rate: "",
});

const buildProductSku = (name: string, barcode: string) => {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const suffix =
    barcode.trim().replace(/\D+/g, "").slice(-4) ||
    Date.now().toString().slice(-4);

  return `${base || "ITEM"}-${suffix}`;
};

const InvoiceClient = ({ name, image }: InvoiceClientProps) => {
  const { formatDate, locale, t } = useI18n();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: customers } = useCustomersQuery();
  const { data: warehouses } = useWarehousesQuery();
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: sendInvoiceSentEmail,
  });
  const createInvoice = useCreateInvoiceMutation();
  const createProduct = useCreateProductMutation();
  const createCustomer = useCreateCustomerMutation();
  const { downloadPdf } = useInvoicePdf();
  const quickEntryRef = useRef<AsyncProductSelectHandle | null>(null);
  const quickProductNameRef = useRef<HTMLInputElement | null>(null);
  const quickCustomerNameRef = useRef<HTMLInputElement | null>(null);
  const shortcutHighlightTimerRef = useRef<number | null>(null);
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

  const [form, setForm] = useState<InvoiceFormState>(createEmptyInvoiceForm);
  const [taxMode, setTaxMode] = useState<TaxMode>("CGST_SGST");
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [quickEntryProduct, setQuickEntryProduct] = useState<Product | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [shortcutHighlight, setShortcutHighlight] =
    useState<ShortcutHighlightSection>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [quickAddProductOpen, setQuickAddProductOpen] = useState(false);
  const [quickAddCustomerOpen, setQuickAddCustomerOpen] = useState(false);
  const [quickProductForm, setQuickProductForm] = useState<QuickProductForm>({
    name: "",
    price: "",
    barcode: "",
  });
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>({
    name: "",
    phone: "",
  });
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
  const autoFocusProductSearch =
    searchParams.get("quickAction") === "new-bill";
  const isMacShortcutPlatform = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad/i.test(navigator.platform);
  }, []);
  const shortcutModifierLabel = isMacShortcutPlatform ? "Cmd" : "Ctrl";

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

  const focusProductSearch = useCallback((select = true) => {
    window.setTimeout(() => {
      quickEntryRef.current?.focus({ select });
    }, 70);
  }, []);

  const flashShortcutSection = useCallback((section: ShortcutHighlightSection) => {
    setShortcutHighlight(section);
    if (shortcutHighlightTimerRef.current) {
      window.clearTimeout(shortcutHighlightTimerRef.current);
    }
    shortcutHighlightTimerRef.current = window.setTimeout(() => {
      setShortcutHighlight(null);
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (shortcutHighlightTimerRef.current) {
        window.clearTimeout(shortcutHighlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!quickAddProductOpen) return;

    const timeoutId = window.setTimeout(() => {
      quickProductNameRef.current?.focus();
      quickProductNameRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [quickAddProductOpen]);

  useEffect(() => {
    if (!quickAddCustomerOpen) return;

    const timeoutId = window.setTimeout(() => {
      quickCustomerNameRef.current?.focus();
      quickCustomerNameRef.current?.select();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [quickAddCustomerOpen]);

  useEffect(() => {
    if (items.length === 0) {
      setSelectedItemIndex(null);
      return;
    }

    setSelectedItemIndex((currentIndex) => {
      if (currentIndex === null) return 0;
      return Math.min(currentIndex, items.length - 1);
    });
  }, [items.length]);

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
    setQuickEntryProduct(null);
    setSelectedItemIndex(draft.items.length > 0 ? 0 : null);
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

  const addProductToBill = useCallback(
    (
      product: Product,
      options?: { toastMessage?: string; focusSearch?: boolean },
    ) => {
      let nextSelectedIndex = 0;
      let incrementedQuantity = false;

      setItems((currentItems) => {
        const existingIndex = currentItems.findIndex(
          (item) => item.product_id === String(product.id),
        );

        if (existingIndex >= 0) {
          incrementedQuantity = true;
          nextSelectedIndex = existingIndex;
          return currentItems.map((item, index) =>
            index === existingIndex
              ? {
                  ...item,
                  quantity: String(Math.max(1, Number(item.quantity || 0) + 1)),
                }
              : item,
          );
        }

        nextSelectedIndex = currentItems.length;
        return [
          ...currentItems,
          {
            product_id: String(product.id),
            name: product.name,
            quantity: "1",
            price: String(product.price),
            tax_rate:
              product.gst_rate !== undefined && product.gst_rate !== null
                ? String(product.gst_rate)
                : "",
          },
        ];
      });

      setSelectedItemIndex(nextSelectedIndex);
      setQuickEntryProduct(null);
      quickEntryRef.current?.clear();
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
      flashShortcutSection("items");
      toast.success(
        options?.toastMessage ??
          (incrementedQuantity
            ? `${product.name} quantity increased`
            : `${product.name} added to bill`),
      );

      if (options?.focusSearch !== false) {
        focusProductSearch();
      }
    },
    [flashShortcutSection, focusProductSearch, markDirty],
  );

  const resetInvoiceComposer = useCallback(
    (options?: { announce?: boolean }) => {
      setForm(createEmptyInvoiceForm());
      setTaxMode("CGST_SGST");
      setItems([]);
      setQuickEntryProduct(null);
      setSelectedItemIndex(null);
      quickEntryRef.current?.clear();
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      clearDraft();
      flashShortcutSection("entry");

      if (options?.announce) {
        toast.success("New bill created");
      }

      focusProductSearch();
    },
    [clearDraft, flashShortcutSection, focusProductSearch],
  );

  const handleItemChange = useCallback(
    (index: number, key: keyof InvoiceItemForm, value: string) => {
      const nextValue = sanitizeItemFieldValue(key, value);
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, [key]: nextValue } : item,
        ),
      );
      setSelectedItemIndex(index);
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty],
  );

  const handleProductSelect = useCallback(
    (index: number, product: Product | null) => {
      setSelectedItemIndex(index);
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                product_id: product ? String(product.id) : "",
                name: product?.name ?? "",
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
    [markDirty],
  );

  const addItem = useCallback(() => {
    setItems((prev) => {
      const nextItems = [...prev, createEmptyInvoiceItem()];
      setSelectedItemIndex(nextItems.length - 1);
      return nextItems;
    });
    setItemErrors([]);
    setSummaryErrors([]);
    setServerError(null);
    markDirty();
    flashShortcutSection("items");
  }, [flashShortcutSection, markDirty]);

  const removeItem = useCallback(
    (index: number, options?: { announce?: boolean }) => {
      let removedLabel = "Item";
      let nextSelectedIndex: number | null = null;

      setItems((prev) => {
        if (index < 0 || index >= prev.length) return prev;

        removedLabel = prev[index]?.name || removedLabel;
        const nextItems = prev.filter((_, idx) => idx !== index);

        if (nextItems.length === 0) {
          nextSelectedIndex = null;
          return nextItems;
        }

        nextSelectedIndex =
          selectedItemIndex === null
            ? Math.min(index, nextItems.length - 1)
            : selectedItemIndex > index
              ? selectedItemIndex - 1
              : selectedItemIndex === index
                ? Math.min(index, nextItems.length - 1)
                : selectedItemIndex;

        return nextItems;
      });

      setSelectedItemIndex(nextSelectedIndex);
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
      flashShortcutSection("items");

      if (options?.announce !== false) {
        toast.success(`${removedLabel} removed from bill`);
      }

      focusProductSearch(false);
    },
    [flashShortcutSection, focusProductSearch, markDirty, selectedItemIndex],
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

  const handleQuickEntrySubmit = useCallback(
    (product: Product | null) => {
      if (!product) {
        flashShortcutSection("entry");
        toast.error("Select or scan a product first.");
        focusProductSearch();
        return;
      }

      addProductToBill(product);
    },
    [addProductToBill, flashShortcutSection, focusProductSearch],
  );

  const handleQuickCreateProduct = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = quickProductForm.name.trim();
      const trimmedPrice = quickProductForm.price.trim();
      const trimmedBarcode = quickProductForm.barcode.trim();

      if (!trimmedName) {
        toast.error("Enter a product name.");
        quickProductNameRef.current?.focus();
        return;
      }

      if (!trimmedPrice || Number.isNaN(Number(trimmedPrice)) || Number(trimmedPrice) <= 0) {
        toast.error("Enter a valid selling price.");
        return;
      }

      try {
        const createdProduct = await createProduct.mutateAsync({
          name: trimmedName,
          sku: buildProductSku(trimmedName, trimmedBarcode),
          price: Number(trimmedPrice),
          barcode: trimmedBarcode || undefined,
          gst_rate: 18,
          stock_on_hand: 0,
          reorder_level: 0,
        });

        setQuickProductForm({ name: "", price: "", barcode: "" });
        setQuickAddProductOpen(false);
        addProductToBill(createdProduct, {
          toastMessage: `${createdProduct.name} created and added to bill`,
        });
      } catch (error) {
        toast.error(
          parseServerErrors(error, "Unable to create the product right now."),
        );
      }
    },
    [addProductToBill, createProduct, parseServerErrors, quickProductForm],
  );

  const handleQuickCreateCustomer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = quickCustomerForm.name.trim();
      const trimmedPhone = quickCustomerForm.phone.trim();

      if (trimmedName.length < 2) {
        toast.error("Customer name must be at least 2 characters.");
        quickCustomerNameRef.current?.focus();
        return;
      }

      if (trimmedPhone && trimmedPhone.length < 6) {
        toast.error("Phone number should be at least 6 characters.");
        return;
      }

      try {
        const createdCustomer = await createCustomer.mutateAsync({
          name: trimmedName,
          phone: trimmedPhone || undefined,
        });

        queryClient.setQueryData<Customer[]>(["customers"], (currentCustomers) => {
          const safeCustomers = currentCustomers ?? [];
          return [
            createdCustomer,
            ...safeCustomers.filter((customer) => customer.id !== createdCustomer.id),
          ];
        });

        handleFormChange({
          ...form,
          customer_id: String(createdCustomer.id),
        });
        setQuickCustomerForm({ name: "", phone: "" });
        setQuickAddCustomerOpen(false);
        flashShortcutSection("form");
        toast.success(`${createdCustomer.name} added as bill customer`);
        focusProductSearch();
      } catch (error) {
        toast.error(
          parseServerErrors(error, "Unable to create the customer right now."),
        );
      }
    },
    [
      createCustomer,
      flashShortcutSection,
      focusProductSearch,
      form,
      handleFormChange,
      parseServerErrors,
      queryClient,
      quickCustomerForm,
    ],
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

  const submitInvoice = useCallback(async () => {
    if (createInvoice.isPending) return;

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
      resetInvoiceComposer();
    } catch (error) {
      setServerError(parseServerErrors(error, t("invoice.createError")));
    }
  }, [
    businessProfile?.business_name,
    businessProfile?.email,
    businessProfile?.phone,
    createInvoice,
    customers,
    form,
    items,
    parseServerErrors,
    resetInvoiceComposer,
    t,
    totals.total,
    validation.errors,
    validation.summary,
  ]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      await submitInvoice();
    },
    [submitInvoice],
  );

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

  useEffect(() => {
    focusProductSearch(autoFocusProductSearch);
  }, [autoFocusProductSearch, focusProductSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const isEditableTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        Boolean(target?.isContentEditable);
      const hasShortcutModalOpen =
        shortcutHelpOpen || quickAddProductOpen || quickAddCustomerOpen;
      const key = event.key.toLowerCase();
      const hasModifier = event.ctrlKey || event.metaKey;

      const inputHasSelection =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? (target.selectionStart ?? 0) !== (target.selectionEnd ?? 0)
          : false;
      const hasPageSelection =
        typeof window !== "undefined" &&
        (window.getSelection()?.toString().trim().length ?? 0) > 0;

      if (
        !hasModifier &&
        !hasShortcutModalOpen &&
        (event.key === "?" || (event.shiftKey && event.key === "/")) &&
        !isEditableTarget
      ) {
        event.preventDefault();
        setShortcutHelpOpen(true);
        flashShortcutSection("actions");
        return;
      }

      if (hasShortcutModalOpen || !hasModifier || event.altKey) {
        return;
      }

      if (key === "c" && (inputHasSelection || hasPageSelection)) {
        return;
      }

      if (
        (key === "delete" || (isMacShortcutPlatform && key === "backspace")) &&
        isEditableTarget
      ) {
        return;
      }

      switch (key) {
        case "b":
          event.preventDefault();
          resetInvoiceComposer({ announce: true });
          break;
        case "p":
          event.preventDefault();
          setQuickAddProductOpen(true);
          flashShortcutSection("actions");
          toast.success("Quick product form opened");
          break;
        case "c":
          event.preventDefault();
          setQuickAddCustomerOpen(true);
          flashShortcutSection("actions");
          toast.success("Quick customer form opened");
          break;
        case "s":
          event.preventDefault();
          void submitInvoice();
          break;
        case "d": {
          event.preventDefault();
          const discountInput = document.getElementById("discount");
          if (discountInput instanceof HTMLInputElement) {
            discountInput.focus();
            discountInput.select();
          }
          flashShortcutSection("form");
          toast.success("Discount field focused");
          break;
        }
        case "q":
          event.preventDefault();
          flashShortcutSection("entry");
          focusProductSearch();
          toast.success("Product search focused");
          break;
        default:
          if (key === "delete" || (isMacShortcutPlatform && key === "backspace")) {
            event.preventDefault();
            if (selectedItemIndex === null || items.length === 0) {
              toast.error("Select a line item first.");
              flashShortcutSection("items");
              return;
            }
            removeItem(selectedItemIndex);
          }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    flashShortcutSection,
    focusProductSearch,
    isMacShortcutPlatform,
    items.length,
    quickAddCustomerOpen,
    quickAddProductOpen,
    removeItem,
    resetInvoiceComposer,
    selectedItemIndex,
    shortcutHelpOpen,
    submitInvoice,
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
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl px-4"
        onClick={() => resetInvoiceComposer({ announce: true })}
      >
        New bill ({shortcutModifierLabel}+B)
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl px-4"
        onClick={() => setShortcutHelpOpen(true)}
      >
        Shortcuts (?)
      </Button>
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
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            `New bill (${shortcutModifierLabel}+B)`,
            `Add product (${shortcutModifierLabel}+P)`,
            `Add customer (${shortcutModifierLabel}+C)`,
            `Save bill (${shortcutModifierLabel}+S)`,
            `Apply discount (${shortcutModifierLabel}+D)`,
            `Focus scan (${shortcutModifierLabel}+Q)`,
            `Remove item (${shortcutModifierLabel}+Delete)`,
            "Help (?)",
          ].map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-gray-200 bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {hint}
            </span>
          ))}
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-8">
          <div className="grid gap-6">
            <div
              className={
                shortcutHighlight === "form"
                  ? "rounded-2xl shadow-[0_0_0_4px_rgba(99,102,241,0.14)]"
                  : undefined
              }
            >
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
            </div>
            <InvoiceTable
              items={items}
              errors={itemErrors}
              quickEntryProduct={quickEntryProduct}
              quickEntryRef={quickEntryRef}
              autoFocusProductSearch={autoFocusProductSearch}
              selectedItemIndex={selectedItemIndex}
              shortcutMetaLabel={shortcutModifierLabel}
              entryHighlighted={shortcutHighlight === "entry"}
              itemsHighlighted={shortcutHighlight === "items"}
              onQuickEntrySelect={setQuickEntryProduct}
              onQuickEntrySubmit={handleQuickEntrySubmit}
              onSelectItem={setSelectedItemIndex}
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
            <div
              className={
                shortcutHighlight === "actions"
                  ? "rounded-2xl shadow-[0_0_0_4px_rgba(99,102,241,0.14)]"
                  : undefined
              }
            >
              <InvoiceActions
                onPrint={handlePrint}
                onDownloadPdf={handleDownloadPdf}
                onSendEmail={handleSendInvoiceEmail}
                isSendingEmail={sendInvoiceEmailMutation.isPending}
                canSendEmail={Boolean(
                  lastCreatedInvoiceId && lastCreatedCustomerEmail,
                )}
              />
            </div>
          </aside>
        </section>

        <Modal
          open={shortcutHelpOpen}
          onOpenChange={setShortcutHelpOpen}
          title="Keyboard shortcuts"
          description="Billing stays keyboard-first here. Use the scan lane for barcode input and these shortcuts for the rest."
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            {[
              [`${shortcutModifierLabel}+B`, "Start a new bill and refocus the scan lane"],
              [`${shortcutModifierLabel}+P`, "Open quick add product"],
              [`${shortcutModifierLabel}+C`, "Open quick add customer"],
              [`${shortcutModifierLabel}+S`, "Save and complete the current bill"],
              [`${shortcutModifierLabel}+D`, "Jump to the discount field"],
              [`${shortcutModifierLabel}+Q`, "Focus the product search / barcode input"],
              [`${shortcutModifierLabel}+Delete`, "Remove the currently selected line item"],
              ["Enter", "Add the scanned or searched product to the bill"],
              ["?", "Open this shortcut panel"],
            ].map(([shortcut, description]) => (
              <div
                key={shortcut}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3"
              >
                <span className="rounded-full border border-border/80 bg-card/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                  {shortcut}
                </span>
                <span className="text-right">{description}</span>
              </div>
            ))}
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100">
              Note: on this billing screen, {shortcutModifierLabel}+P and{" "}
              {shortcutModifierLabel}+S override the browser print/save defaults
              so the billing flow stays uninterrupted.
            </p>
          </div>
        </Modal>

        <Modal
          open={quickAddProductOpen}
          onOpenChange={setQuickAddProductOpen}
          title="Quick add product"
          description="Create a missing product and drop it straight into the bill."
        >
          <form className="grid gap-4" onSubmit={handleQuickCreateProduct}>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-name">Name</Label>
              <Input
                ref={quickProductNameRef}
                id="quick-product-name"
                value={quickProductForm.name}
                onChange={(event) =>
                  setQuickProductForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Fresh milk 500ml"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-price">Price</Label>
              <Input
                id="quick-product-price"
                type="number"
                min="0"
                step="0.01"
                value={quickProductForm.price}
                onChange={(event) =>
                  setQuickProductForm((currentForm) => ({
                    ...currentForm,
                    price: event.target.value,
                  }))
                }
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-barcode">Barcode</Label>
              <Input
                id="quick-product-barcode"
                value={quickProductForm.barcode}
                onChange={(event) =>
                  setQuickProductForm((currentForm) => ({
                    ...currentForm,
                    barcode: event.target.value,
                  }))
                }
                placeholder="Optional barcode"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddProductOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? "Saving..." : "Save product"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={quickAddCustomerOpen}
          onOpenChange={setQuickAddCustomerOpen}
          title="Quick add customer"
          description="Create a customer and attach them to the current bill."
        >
          <form className="grid gap-4" onSubmit={handleQuickCreateCustomer}>
            <div className="grid gap-2">
              <Label htmlFor="quick-customer-name">Name</Label>
              <Input
                ref={quickCustomerNameRef}
                id="quick-customer-name"
                value={quickCustomerForm.name}
                onChange={(event) =>
                  setQuickCustomerForm((currentForm) => ({
                    ...currentForm,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Ravi Kumar"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-customer-phone">Phone</Label>
              <Input
                id="quick-customer-phone"
                value={quickCustomerForm.phone}
                onChange={(event) =>
                  setQuickCustomerForm((currentForm) => ({
                    ...currentForm,
                    phone: event.target.value,
                  }))
                }
                placeholder="Optional phone number"
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddCustomerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? "Saving..." : "Save customer"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceClient;
