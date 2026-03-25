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
import { fetchBusinessProfile, sendInvoiceEmail } from "@/lib/apiClient";
import {
  buildSmartSuggestions,
  rankRecentProducts,
  updateRecentProductUsage,
  type RecentProductUsage,
} from "@/lib/invoiceSuggestions";
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
  useInvoicesQuery,
  useProductsQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import type { Customer, Product } from "@/lib/apiClient";
import { captureAnalyticsEvent } from "@/lib/observability/client";

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

const RECENT_PRODUCT_USAGE_STORAGE_KEY = "invoice-smart-recent-products";

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
  const { data: products = [] } = useProductsQuery({ limit: 1000 });
  const { data: invoices = [] } = useInvoicesQuery();
  const { data: warehouses } = useWarehousesQuery();
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: ({
      invoiceId,
      email,
    }: {
      invoiceId: number;
      email: string;
    }) => sendInvoiceEmail(invoiceId, { email }),
  });
  const createInvoice = useCreateInvoiceMutation();
  const createProduct = useCreateProductMutation();
  const createCustomer = useCreateCustomerMutation();
  const { downloadPdf } = useInvoicePdf();
  const quickEntryRef = useRef<AsyncProductSelectHandle | null>(null);
  const quickProductNameRef = useRef<HTMLInputElement | null>(null);
  const quickCustomerNameRef = useRef<HTMLInputElement | null>(null);
  const shortcutHighlightTimerRef = useRef<number | null>(null);
  const recentCartItemTimerRef = useRef<number | null>(null);
  const [lastCreatedInvoiceId, setLastCreatedInvoiceId] = useState<
    number | null
  >(null);
  const [lastCreatedInvoiceNumber, setLastCreatedInvoiceNumber] = useState<
    string | null
  >(null);
  const [lastCreatedInvoiceTotal, setLastCreatedInvoiceTotal] = useState<
    number | null
  >(null);
  const [lastCreatedInvoiceDate, setLastCreatedInvoiceDate] = useState<
    string | null
  >(null);
  const [lastCreatedCustomerEmail, setLastCreatedCustomerEmail] = useState<
    string | null
  >(null);
  const [invoiceEmailOpen, setInvoiceEmailOpen] = useState(false);
  const [invoiceEmailRecipient, setInvoiceEmailRecipient] = useState("");
  const [invoiceEmailError, setInvoiceEmailError] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState<InvoiceFormState>(createEmptyInvoiceForm);
  const [taxMode, setTaxMode] = useState<TaxMode>("CGST_SGST");
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [quickEntryProduct, setQuickEntryProduct] = useState<Product | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [recentCartProductId, setRecentCartProductId] = useState<string | null>(null);
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
  const [recentProductUsage, setRecentProductUsage] = useState<RecentProductUsage[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(RECENT_PRODUCT_USAGE_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw) as RecentProductUsage[];
      if (!Array.isArray(parsed)) return [];

      return parsed.filter(
        (entry): entry is RecentProductUsage =>
          typeof entry?.productId === "string" &&
          typeof entry?.count === "number" &&
          typeof entry?.lastAddedAt === "string",
      );
    } catch {
      window.localStorage.removeItem(RECENT_PRODUCT_USAGE_STORAGE_KEY);
      return [];
    }
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

  const parseServerErrors = useCallback((error: unknown, fallback: string) => {
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
  }, []);

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
      if (recentCartItemTimerRef.current) {
        window.clearTimeout(recentCartItemTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      RECENT_PRODUCT_USAGE_STORAGE_KEY,
      JSON.stringify(recentProductUsage),
    );
  }, [recentProductUsage]);

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

  const resolvedSelectedItemIndex =
    items.length === 0
      ? null
      : selectedItemIndex === null
        ? 0
        : Math.min(selectedItemIndex, items.length - 1);

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

  const currentCartProductIds = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => item.product_id).filter(Boolean)),
      ),
    [items],
  );

  const suggestedProducts = useMemo(
    () =>
      buildSmartSuggestions({
        products,
        invoices,
        currentCartProductIds,
        usage: recentProductUsage,
        limit: 6,
      }),
    [currentCartProductIds, invoices, products, recentProductUsage],
  );

  const quickAccessProducts = useMemo(
    () =>
      rankRecentProducts({
        products,
        usage: recentProductUsage,
        excludeProductIds: new Set(currentCartProductIds),
        limit: 8,
      }),
    [currentCartProductIds, products, recentProductUsage],
  );

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
      paymentSummary: {
        statusLabel: t("invoicePreview.pending"),
        statusTone: "pending",
        statusNote: t("invoiceDetail.awaitingPayment"),
        paidAmount: 0,
        remainingAmount: totals.total,
        history: [],
      },
      notes: form.notes || "",
      paymentInfo: t("invoiceDetail.paymentInfo"),
      closingNote: t("invoiceDetail.closingNote"),
      signatureLabel: t("invoiceDetail.signatureLabel"),
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
      setRecentCartProductId(String(product.id));
      setRecentProductUsage((currentUsage) =>
        updateRecentProductUsage(currentUsage, String(product.id)),
      );
      if (recentCartItemTimerRef.current) {
        window.clearTimeout(recentCartItemTimerRef.current);
      }
      recentCartItemTimerRef.current = window.setTimeout(() => {
        setRecentCartProductId(null);
      }, 1800);
      quickEntryRef.current?.clear();
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
      flashShortcutSection("items");
      toast.success(
        options?.toastMessage ??
          (incrementedQuantity
            ? t("invoiceComposer.quantityIncreased", { name: product.name })
            : t("invoiceComposer.itemAdded", { name: product.name })),
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
      setRecentCartProductId(null);
      quickEntryRef.current?.clear();
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      clearDraft();
      flashShortcutSection("entry");

      if (options?.announce) {
        toast.success(t("invoice.createButton"));
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

  const removeItem = useCallback(
    (index: number, options?: { announce?: boolean }) => {
      let removedLabel = t("invoiceComposer.itemFallback");
      let nextSelectedIndex: number | null = null;
      let removedItem: InvoiceItemForm | null = null;

      setItems((prev) => {
        if (index < 0 || index >= prev.length) return prev;

        removedItem = prev[index] ?? null;
        removedLabel = prev[index]?.name || removedLabel;
        const nextItems = prev.filter((_, idx) => idx !== index);

        if (nextItems.length === 0) {
          nextSelectedIndex = null;
          return nextItems;
        }

        nextSelectedIndex =
          resolvedSelectedItemIndex === null
            ? Math.min(index, nextItems.length - 1)
            : resolvedSelectedItemIndex > index
              ? resolvedSelectedItemIndex - 1
              : resolvedSelectedItemIndex === index
                ? Math.min(index, nextItems.length - 1)
                : resolvedSelectedItemIndex;

        return nextItems;
      });

      setSelectedItemIndex(nextSelectedIndex);
      setItemErrors([]);
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
      flashShortcutSection("items");

      if (options?.announce !== false) {
        toast.success(t("invoiceComposer.itemRemoved", { name: removedLabel }), {
          action:
            removedItem !== null
              ? {
                  label: t("invoiceComposer.undo"),
                  onClick: () => {
                    const itemToRestore = removedItem;
                    if (!itemToRestore) return;
                    setItems((currentItems) => {
                      const nextItems = [...currentItems];
                      nextItems.splice(index, 0, itemToRestore);
                      return nextItems;
                    });
                    setSelectedItemIndex(index);
                    setRecentCartProductId(itemToRestore.product_id || null);
                    markDirty();
                    flashShortcutSection("items");
                    focusProductSearch(false);
                  },
                }
              : undefined,
        });
      }

      focusProductSearch(false);
    },
    [flashShortcutSection, focusProductSearch, markDirty, resolvedSelectedItemIndex, t],
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
        toast.error(t("invoiceComposer.selectOrScanProduct"));
        focusProductSearch();
        return;
      }

      addProductToBill(product);
    },
    [addProductToBill, flashShortcutSection, focusProductSearch],
  );

  const handleSuggestedProductAdd = useCallback(
    (product: Product, _source: "suggested" | "recent") => {
      addProductToBill(product, {
        toastMessage: t("invoiceComposer.itemAdded", { name: product.name }),
      });
    },
    [addProductToBill, t],
  );

  const handleQuickCreateProduct = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = quickProductForm.name.trim();
      const trimmedPrice = quickProductForm.price.trim();
      const trimmedBarcode = quickProductForm.barcode.trim();

      if (!trimmedName) {
        toast.error(t("invoiceComposer.enterProductName"));
        quickProductNameRef.current?.focus();
        return;
      }

      if (!trimmedPrice || Number.isNaN(Number(trimmedPrice)) || Number(trimmedPrice) <= 0) {
        toast.error(t("invoiceComposer.enterValidSellingPrice"));
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
        captureAnalyticsEvent("invoice_quick_product_created", {
          productId: createdProduct.id,
        });
        addProductToBill(createdProduct, {
          toastMessage: `${createdProduct.name} ${t("invoiceComposer.addToCart").toLowerCase()}`,
        });
      } catch (error) {
        toast.error(
          parseServerErrors(error, t("inventory.saveError")),
        );
      }
    },
    [addProductToBill, createProduct, parseServerErrors, quickProductForm, t],
  );

  const handleQuickCreateCustomer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = quickCustomerForm.name.trim();
      const trimmedPhone = quickCustomerForm.phone.trim();

      if (trimmedName.length < 2) {
        toast.error(t("invoiceComposer.customerNameMin"));
        quickCustomerNameRef.current?.focus();
        return;
      }

      if (trimmedPhone && trimmedPhone.length < 6) {
        toast.error(t("invoiceComposer.customerPhoneMin"));
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
        captureAnalyticsEvent("invoice_quick_customer_created", {
          customerId: createdCustomer.id,
        });
        flashShortcutSection("form");
        toast.success(
          t("invoiceComposer.billCustomerAdded", { name: createdCustomer.name }),
        );
        focusProductSearch();
      } catch (error) {
        toast.error(
          parseServerErrors(error, t("customers.saveError")),
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
    if (validation.summary.length > 0) {
      if (!form.customer_id || (form.sync_sales && !form.warehouse_id)) {
        flashShortcutSection("form");
      } else if (items.length === 0) {
        flashShortcutSection("entry");
        focusProductSearch();
      } else {
        flashShortcutSection("items");
      }

      toast.error(validation.summary[0] ?? t("invoiceComposer.missingDetails"));
      return;
    }

    try {
      const selectedCustomer =
        customers?.find((customer) => customer.id === Number(form.customer_id)) ??
        null;

      const createdInvoice = await createInvoice.mutateAsync({
        customer_id: Number(form.customer_id),
        date: form.date || undefined,
        due_date: form.due_date || undefined,
        discount: Number(form.discount) || undefined,
        discount_type: form.discount_type,
        status: "SENT",
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
      setLastCreatedInvoiceTotal(Number(createdInvoice.total ?? totals.total));
      setLastCreatedInvoiceDate(
        createdInvoice.date
          ? new Date(createdInvoice.date).toISOString().slice(0, 10)
          : form.date || new Date().toISOString().slice(0, 10),
      );
      setLastCreatedCustomerEmail(selectedCustomer?.email ?? null);
      setInvoiceEmailRecipient(selectedCustomer?.email?.trim() ?? "");
      setInvoiceEmailError(null);
      captureAnalyticsEvent("invoice_created", {
        invoiceId: createdInvoice.id,
        invoiceNumber: createdInvoice.invoice_number,
        itemCount: items.length,
        total: Number(createdInvoice.total ?? totals.total),
        warehouseId: form.warehouse_id ? Number(form.warehouse_id) : null,
      });
      toast.success(
        t("invoice.createSuccess", { invoiceNumber: createdInvoice.invoice_number }),
      );
      resetInvoiceComposer();
    } catch (error) {
      setServerError(parseServerErrors(error, t("invoice.createError")));
    }
  }, [
    createInvoice,
    customers,
    form,
    items,
    parseServerErrors,
    flashShortcutSection,
    resetInvoiceComposer,
    focusProductSearch,
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

  const openInvoiceEmailModal = useCallback(() => {
    if (!lastCreatedInvoiceId) {
      toast.error(t("invoice.sendEmailMissingInvoice"));
      return;
    }

    setInvoiceEmailRecipient(lastCreatedCustomerEmail?.trim() ?? "");
    setInvoiceEmailError(null);
    setInvoiceEmailOpen(true);
    captureAnalyticsEvent("invoice_email_modal_opened", {
      invoiceId: lastCreatedInvoiceId,
    });
  }, [lastCreatedCustomerEmail, lastCreatedInvoiceId, t]);

  const handleSendInvoiceEmail = useCallback(async () => {
    if (!lastCreatedInvoiceId) {
      toast.error(t("invoice.sendEmailMissingInvoice"));
      return;
    }

    const recipient = invoiceEmailRecipient.trim();
    if (!recipient) {
      setInvoiceEmailError(t("invoiceDetail.messages.enterCustomerEmail"));
      return;
    }

    if (!/^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(recipient)) {
      setInvoiceEmailError(t("invoiceDetail.messages.enterValidEmail"));
      return;
    }

    try {
      setInvoiceEmailError(null);
      const response = await sendInvoiceEmailMutation.mutateAsync({
        invoiceId: lastCreatedInvoiceId,
        email: recipient,
      });
      setLastCreatedCustomerEmail(response.email ?? recipient);
      setInvoiceEmailOpen(false);
      captureAnalyticsEvent("invoice_email_sent", {
        invoiceId: lastCreatedInvoiceId,
        invoiceNumber: lastCreatedInvoiceNumber,
      });
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
    invoiceEmailRecipient,
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
          toast.success(t("invoiceComposer.quickProductOpened"));
          break;
        case "c":
          event.preventDefault();
          setQuickAddCustomerOpen(true);
          flashShortcutSection("actions");
          toast.success(t("invoiceComposer.quickCustomerOpened"));
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
          toast.success(t("invoiceComposer.discountFocused"));
          break;
        }
        case "q":
          event.preventDefault();
          flashShortcutSection("entry");
          focusProductSearch();
          toast.success(t("invoiceComposer.productSearchFocused"));
          break;
        default:
          if (key === "delete" || (isMacShortcutPlatform && key === "backspace")) {
            event.preventDefault();
            if (resolvedSelectedItemIndex === null || items.length === 0) {
              toast.error(t("invoiceComposer.selectLineItemFirst"));
              flashShortcutSection("items");
              return;
            }
            removeItem(resolvedSelectedItemIndex);
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
    resolvedSelectedItemIndex,
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
        {t("invoiceComposer.newBill", { key: shortcutModifierLabel })}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl px-4"
        onClick={() => setShortcutHelpOpen(true)}
      >
        {t("invoiceComposer.shortcuts")}
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
      <div className="mx-auto w-full max-w-[1500px] font-[var(--font-sora),var(--font-geist-sans)]">
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[1.4rem] bg-white/85 px-4 py-3 text-sm text-slate-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 dark:bg-slate-900/75 dark:text-slate-300 dark:ring-slate-700/70">
          <span className="font-semibold text-slate-950 dark:text-slate-100">
            {t("invoiceComposer.keyboardFirst")}
          </span>
          <span>{t("invoiceComposer.bannerEnter")}</span>
          <span>{t("invoiceComposer.bannerRefocus", { key: shortcutModifierLabel })}</span>
          <span>{t("invoiceComposer.bannerFinish", { key: shortcutModifierLabel })}</span>
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.72fr)_minmax(340px,0.62fr)] xl:items-start xl:gap-8">
          <div className="min-w-0">
            <InvoiceTable
              items={items}
              errors={itemErrors}
              quickEntryProduct={quickEntryProduct}
              quickEntryRef={quickEntryRef}
              autoFocusProductSearch={autoFocusProductSearch}
              selectedItemIndex={resolvedSelectedItemIndex}
              recentProductId={recentCartProductId}
              suggestedProducts={suggestedProducts}
              recentProducts={quickAccessProducts}
              shortcutMetaLabel={shortcutModifierLabel}
              entryHighlighted={shortcutHighlight === "entry"}
              itemsHighlighted={shortcutHighlight === "items"}
              onFocusEntry={() => focusProductSearch()}
              onQuickEntrySelect={setQuickEntryProduct}
              onQuickEntrySubmit={handleQuickEntrySubmit}
              onSelectItem={setSelectedItemIndex}
              onItemChange={handleItemChange}
              onRemoveItem={removeItem}
              onAddSuggestedProduct={handleSuggestedProductAdd}
            />
          </div>

          <aside className="xl:sticky xl:top-24">
            <InvoiceTotals
              totals={totals}
              taxMode={taxMode}
              discountValue={form.discount}
              discountType={form.discount_type}
              className="xl:max-w-[390px]"
              action={
                <div className="mt-6 grid gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="h-15 rounded-[1.2rem] text-base font-semibold shadow-[0_24px_48px_-28px_rgba(37,99,235,0.45)]"
                    disabled={createInvoice.isPending || items.length === 0}
                    onClick={() => void submitInvoice()}
                  >
                    {createInvoice.isPending
                      ? t("invoiceComposer.generating")
                      : t("invoiceComposer.checkout")}
                  </Button>
                  <div className="flex items-center justify-between rounded-[1.15rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-100 dark:ring-emerald-900/40">
                    <span>
                      {items.length === 0
                        ? t("invoiceComposer.addItemsToContinue")
                        : t("invoiceComposer.readyToCheckout")}
                    </span>
                    <span className="font-semibold">
                      {t("invoiceComposer.lineItemsCount", { count: items.length })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {items.length === 0
                      ? t("invoiceComposer.scanToCheckout")
                      : t("invoiceComposer.keyboardCheckout", {
                          key: shortcutModifierLabel,
                        })}
                  </p>
                </div>
              }
            />
          </aside>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.64fr)]">
          <div
            className={
              shortcutHighlight === "form"
                ? "rounded-[2rem] shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
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
              hideSubmit
            />
          </div>

          <aside className="grid gap-4">
            <div className="no-print rounded-[1.7rem] bg-white/90 p-6 text-sm text-slate-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-700/70">
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {t("invoice.gstNoteTitle")}
              </p>
              <p className="mt-2 leading-6">{t("invoice.gstNoteBody")}</p>
            </div>
            <div
              className={
                shortcutHighlight === "actions"
                  ? "rounded-[2rem] shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                  : undefined
              }
            >
              <InvoiceActions
                onPrint={handlePrint}
                onDownloadPdf={handleDownloadPdf}
                onSendEmail={openInvoiceEmailModal}
                isSendingEmail={sendInvoiceEmailMutation.isPending}
              />
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(320px,0.72fr)_minmax(0,1.28fr)]">
          <div className="grid gap-6">
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
                className="rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 print:border-0 print:bg-transparent print:p-0 print:shadow-none"
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
        </section>

        <Modal
          open={invoiceEmailOpen}
          onOpenChange={(open) => {
            setInvoiceEmailOpen(open);
            if (!open) {
              setInvoiceEmailError(null);
            }
          }}
          title={t("invoiceComposer.emailModalTitle")}
          description={t("invoiceComposer.emailModalDescription")}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>{t("invoiceDetail.emailDebugInvoice", { value: lastCreatedInvoiceNumber ?? "-" })}</p>
              <p className="mt-1">
                {t("invoiceDetail.emailDebugAmount", {
                  value: `INR ${(lastCreatedInvoiceTotal ?? 0).toFixed(2)}`,
                })}
              </p>
              <p className="mt-1">
                {t("invoiceDetail.emailDebugDate", {
                  value: lastCreatedInvoiceDate
                    ? formatDate(lastCreatedInvoiceDate)
                    : invoiceDate,
                })}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-email-recipient">{t("invoiceComposer.emailLabel")}</Label>
              <Input
                id="invoice-email-recipient"
                type="email"
                value={invoiceEmailRecipient}
                onChange={(event) => {
                  setInvoiceEmailRecipient(event.target.value);
                  setInvoiceEmailError(null);
                }}
                placeholder={t("invoiceComposer.emailPlaceholder")}
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
                disabled={sendInvoiceEmailMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSendInvoiceEmail()}
                disabled={sendInvoiceEmailMutation.isPending}
              >
                {sendInvoiceEmailMutation.isPending
                  ? t("invoiceActions.sendingEmail")
                  : t("invoiceComposer.sendEmail")}
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          open={shortcutHelpOpen}
          onOpenChange={setShortcutHelpOpen}
          title={t("invoiceComposer.shortcutTitle")}
          description={t("invoiceComposer.shortcutDescription")}
        >
          <div className="grid gap-3 text-sm text-muted-foreground">
            {[
              [`${shortcutModifierLabel}+B`, t("invoiceComposer.shortcutNewBill")],
              [`${shortcutModifierLabel}+P`, t("invoiceComposer.shortcutQuickProduct")],
              [`${shortcutModifierLabel}+C`, t("invoiceComposer.shortcutQuickCustomer")],
              [`${shortcutModifierLabel}+S`, t("invoiceComposer.shortcutSaveBill")],
              [`${shortcutModifierLabel}+D`, t("invoiceComposer.shortcutDiscount")],
              [`${shortcutModifierLabel}+Q`, t("invoiceComposer.shortcutFocusSearch")],
              [`${shortcutModifierLabel}+Delete`, t("invoiceComposer.shortcutRemoveItem")],
              ["Enter", t("invoiceComposer.shortcutEnter")],
              ["?", t("invoiceComposer.shortcutHelp")],
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
              {t("invoiceComposer.shortcutNote", {
                saveKey: `${shortcutModifierLabel}+S`,
                productKey: `${shortcutModifierLabel}+P`,
              })}
            </p>
          </div>
        </Modal>

        <Modal
          open={quickAddProductOpen}
          onOpenChange={setQuickAddProductOpen}
          title={t("invoiceComposer.quickProductTitle")}
          description={t("invoiceComposer.quickProductDescription")}
        >
          <form className="grid gap-4" onSubmit={handleQuickCreateProduct}>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-name">{t("invoiceComposer.name")}</Label>
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
                placeholder={t("invoiceComposer.namePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-price">{t("invoiceComposer.price")}</Label>
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
                placeholder={t("invoiceComposer.pricePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-product-barcode">{t("invoiceComposer.barcode")}</Label>
              <Input
                id="quick-product-barcode"
                value={quickProductForm.barcode}
                onChange={(event) =>
                  setQuickProductForm((currentForm) => ({
                    ...currentForm,
                    barcode: event.target.value,
                  }))
                }
                placeholder={t("invoiceComposer.barcodePlaceholder")}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddProductOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? t("common.processing") : t("invoiceComposer.saveProduct")}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal
          open={quickAddCustomerOpen}
          onOpenChange={setQuickAddCustomerOpen}
          title={t("invoiceComposer.quickCustomerTitle")}
          description={t("invoiceComposer.quickCustomerDescription")}
        >
          <form className="grid gap-4" onSubmit={handleQuickCreateCustomer}>
            <div className="grid gap-2">
              <Label htmlFor="quick-customer-name">{t("invoiceComposer.name")}</Label>
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
                placeholder={t("invoiceComposer.customerNamePlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quick-customer-phone">{t("invoiceComposer.phone")}</Label>
              <Input
                id="quick-customer-phone"
                value={quickCustomerForm.phone}
                onChange={(event) =>
                  setQuickCustomerForm((currentForm) => ({
                    ...currentForm,
                    phone: event.target.value,
                  }))
                }
                placeholder={t("invoiceComposer.customerPhonePlaceholder")}
              />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddCustomerOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending ? t("common.processing") : t("invoiceComposer.saveCustomer")}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </DashboardLayout>
  );
};

export default InvoiceClient;
