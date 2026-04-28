"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  PackagePlus,
  ScanLine,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import InvoiceCompactMetaPanel from "@/components/invoice/InvoiceCompactMetaPanel";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import InvoiceForm from "@/components/invoice/InvoiceForm";
import InvoiceCheckoutAction from "@/components/invoice/InvoiceCheckoutAction";
import InvoiceTable from "@/components/invoice/InvoiceTable";
import InvoiceTotals from "@/components/invoice/InvoiceTotals";
import InvoiceDraftPanel from "@/components/invoice/InvoiceDraftPanel";
import InvoiceDraftList from "@/components/invoice/InvoiceDraftList";
import InvoiceActions from "@/components/invoice/InvoiceActions";
import InvoiceWorkspaceV2 from "@/components/invoice/InvoiceWorkspaceV2";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import type { AsyncProductSelectHandle } from "@/components/products/AsyncProductSelect";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import FirstTimeHint from "@/components/ui/FirstTimeHint";
import Modal from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchBusinessProfile,
  fetchUserSettingsPreferences,
  sendInvoiceEmail,
} from "@/lib/apiClient";
import {
  buildInvoiceRenderPayload,
  type InvoiceRenderPayload,
} from "@/lib/invoiceRenderPayload";
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
import { useActiveInvoiceTemplate } from "@/hooks/invoice/useActiveInvoiceTemplate";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import {
  formatBusinessAddressFromRecord,
  formatCustomerAddressFromRecord,
} from "@/lib/indianAddress";
import { getStateFromGstin } from "@/lib/gstin";
import { formatPaymentMethodLabel } from "@/lib/invoicePayments";
import {
  buildDiscountLabel,
  getAppliedDiscountAmount,
  getDiscountValidationMessage,
} from "@/lib/invoiceDiscount";
import { resolveBackendAssetUrl } from "@/lib/backendAssetUrl";
import { runInvoiceCheckoutPipeline } from "@/lib/invoiceCheckout";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  InvoiceDraft,
  InvoiceFormState,
  InvoiceItemError,
  InvoiceItemForm,
  InvoicePaymentStatus,
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
  useInvoiceBootstrapQuery,
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

const sanitizeItemFieldValue = (key: keyof InvoiceItemForm, value: string) => {
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
  return String(Math.max(0, numericValue));
};

const sanitizeDiscountAmount = (value: string) => {
  if (value === "") return value;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return String(Math.max(0, numericValue));
};

const sanitizePaidAmount = (value: string) => {
  if (value === "") return value; 
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return value;
  return String(Math.max(0, numericValue));
};

const mapPaymentStatusToInvoiceStatus = (status: InvoicePaymentStatus) => {
  if (status === "PAID") return "PAID";
  if (status === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "SENT";
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
  fontFamily: "var(--font-geist-sans)",
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
const LAST_DISCOUNT_TYPE_STORAGE_KEY = "invoice-last-discount-type";
const LAST_WAREHOUSE_STORAGE_KEY = "invoice-last-warehouse-id";
const SHOW_LEGACY_INVOICE_COMPOSER_UI = false;

const getTodayDateValue = () => {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
};

const normalizeWarehousePreference = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  return null;
};

const getStoredWarehousePreference = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return normalizeWarehousePreference(
    window.localStorage.getItem(LAST_WAREHOUSE_STORAGE_KEY),
  );
};

const clearStoredWarehousePreference = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LAST_WAREHOUSE_STORAGE_KEY);
};

const getPreferredWarehouseFromSettings = (
  preferences: unknown,
): string | null => {
  if (!preferences || typeof preferences !== "object") {
    return null;
  }

  const record = preferences as Record<string, unknown>;
  const inventory =
    record.inventory && typeof record.inventory === "object"
      ? (record.inventory as Record<string, unknown>)
      : null;
  const appPreferences =
    record.appPreferences && typeof record.appPreferences === "object"
      ? (record.appPreferences as Record<string, unknown>)
      : null;

  return (
    normalizeWarehousePreference(inventory?.defaultWarehouseId) ??
    normalizeWarehousePreference(inventory?.defaultWarehouse) ??
    normalizeWarehousePreference(appPreferences?.defaultWarehouseId) ??
    normalizeWarehousePreference(appPreferences?.defaultWarehouse)
  );
};

const resolveSmartWarehouseId = (
  availableWarehouses: Array<{ id: number }>,
  preferences: { defaultWarehouseId?: string | null; lastWarehouseId?: string | null },
) => {
  const warehouseIds = new Set(
    availableWarehouses.map((warehouse) => String(warehouse.id)),
  );
  const defaultWarehouseId =
    preferences.defaultWarehouseId &&
    warehouseIds.has(preferences.defaultWarehouseId)
      ? preferences.defaultWarehouseId
      : null;

  if (defaultWarehouseId) {
    return defaultWarehouseId;
  }

  const lastWarehouseId =
    preferences.lastWarehouseId && warehouseIds.has(preferences.lastWarehouseId)
      ? preferences.lastWarehouseId
      : null;

  if (lastWarehouseId) {
    return lastWarehouseId;
  }

  if (availableWarehouses.length === 1) {
    return String(availableWarehouses[0].id);
  }

  return availableWarehouses[0] ? String(availableWarehouses[0].id) : "";
};

const isValidEmailAddress = (value: string) =>
  /^[\w-.]+@[\w-]+\.[a-zA-Z]{2,}$/.test(value.trim());

const getStoredDiscountType = (): InvoiceFormState["discount_type"] => {
  if (typeof window === "undefined") {
    return "PERCENTAGE";
  }

  const storedDiscountType = window.localStorage.getItem(
    LAST_DISCOUNT_TYPE_STORAGE_KEY,
  );

  return storedDiscountType === "FIXED" || storedDiscountType === "PERCENTAGE"
    ? storedDiscountType
    : "PERCENTAGE";
};

const createEmptyInvoiceForm = (
  customerId = "",
  discountType = getStoredDiscountType(),
  defaults?: Partial<
    Pick<InvoiceFormState, "date" | "due_date" | "payment_status" | "warehouse_id">
  >,
): InvoiceFormState => ({
  customer_id: customerId,
  date: defaults?.date ?? getTodayDateValue(),
  due_date: defaults?.due_date ?? "",
  discount: "0",
  discount_type: discountType,
  payment_status: defaults?.payment_status ?? "UNPAID",
  amount_paid: "",
  payment_method: "",
  payment_date: "",
  notes: "",
  sync_sales: true,
  warehouse_id: defaults?.warehouse_id ?? "",
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
  const { formatCurrency, formatDate, language, locale, t } = useI18n();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const {
    data: customers = [],
    isLoading: customersLoading,
    isError: customersError,
    refetch: refetchCustomers,
  } = useCustomersQuery();
  const {
    data: products = [],
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
  } = useProductsQuery({ limit: 1000 });
  const { data: invoices = [], refetch: refetchInvoices } = useInvoicesQuery();
  const { data: invoiceBootstrap } = useInvoiceBootstrapQuery();
  const {
    data: warehouses = [],
    isLoading: warehousesLoading,
    isError: warehousesError,
    refetch: refetchWarehouses,
  } = useWarehousesQuery();
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const { data: userSettingsPreferences } = useQuery({
    queryKey: ["settings", "preferences"],
    queryFn: fetchUserSettingsPreferences,
  });
  const sendInvoiceEmailMutation = useMutation({
    mutationFn: ({
      invoiceId,
      email,
      previewPayload,
    }: {
      invoiceId: number;
      email: string;
      previewPayload?: InvoiceRenderPayload | null;
    }) =>
      sendInvoiceEmail(invoiceId, {
        email,
        preview_payload: previewPayload ?? undefined,
      }),
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
  const [lastCreatedInvoiceRenderPayload, setLastCreatedInvoiceRenderPayload] =
    useState<InvoiceRenderPayload | null>(null);
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
  const [checkoutAutomationPending, setCheckoutAutomationPending] =
    useState(false);
  const initialCustomerId =
    searchParams.get("customer") ?? searchParams.get("customerId") ?? "";
  const [form, setForm] = useState<InvoiceFormState>(() =>
    createEmptyInvoiceForm(initialCustomerId, getStoredDiscountType(), {
      warehouse_id: getStoredWarehousePreference() ?? "",
    }),
  );
  const [taxMode, setTaxMode] = useState<TaxMode>("CGST_SGST");
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [quickEntryProduct, setQuickEntryProduct] = useState<Product | null>(
    null,
  );
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null,
  );
  const [recentCartProductId, setRecentCartProductId] = useState<string | null>(
    null,
  );
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
  const [quickCustomerForm, setQuickCustomerForm] = useState<QuickCustomerForm>(
    {
      name: "",
      phone: "",
    },
  );
  const [recentProductUsage, setRecentProductUsage] = useState<
    RecentProductUsage[]
  >(() => {
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
  const totals = useInvoiceTotals(
    items,
    form.discount,
    form.discount_type,
    taxMode,
  );
  const discountAppliedAmount = useMemo(
    () =>
      getAppliedDiscountAmount({
        subtotal: totals.subtotal,
        discountValue: form.discount,
        discountType: form.discount_type,
      }),
    [form.discount, form.discount_type, totals.subtotal],
  );
  const discountValidationMessage = useMemo(
    () =>
      getDiscountValidationMessage({
        subtotal: totals.subtotal,
        discountValue: form.discount,
        discountType: form.discount_type,
      }),
    [form.discount, form.discount_type, totals.subtotal],
  );
  const discountSummaryLabel = useMemo(
    () =>
      buildDiscountLabel({
        discountType: form.discount_type,
        discountValue: form.discount,
        formatCurrency: (value) =>
        formatCurrency(value, businessProfile?.currency ?? "INR"),
      }),
    [businessProfile?.currency, form.discount, form.discount_type, formatCurrency],
  );
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
  const activeDesignConfig = activeTemplate.designConfig;
  const productLookup = useMemo(
    () =>
      Object.fromEntries(products.map((product) => [product.id, product])) as Record<
        number,
        Product
      >,
    [products],
  );
  const allowNegativeStock =
    userSettingsPreferences?.inventory.allowNegativeStock ?? true;
  const validation = useInvoiceValidation(form, items, totals.total, {
    productLookup,
    allowNegativeStock,
  });
  const invoiceNumberPreview = useMemo(
    () =>
      lastCreatedInvoiceNumber ??
      invoiceBootstrap?.defaults.invoiceNumberPreview ??
      `INV-${new Date().getFullYear()}-AUTO`,
    [invoiceBootstrap?.defaults.invoiceNumberPreview, lastCreatedInvoiceNumber],
  );
  const businessSummary = useMemo(
    () =>
      businessProfile
        ? {
            businessName: businessProfile.business_name,
            taxId: businessProfile.tax_id,
            phone: businessProfile.phone,
            email: businessProfile.email,
          }
        : null,
    [businessProfile],
  );
  const autoFocusProductSearch = searchParams.get("quickAction") === "new-bill";
  const settingsDefaultWarehouseId = useMemo(
    () => getPreferredWarehouseFromSettings(userSettingsPreferences),
    [userSettingsPreferences],
  );
  const warehouseIdSignature = useMemo(
    () => warehouses.map((warehouse) => warehouse.id).join(","),
    [warehouses],
  );
  const resolvedDefaultWarehouseId = useMemo(
    () =>
      resolveSmartWarehouseId(warehouses, {
        defaultWarehouseId: settingsDefaultWarehouseId,
        lastWarehouseId: getStoredWarehousePreference(),
      }),
    [settingsDefaultWarehouseId, warehouses],
  );
  useEffect(() => {
    if (!invoiceBootstrap?.defaults) {
      return;
    }

    setForm((current) => {
      const nextDate = current.date || invoiceBootstrap.defaults.invoiceDate;
      const nextDueDate = current.due_date || invoiceBootstrap.defaults.dueDate;

      if (nextDate === current.date && nextDueDate === current.due_date) {
        return current;
      }

      return {
        ...current,
        date: nextDate,
        due_date: nextDueDate,
      };
    });
  }, [invoiceBootstrap?.defaults]);
  useEffect(() => {
    if (!warehouseIdSignature) {
      return;
    }

    if (!resolvedDefaultWarehouseId) {
      return;
    }

    setForm((current) => {
      if (
        current.warehouse_id &&
        warehouses.some(
          (warehouse) => String(warehouse.id) === current.warehouse_id,
        )
      ) {
        return current;
      }

      if (current.warehouse_id) {
        clearStoredWarehousePreference();
      }

      return {
        ...current,
        warehouse_id: resolvedDefaultWarehouseId,
      };
    });
  }, [form.warehouse_id, resolvedDefaultWarehouseId, warehouseIdSignature]);
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!form.warehouse_id) {
      return;
    }

    window.localStorage.setItem(LAST_WAREHOUSE_STORAGE_KEY, form.warehouse_id);
  }, [form.warehouse_id]);
  const isMacShortcutPlatform = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /Mac|iPhone|iPad/i.test(navigator.platform);
  }, []);
  const shortcutModifierLabel = isMacShortcutPlatform ? "Cmd" : "Ctrl";
  const isBootstrapLoading =
    customersLoading || productsLoading || warehousesLoading;
  const hasBootstrapError = customersError || productsError || warehousesError;
  const noCustomers = !customersLoading && customers.length === 0;
  const noProducts = !productsLoading && products.length === 0;
  const guidedStep = !form.customer_id ? 1 : items.length === 0 ? 2 : 3;
  const guidedFlowCopy =
    language === "hi"
      ? {
          bannerTitle: "पहला बिल आसान तरीके से बनाएं",
          bannerDescription:
            "नीचे दिए गए 3 स्टेप्स पूरे करें। पहले ग्राहक, फिर प्रोडक्ट, फिर बिल की जांच करके बनाएं।",
          steps: [
            {
              title: "ग्राहक चुनें या जोड़ें",
              description:
                "पहले ग्राहक चुनें ताकि बिल सही व्यक्ति के नाम से बने।",
            },
            {
              title: "प्रोडक्ट जोड़ें",
              description: "अब वे प्रोडक्ट जोड़ें जो ग्राहक खरीद रहा है।",
            },
            {
              title: "जांचें और बिल बनाएं",
              description:
                "कुल राशि देखकर बिल बनाएं और चाहें तो PDF या ईमेल भी करें।",
            },
          ],
        }
      : {
          bannerTitle: "Create your first bill in 3 simple steps",
          bannerDescription:
            "Start with the customer, then add products, then review and generate the bill.",
          steps: [
            {
              title: "Select or add a customer",
              description:
                "Choose the customer first so the bill is created for the right person.",
            },
            {
              title: "Add products",
              description: "Add the products your customer is buying.",
            },
            {
              title: "Review and generate the bill",
              description:
                "Check the total, then create the bill and share it if needed.",
            },
          ],
        };
  const helperCopy =
    language === "hi"
      ? {
          noCustomersTitle: "अभी कोई ग्राहक नहीं है",
          noCustomersDescription:
            "पहला बिल बनाने से पहले एक ग्राहक जोड़ें ताकि बिल सही व्यक्ति के नाम पर बने।",
          noCustomersHint:
            "शुरुआत के लिए सिर्फ ग्राहक का नाम काफी है। फोन नंबर बाद में भी जोड़ सकते हैं।",
          addCustomer: "ग्राहक जोड़ें",
          openCustomers: "ग्राहक खोलें",
          missingCustomerQuestion: "ग्राहक नहीं दिख रहा?",
          missingCustomerAnswer:
            "ऊपर Add Customer का इस्तेमाल करें। नया ग्राहक तुरंत इसी बिल में चुन लिया जाएगा।",
          noProductsTitle: "अभी कोई प्रोडक्ट नहीं है",
          noProductsDescription:
            "बिल बनाने से पहले कम से कम एक प्रोडक्ट जोड़ना जरूरी है।",
          noProductsHint:
            "शुरुआत एक प्रोडक्ट से करें। बाद में और प्रोडक्ट जोड़ सकते हैं।",
          addProduct: "प्रोडक्ट जोड़ें",
          openProducts: "प्रोडक्ट खोलें",
          reviewMissing: "आगे बढ़ने के लिए कम से कम एक प्रोडक्ट जोड़ें।",
          reviewReady: "सब तैयार है। अब आख़िरी बिल बनाया जा सकता है।",
          reviewMissingHelp:
            "कृपया बिल बनाने के लिए कम से कम एक प्रोडक्ट जोड़ें।",
        }
      : {
          noCustomersTitle: "No customers yet",
          noCustomersDescription:
            "Add your first customer before making a bill so the bill goes to the right person.",
          noCustomersHint:
            "You only need a customer name to get started. Phone number is optional.",
          addCustomer: "Add Customer",
          openCustomers: "Open Customers",
          missingCustomerQuestion: "Do not see the customer yet?",
          missingCustomerAnswer:
            "Use Add Customer and the new customer will be selected in this bill right away.",
          noProductsTitle: "No products yet",
          noProductsDescription:
            "Add at least one product before creating a bill.",
          noProductsHint:
            "Start with one item you sell most often. You can add more products later.",
          addProduct: "Add Product",
          openProducts: "Open Products",
          reviewMissing: "Add at least one product to continue.",
          reviewReady: "Everything looks ready for the final bill.",
          reviewMissingHelp:
            "Please add at least one product to create a bill.",
          reviewAction: "Review bill",
          advancedHelpTitle: "You can start with the default settings",
          advancedHelpBody:
            "GST mode, PDF, and email are optional. For the first bill, you only need a customer and at least one product.",
        };
  const reviewActionLabel =
    language === "hi" ? "बिल रिव्यू करें" : "Review bill";
  const advancedHelpCopy =
    language === "hi"
      ? {
          title: "डिफॉल्ट सेटिंग के साथ शुरू कर सकते हैं",
          body: "GST mode, PDF, और email optional हैं. पहला बिल बनाने के लिए सिर्फ ग्राहक और प्रोडक्ट काफी है.",
        }
      : {
          title: "You can start with the default settings",
          body: "GST mode, PDF, and email are optional. For the first bill, you only need a customer and at least one product.",
        };

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
  const scrollToCheckout = useCallback(() => {
    document.getElementById("bill-create-button")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, []);

  const handleRetryBootstrapData = useCallback(() => {
    void Promise.all([
      refetchCustomers(),
      refetchProducts(),
      refetchWarehouses(),
      refetchInvoices(),
    ]);
  }, [refetchCustomers, refetchInvoices, refetchProducts, refetchWarehouses]);

  const flashShortcutSection = useCallback(
    (section: ShortcutHighlightSection) => {
      setShortcutHighlight(section);
      if (shortcutHighlightTimerRef.current) {
        window.clearTimeout(shortcutHighlightTimerRef.current);
      }
      shortcutHighlightTimerRef.current = window.setTimeout(() => {
        setShortcutHighlight(null);
      }, 1200);
    },
    [],
  );

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
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      LAST_DISCOUNT_TYPE_STORAGE_KEY,
      form.discount_type,
    );
  }, [form.discount_type]);

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
    () => customers.find((item) => String(item.id) === form.customer_id),
    [customers, form.customer_id],
  );

  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((item) => {
      map.set(String(item.id), item.name);
    });
    return map;
  }, [customers]);

  const currentCartProductIds = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.product_id).filter(Boolean))),
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
    const parsedPaidAmount = Number(form.amount_paid || 0);
    const normalizedPaidAmount = Number.isFinite(parsedPaidAmount)
      ? Math.max(parsedPaidAmount, 0)
      : 0;
    const totalAmount = Math.max(0, totals.total);
    const paidAmount =
      form.payment_status === "PAID"
        ? totalAmount
        : form.payment_status === "PARTIALLY_PAID"
          ? Math.min(normalizedPaidAmount, totalAmount)
          : 0;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const paymentMethodLabel = form.payment_method
      ? formatPaymentMethodLabel(form.payment_method)
      : t("invoicePreview.manualEntry");
    const paymentDateLabel = form.payment_date
      ? formatDate(form.payment_date)
      : formatDate(new Date());

    const paymentStatusLabel =
      form.payment_status === "PAID"
        ? t("invoiceHistory.status.PAID")
        : form.payment_status === "PARTIALLY_PAID"
          ? t("invoiceHistory.status.PARTIALLY_PAID")
          : t("invoicePreview.pending");

    const paymentStatusTone =
      form.payment_status === "PAID"
        ? "paid"
        : form.payment_status === "PARTIALLY_PAID"
          ? "partial"
          : "pending";
    const businessState =
      getStateFromGstin(businessProfile?.tax_id) ||
      businessProfile?.businessAddress?.state ||
      businessProfile?.state ||
      "";
    const customerState =
      getStateFromGstin(customer?.gstin) ||
      customer?.customerAddress?.state ||
      customer?.state ||
      "";
    const placeOfSupply = customerState || businessState || "";

    const paymentStatusNote =
      form.payment_status === "PAID"
        ? `${paymentMethodLabel} • ${paymentDateLabel}`
        : form.payment_status === "PARTIALLY_PAID"
          ? `${paymentMethodLabel} • ${t("invoicePreview.paid")}: ${paidAmount.toFixed(2)}`
          : t("invoiceDetail.awaitingPayment");

    const paymentHistory =
      paidAmount > 0
        ? [
            {
              id: "draft-payment",
              amount: paidAmount,
              paidAt: paymentDateLabel,
              method: paymentMethodLabel,
            },
          ]
        : [];

    return {
      invoiceTitle: taxMode === "NONE" ? "Bill" : "Tax Invoice",
      invoiceNumber: invoiceNumberPreview,
      invoiceDate,
      dueDate,
      placeOfSupply,
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
        showTaxNumber: businessProfile?.show_tax_number ?? false,
        showPaymentQr: businessProfile?.show_payment_qr ?? false,
      },
      client: {
        name:
          customer?.type === "business"
            ? customer.businessName ||
              customer.name ||
              t("invoice.fallbackCustomer")
            : (customer?.name ?? t("invoice.fallbackCustomer")),
        type: customer?.type,
        businessName: customer?.businessName ?? customer?.business_name ?? "",
        gstin: customer?.gstin ?? "",
        email: customer?.email ?? "",
        phone: customer?.phone ?? "",
        address: formatCustomerAddressFromRecord(customer) || "",
      },
      items: items.map((item, index) => {
        const calculatedItem = totals.items?.[index];

        return {
          name: item.name || t("invoice.fallbackItem"),
          description: "",
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.price) || 0,
          taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
          amount: calculatedItem?.lineTotal ?? 0,
        };
      }),
      totals,
      discount: {
        type: form.discount_type,
        value: Number(form.discount) || 0,
        calculatedAmount: discountAppliedAmount,
        label: discountSummaryLabel,
      },
      paymentSummary: {
        statusLabel: paymentStatusLabel,
        statusTone: paymentStatusTone,
        statusNote: paymentStatusNote,
        paidAmount,
        remainingAmount,
        history: paymentHistory,
      },
      payment: {
        mode: paymentMethodLabel,
      },
      notes: form.notes || "",
      paymentInfo:
        form.payment_status === "UNPAID"
          ? t("invoiceDetail.paymentInfo")
          : `${t("purchasesPage.fields.paymentMethod")}: ${paymentMethodLabel}`,
      closingNote: t("invoiceDetail.closingNote"),
      signatureLabel: t("invoiceDetail.signatureLabel"),
    };
  }, [
    businessProfile,
    customer,
    dueDate,
    discountAppliedAmount,
    discountSummaryLabel,
    formatDate,
    form.amount_paid,
    form.discount,
    form.discount_type,
    form.payment_date,
    form.payment_method,
    form.payment_status,
    form.notes,
    invoiceDate,
    invoiceNumberPreview,
    items,
    taxMode,
    t,
    totals,
  ]);

  const currentInvoiceRenderPayload = useMemo(
    () =>
      buildInvoiceRenderPayload({
        templateId: activeTemplate.templateId,
        templateName: activeTemplate.templateName,
        data: invoicePreviewData,
        enabledSections: activeEnabledSections,
        sectionOrder: activeSectionOrder,
        theme: activeTheme,
        designConfig: activeDesignConfig,
      }),
    [
      activeDesignConfig,
      activeEnabledSections,
      activeSectionOrder,
      activeTemplate.templateId,
      activeTemplate.templateName,
      activeTheme,
      invoicePreviewData,
    ],
  );

  const handleLoadDraft = useCallback((draft: InvoiceDraft) => {
    setForm({
      ...draft.form,
      payment_status: draft.form.payment_status ?? "UNPAID",
      amount_paid: draft.form.amount_paid ?? "",
      payment_method: draft.form.payment_method ?? "",
      payment_date: draft.form.payment_date ?? "",
      sync_sales: draft.form.sync_sales ?? true,
      warehouse_id: draft.form.warehouse_id ?? resolvedDefaultWarehouseId,
    });
    setTaxMode(draft.taxMode);
    setItems(draft.items);
    setQuickEntryProduct(null);
    setSelectedItemIndex(draft.items.length > 0 ? 0 : null);
    setItemErrors([]);
    setSummaryErrors([]);
    setServerError(null);
  }, [resolvedDefaultWarehouseId]);

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
    [flashShortcutSection, focusProductSearch, markDirty, t],
  );

  const resetInvoiceComposer = useCallback(
    (options?: { announce?: boolean }) => {
      setForm({
        ...createEmptyInvoiceForm("", form.discount_type, {
          warehouse_id: resolvedDefaultWarehouseId,
        }),
        discount_type: form.discount_type,
      });
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
    [
      clearDraft,
      flashShortcutSection,
      focusProductSearch,
      form.discount_type,
      resolvedDefaultWarehouseId,
      t,
    ],
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
        toast.success(
          t("invoiceComposer.itemRemoved", { name: removedLabel }),
          {
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
          },
        );
      }

      focusProductSearch(false);
    },
    [
      flashShortcutSection,
      focusProductSearch,
      markDirty,
      resolvedSelectedItemIndex,
      t,
    ],
  );

  const handleFormChange = useCallback(
    (next: InvoiceFormState) => {
      const discount =
        next.discount_type === "PERCENTAGE"
          ? sanitizeDiscountPercent(next.discount)
          : sanitizeDiscountAmount(next.discount);
      const rawPaidAmount = sanitizePaidAmount(next.amount_paid);
      const amountPaid =
        next.payment_status === "PAID"
          ? String(Math.max(0, totals.total))
          : next.payment_status === "UNPAID"
            ? ""
            : rawPaidAmount;
      setForm({
        ...next,
        discount,
        amount_paid: amountPaid,
        payment_method:
          next.payment_status === "UNPAID" ? "" : next.payment_method,
        payment_date:
          next.payment_status === "UNPAID"
            ? ""
            : (next.payment_date || next.date),
      });
      setSummaryErrors([]);
      setServerError(null);
      markDirty();
    },
    [markDirty, totals.total],
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
    [addProductToBill, flashShortcutSection, focusProductSearch, t],
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

      if (
        !trimmedPrice ||
        Number.isNaN(Number(trimmedPrice)) ||
        Number(trimmedPrice) <= 0
      ) {
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
        toast.error(parseServerErrors(error, t("productsPage.saveError")));
      }
    },
    [addProductToBill, createProduct, parseServerErrors, quickProductForm, t],
  );

  const handleQuickCreateCustomer = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const trimmedName = quickCustomerForm.name.trim();
      const normalizedPhone = quickCustomerForm.phone.replace(/\D/g, "");

      if (trimmedName.length < 2) {
        toast.error(t("invoiceComposer.customerNameMin"));
        quickCustomerNameRef.current?.focus();
        return;
      }

      if (!/^\d{10}$/.test(normalizedPhone)) {
        toast.error(t("invoiceComposer.customerPhoneMin"));
        return;
      }

      try {
        const createdCustomer = await createCustomer.mutateAsync({
          name: trimmedName,
          phone: normalizedPhone,
        });

        queryClient.setQueryData<Customer[]>(
          ["customers"],
          (currentCustomers) => {
            const safeCustomers = currentCustomers ?? [];
            return [
              createdCustomer,
              ...safeCustomers.filter(
                (customer) => customer.id !== createdCustomer.id,
              ),
            ];
          },
        );

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
          t("invoiceComposer.billCustomerAdded", {
            name: createdCustomer.name,
          }),
        );
        focusProductSearch();
      } catch (error) {
        toast.error(parseServerErrors(error, t("customers.saveError")));
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
      t,
    ],
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const buildInvoicePdfFileName = useCallback(
    (invoiceNumber?: string | null) => {
      const normalized = (invoiceNumber?.trim() || invoiceNumberPreview).replace(
        /[^a-zA-Z0-9._-]/g,
        "-",
      );
      return `${normalized || "invoice"}.pdf`;
    },
    [invoiceNumberPreview],
  );

  const downloadPreviewInvoicePdf = useCallback(
    async (
      previewPayload: InvoiceRenderPayload,
      invoiceNumber?: string | null,
    ) => {
      await downloadPdf({
        previewPayload,
        fileName: buildInvoicePdfFileName(
          invoiceNumber || previewPayload.data.invoiceNumber,
        ),
      });
    },
    [buildInvoicePdfFileName, downloadPdf],
  );

  const handleDownloadPdf = useCallback(async () => {
    try {
      await downloadPreviewInvoicePdf(
        lastCreatedInvoiceRenderPayload ?? currentInvoiceRenderPayload,
        lastCreatedInvoiceNumber,
      );
    } catch {
      toast.error(t("invoice.pdfError"));
    }
  }, [
    currentInvoiceRenderPayload,
    downloadPreviewInvoicePdf,
    lastCreatedInvoiceRenderPayload,
    lastCreatedInvoiceNumber,
    t,
  ]);

  const submitInvoice = useCallback(async () => {
    if (createInvoice.isPending || checkoutAutomationPending) return;

    setServerError(null);

    setItemErrors(validation.errors);
    const nextSummaryErrors = discountValidationMessage
      ? [discountValidationMessage, ...validation.summary]
      : validation.summary;
    setSummaryErrors(nextSummaryErrors);
    if (nextSummaryErrors.length > 0) {
      if (!form.customer_id) {
        flashShortcutSection("form");
      } else if (items.length === 0) {
        flashShortcutSection("entry");
        focusProductSearch();
      } else {
        flashShortcutSection("items");
      }

      toast.error(nextSummaryErrors[0] ?? t("invoiceComposer.missingDetails"));
      return;
    }

    try {
      setCheckoutAutomationPending(true);
      const selectedCustomer =
        customers?.find(
          (customer) => customer.id === Number(form.customer_id),
        ) ?? null;
      const effectivePaidAmount =
        form.payment_status === "PAID"
          ? totals.total
          : form.payment_status === "PARTIALLY_PAID"
            ? Number(form.amount_paid || 0)
            : 0;
      const effectivePaymentDate =
        form.payment_status === "UNPAID"
          ? undefined
          : (form.payment_date ||
            form.date ||
            new Date().toISOString().slice(0, 10));
      const selectedWarehouseId = form.warehouse_id
        ? warehouses.some(
            (warehouse) => String(warehouse.id) === form.warehouse_id,
          )
          ? Number(form.warehouse_id)
          : resolvedDefaultWarehouseId
            ? Number(resolvedDefaultWarehouseId)
            : undefined
        : undefined;

      const checkoutResult = await runInvoiceCheckoutPipeline({
        createInvoice: createInvoice.mutateAsync,
        sendInvoiceEmail: (invoiceId, payload) =>
          sendInvoiceEmailMutation.mutateAsync({
            invoiceId,
            email: payload.email ?? "",
            previewPayload: payload.preview_payload ?? null,
          }),
        payload: {
          customer_id: Number(form.customer_id),
          date: form.date || undefined,
          due_date: form.due_date || undefined,
          discount: Number(form.discount) || undefined,
          discount_type: form.discount_type,
          status: mapPaymentStatusToInvoiceStatus(form.payment_status),
          payment_status: form.payment_status,
          amount_paid:
            form.payment_status === "UNPAID"
              ? undefined
              : Math.max(0, effectivePaidAmount),
          payment_method:
            form.payment_status === "UNPAID"
              ? undefined
              : (form.payment_method || undefined),
          payment_date: effectivePaymentDate,
          tax_mode: taxMode,
          template_snapshot: {
            templateId: activeTemplate.templateId,
            templateName: activeTemplate.templateName,
            enabledSections: activeEnabledSections,
            sectionOrder: activeSectionOrder,
            theme: activeTheme,
            designConfig: activeDesignConfig,
          },
          sync_sales: true,
          warehouse_id: selectedWarehouseId,
          items: items.map((item) => ({
            product_id: item.product_id ? Number(item.product_id) : undefined,
            name: item.name.trim(),
            quantity: Number(item.quantity),
            price: Number(item.price),
            tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
          })),
        },
        customerEmail: selectedCustomer?.email ?? null,
        previewPayload: currentInvoiceRenderPayload,
      });
      const createdInvoice = checkoutResult.invoice;
      const createdInvoiceRenderPayload = buildInvoiceRenderPayload({
        ...currentInvoiceRenderPayload,
        data: {
          ...currentInvoiceRenderPayload.data,
          invoiceNumber: createdInvoice.invoice_number,
        },
      });

      setLastCreatedInvoiceId(createdInvoice.id);
      setLastCreatedInvoiceNumber(createdInvoice.invoice_number);
      setLastCreatedInvoiceRenderPayload(createdInvoiceRenderPayload);
      setLastCreatedInvoiceTotal(Number(createdInvoice.total ?? totals.total));
      setLastCreatedInvoiceDate(
        createdInvoice.date
          ? new Date(createdInvoice.date).toISOString().slice(0, 10)
          : form.date || new Date().toISOString().slice(0, 10),
      );
      setLastCreatedCustomerEmail(
        checkoutResult.emailResult?.email ??
          checkoutResult.emailRecipient ??
          selectedCustomer?.email ??
          null,
      );
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
        t("invoice.createSuccess", {
          invoiceNumber: createdInvoice.invoice_number,
        }),
      );
      try {
        await downloadPreviewInvoicePdf(
          createdInvoiceRenderPayload,
          createdInvoice.invoice_number,
        );
      } catch {
        toast.error(t("invoice.pdfError"));
      }

      if (checkoutResult.emailResult && checkoutResult.emailRecipient) {
        captureAnalyticsEvent("invoice_email_sent", {
          invoiceId: createdInvoice.id,
          invoiceNumber: createdInvoice.invoice_number,
          source: "auto-checkout",
        });
        toast.success(
          checkoutResult.emailResult.queued
            ? `Email queued for ${checkoutResult.emailResult.email ?? checkoutResult.emailRecipient}`
            : `Email sent to ${checkoutResult.emailResult.email ?? checkoutResult.emailRecipient}`,
        );
      } else if (checkoutResult.emailError && checkoutResult.emailRecipient) {
        toast.error(
          parseServerErrors(
            checkoutResult.emailError,
            `Invoice created, but email could not be sent to ${checkoutResult.emailRecipient}.`,
          ),
        );
      }

      resetInvoiceComposer();
    } catch (error) {
      setServerError(parseServerErrors(error, t("invoice.createError")));
    } finally {
      setCheckoutAutomationPending(false);
    }
  }, [
    checkoutAutomationPending,
    createInvoice,
    currentInvoiceRenderPayload,
    customers,
    discountValidationMessage,
    downloadPreviewInvoicePdf,
    form,
    items,
    parseServerErrors,
    flashShortcutSection,
    resetInvoiceComposer,
    focusProductSearch,
    taxMode,
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

    if (!isValidEmailAddress(recipient)) {
      setInvoiceEmailError(t("invoiceDetail.messages.enterValidEmail"));
      return;
    }

    try {
      setInvoiceEmailError(null);
      const response = await sendInvoiceEmailMutation.mutateAsync({
        invoiceId: lastCreatedInvoiceId,
        email: recipient,
        previewPayload: lastCreatedInvoiceRenderPayload,
      });
      setLastCreatedCustomerEmail(response.email ?? recipient);
      setInvoiceEmailOpen(false);
      captureAnalyticsEvent("invoice_email_sent", {
        invoiceId: lastCreatedInvoiceId,
        invoiceNumber: lastCreatedInvoiceNumber,
      });
      toast.success(
        response.queued
          ? "Invoice email queued successfully."
          : t("invoice.sendEmailSuccess"),
      );
      toast.success(
        t("invoice.sendEmailSuccessInvoice", {
          invoiceNumber: lastCreatedInvoiceNumber ?? `#${lastCreatedInvoiceId}`,
        }),
      );
    } catch (error) {
      setServerError(parseServerErrors(error, t("invoice.sendEmailError")));
      toast.error(t("invoice.sendEmailFailureToast"));
    }
  }, [
    invoiceEmailRecipient,
    lastCreatedInvoiceId,
    lastCreatedInvoiceNumber,
    lastCreatedInvoiceRenderPayload,
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
      if (typeof event.key !== "string" || event.key.length === 0) return;

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
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
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
          if (
            key === "delete" ||
            (isMacShortcutPlatform && key === "backspace")
          ) {
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

  const bootstrapNotice = hasBootstrapError ? (
    <section className="mb-6 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
      <p className="text-sm font-semibold">
        {language === "hi"
          ? "कुछ डेटा लोड नहीं हो पाया"
          : "Some setup data could not be loaded"}
      </p>
      <p className="mt-1 text-xs opacity-90">
        {language === "hi"
          ? "ग्राहक, प्रोडक्ट या वेयरहाउस डेटा में दिक्कत है. कृपया फिर से लोड करें."
          : "Customers, products, or warehouse data failed to load. Please retry."}
      </p>
      <div className="mt-3">
        <Button type="button" variant="outline" onClick={handleRetryBootstrapData}>
          {language === "hi" ? "फिर से लोड करें" : "Retry loading"}
        </Button>
      </div>
    </section>
  ) : isBootstrapLoading ? (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
      {language === "hi"
        ? "ग्राहक, प्रोडक्ट और वेयरहाउस डेटा लोड हो रहा है..."
        : "Loading customers, products, and warehouse data..."}
    </section>
  ) : null;

  const heroActions = (
    <>
      <div className="rounded-[1.4rem] border border-border/70 bg-background/80 px-4 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {isDirty ? t("common.draft") : t("common.saved")}
        </p>
        <p className="mt-2 text-sm text-foreground">{draftId ?? "invoice-composer"}</p>
      </div>
      {noCustomers ? (
        <>
          <Button type="button" onClick={() => setQuickAddCustomerOpen(true)}>
            {helperCopy.addCustomer}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/customers">{helperCopy.openCustomers}</Link>
          </Button>
        </>
      ) : noProducts ? (
        <>
          <Button type="button" onClick={() => setQuickAddProductOpen(true)}>
            {helperCopy.addProduct}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/products">{helperCopy.openProducts}</Link>
          </Button>
        </>
      ) : (
        <Button type="button" onClick={scrollToCheckout}>
          {reviewActionLabel}
        </Button>
      )}
    </>
  );

  const customerWorkspaceNode = noCustomers ? (
    <FriendlyEmptyState
      icon={UsersRound}
      title={helperCopy.noCustomersTitle}
      description={helperCopy.noCustomersDescription}
      hint={helperCopy.noCustomersHint}
      primaryAction={{
        label: helperCopy.addCustomer,
        onClick: () => setQuickAddCustomerOpen(true),
      }}
      secondaryAction={{
        label: helperCopy.openCustomers,
        href: "/customers",
        variant: "outline",
      }}
    />
  ) : (
    <FirstTimeHint
      id="bill-step-customer"
      message="Choose the customer first. This makes the rest of the bill easier."
    >
      <div
        className={
          shortcutHighlight === "form"
            ? "rounded-[2rem] shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
            : undefined
        }
      >
        <InvoiceCompactMetaPanel
          form={form}
          customers={customers}
          warehouses={warehouses}
          businessSummary={businessSummary}
          invoiceNumberPreview={invoiceNumberPreview}
          subtotalAmount={totals.subtotal}
          totalAmount={totals.total}
          taxMode={taxMode}
          discountAppliedAmount={discountAppliedAmount}
          discountError={discountValidationMessage}
          onFormChange={handleFormChange}
          onTaxModeChange={handleTaxModeChange}
          summaryErrors={summaryErrors}
          serverError={serverError}
          onQuickAddCustomer={() => setQuickAddCustomerOpen(true)}
        />
      </div>
    </FirstTimeHint>
  );

  const helperNode = (
    <div className="grid gap-4">
      <Card className="gap-3 p-0">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            {language === "hi" ? "सहायता" : "Support"}
          </div>
          <CardTitle className="text-lg">{helperCopy.missingCustomerQuestion}</CardTitle>
          <CardDescription className="whitespace-normal">
            {helperCopy.missingCustomerAnswer}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-6 text-muted-foreground">
            {advancedHelpCopy.body}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const productsWorkspaceNode = noProducts ? (
    <FriendlyEmptyState
      icon={PackagePlus}
      title={helperCopy.noProductsTitle}
      description={helperCopy.noProductsDescription}
      hint={helperCopy.noProductsHint}
      primaryAction={{
        label: helperCopy.addProduct,
        onClick: () => setQuickAddProductOpen(true),
      }}
      secondaryAction={{
        label: helperCopy.openProducts,
        href: "/products",
        variant: "outline",
      }}
    />
  ) : (
    <FirstTimeHint
      id="bill-step-products"
      message="Search or scan a product here, then add it to the bill."
    >
      <InvoiceTable
        items={items}
        errors={itemErrors}
        productLookup={productLookup}
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
    </FirstTimeHint>
  );

  const previewWorkspaceNode = (
    <Card className="overflow-hidden p-0">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          {language === "hi" ? "बिल प्रीव्यू" : "Invoice preview"}
        </div>
        <CardTitle className="text-xl">
          {language === "hi" ? "लाइव A4 प्रीव्यू" : "Large live A4 preview"}
        </CardTitle>
        <CardDescription className="whitespace-normal">
          {language === "hi"
            ? "स्क्रीन पर साफ़ प्रीव्यू देखें. PDF और प्रिंट यही डेटा इस्तेमाल करते हैं."
            : "Review the exact invoice data here before PDF, print, or email."}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                stackKey={`invoices-preview-${activeTemplate.templateId}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}-${activeTheme.primaryColor}`}
              >
                <InvoiceTemplate
                  key={`${activeTemplate.templateId}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}`}
                  templateId={activeTemplate.templateId}
                  templateName={activeTemplate.templateName}
                  data={invoicePreviewData}
                  enabledSections={activeEnabledSections}
                  sectionOrder={activeSectionOrder}
                  theme={activeTheme}
                />
              </A4PreviewStack>
            </div>
          </DesignConfigProvider>
        </div>
      </CardContent>
    </Card>
  );

  const checkoutActionNode = (
    <FirstTimeHint
      id="bill-step-generate"
      message="When the customer and products are ready, use this button to create the bill."
      position="bottom"
    >
      <InvoiceCheckoutAction
        buttonId="bill-create-button"
        itemCount={items.length}
        isLoading={createInvoice.isPending || checkoutAutomationPending}
        disabled={
          createInvoice.isPending || checkoutAutomationPending || items.length === 0
        }
        buttonLabel={t("invoiceComposer.checkout")}
        loadingLabel={t("invoiceComposer.generating")}
        readyLabel={helperCopy.reviewReady}
        missingLabel={helperCopy.reviewMissing}
        readyHint={t("invoiceComposer.keyboardCheckout", {
          key: shortcutModifierLabel,
        })}
        missingHint={helperCopy.reviewMissingHelp}
        itemCountLabel={t("invoiceComposer.lineItemsCount", {
          count: items.length,
        })}
        onCheckout={() => void submitInvoice()}
      />
    </FirstTimeHint>
  );

  const totalsWorkspaceNode = (
    <InvoiceTotals
      totals={totals}
      taxMode={taxMode}
      discountValue={form.discount}
      discountType={form.discount_type}
      discountLabel={discountSummaryLabel}
      eyebrow="Checkout"
      title="Bill summary"
      description="Keep the total in view, tweak discount inline, then generate the invoice."
      statusLabel="Live"
      topSlot={
        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-slate-900/70">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Discount
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Adjust offer without leaving checkout.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3"
              disabled={totals.subtotal <= 0}
              onClick={() =>
                handleFormChange({
                  ...form,
                  discount: "10",
                  discount_type: "PERCENTAGE",
                })
              }
            >
              Flat 10%
            </Button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px]">
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={form.discount}
              disabled={totals.subtotal <= 0}
              onChange={(event) =>
                handleFormChange({ ...form, discount: event.target.value })
              }
              placeholder={t("invoiceForm.discountPlaceholder")}
              className="h-10 rounded-xl border-slate-200 bg-white text-sm shadow-sm focus-visible:border-primary/35 focus-visible:ring-primary/10 dark:border-slate-700 dark:bg-slate-950"
            />
            <select
              id="discount_type"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary/35 dark:focus:ring-primary/20"
              value={form.discount_type}
              disabled={totals.subtotal <= 0}
              onChange={(event) =>
                handleFormChange({
                  ...form,
                  discount_type: event.target
                    .value as InvoiceFormState["discount_type"],
                })
              }
            >
              <option value="FIXED">{t("invoiceForm.discountTypeFixed")}</option>
              <option value="PERCENTAGE">
                {t("invoiceForm.discountTypePercentage")}
              </option>
            </select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-300">
              Applied discount
            </span>
            <span className="font-semibold text-slate-950 dark:text-slate-100">
              -{formatCurrency(discountAppliedAmount)}
            </span>
          </div>
          {discountValidationMessage ? (
            <p className="mt-2 text-sm text-destructive">
              {discountValidationMessage}
            </p>
          ) : null}
        </div>
      }
      paidAmount={
        form.payment_status === "PAID"
          ? totals.total
          : form.payment_status === "PARTIALLY_PAID"
            ? Math.min(Math.max(Number(form.amount_paid || 0), 0), totals.total)
            : 0
      }
      remainingAmount={
        form.payment_status === "PAID"
          ? 0
          : Math.max(
              totals.total -
                (form.payment_status === "PARTIALLY_PAID"
                  ? Math.min(
                      Math.max(Number(form.amount_paid || 0), 0),
                      totals.total,
                    )
                  : 0),
              0,
            )
      }
      className="xl:max-w-none"
      action={checkoutActionNode}
    />
  );

  const actionsWorkspaceNode = (
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
  );

  const draftsWorkspaceNode = (
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
  );

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={language === "hi" ? "बिल बनाएं" : "Create Bill"}
      subtitle={
        language === "hi"
          ? "ग्राहक चुनें, प्रोडक्ट जोड़ें और कुछ ही स्टेप्स में बिल तैयार करें।"
          : "Choose a customer, add products, and create a bill in a few simple steps."
      }
      actions={headerActions}
    >
      <>
        <InvoiceWorkspaceV2
          title={language === "hi" ? "इनवॉइस वर्कस्पेस" : "Invoice workspace"}
          description={
            language === "hi"
              ? "उसी लॉजिक के साथ ग्राहक, उत्पाद, प्रीव्यू और चेकआउट को एक तेज़ सिंगल-स्क्रीन लेआउट में रखें."
              : "Keep customer, products, preview, and checkout in one faster single-screen workspace using the same invoice logic."
          }
          draftBadgeLabel={isDirty ? t("common.draft") : t("common.saved")}
          draftMeta={
            isDirty
              ? t("invoice.statusUnsavedChanges")
              : lastSavedAt
                ? t("invoiceDrafts.savedRelative", {
                    time: formatRelativeTime(lastSavedAt, locale),
                  })
                : t("common.ready")
          }
          invoiceNumberPreview={invoiceNumberPreview}
          invoiceDateLabel={invoiceDate}
          customerLabel={customer?.name || t("invoiceForm.selectCustomer")}
          totalLabel={formatCurrency(totals.total)}
          lineItemsLabel={t("invoiceComposer.lineItemsCount", {
            count: items.length,
          })}
          bootstrapNotice={bootstrapNotice}
          heroActions={heroActions}
          customerNode={customerWorkspaceNode}
          helperNode={helperNode}
          productsNode={productsWorkspaceNode}
          previewNode={previewWorkspaceNode}
          totalsNode={totalsWorkspaceNode}
          actionsNode={actionsWorkspaceNode}
          draftsNode={draftsWorkspaceNode}
        />

        {SHOW_LEGACY_INVOICE_COMPOSER_UI ? (
          <>
      <div className="mx-auto w-full max-w-[1500px] font-[var(--font-sora),var(--font-geist-sans)]">
        {hasBootstrapError ? (
          <section className="mb-6 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="text-sm font-semibold">
              {language === "hi"
                ? "कुछ डेटा लोड नहीं हो पाया"
                : "Some setup data could not be loaded"}
            </p>
            <p className="mt-1 text-xs opacity-90">
              {language === "hi"
                ? "ग्राहक, प्रोडक्ट या वेयरहाउस डेटा में दिक्कत है। कृपया फिर से लोड करें।"
                : "Customers, products, or warehouse data failed to load. Please retry."}
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetryBootstrapData}
              >
                {language === "hi" ? "फिर से लोड करें" : "Retry loading"}
              </Button>
            </div>
          </section>
        ) : isBootstrapLoading ? (
          <section className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            {language === "hi"
              ? "ग्राहक, प्रोडक्ट और वेयरहाउस डेटा लोड हो रहा है..."
              : "Loading customers, products, and warehouse data..."}
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-[0_24px_54px_-38px_rgba(15,23,42,0.16)] ring-1 ring-slate-200/70 dark:border-slate-700 dark:bg-slate-900/75 dark:ring-slate-700/60">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Guided bill flow
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {guidedFlowCopy.bannerTitle}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                {guidedFlowCopy.bannerDescription}
              </p>
            </div>

            <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
              <p className="font-semibold">Step {guidedStep} of 3</p>
              <p className="mt-1">
                {guidedFlowCopy.steps[guidedStep - 1]?.description}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {guidedFlowCopy.steps.map((step, index) => {
              const stepNumber = index + 1;
              const isDone = guidedStep > stepNumber;
              const isActive = guidedStep === stepNumber;

              return (
                <div
                  key={step.title}
                  className={[
                    "rounded-[1.45rem] border px-4 py-4 transition",
                    isActive
                      ? "border-primary/40 bg-primary/5"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50/80"
                        : "border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-primary">
                      {isDone ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Circle size={18} />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Step {stepNumber}
                      </p>
                      <p className="mt-1 font-semibold text-slate-950 dark:text-slate-100">
                        {step.title}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {noCustomers ? (
              <>
                <Button
                  type="button"
                  onClick={() => setQuickAddCustomerOpen(true)}
                >
                  {helperCopy.addCustomer}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/customers">{helperCopy.openCustomers}</Link>
                </Button>
              </>
            ) : noProducts ? (
              <>
                <Button
                  type="button"
                  onClick={() => setQuickAddProductOpen(true)}
                >
                  {helperCopy.addProduct}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/products">{helperCopy.openProducts}</Link>
                </Button>
              </>
            ) : (
              <Button type="button" onClick={scrollToCheckout}>
                {reviewActionLabel}
              </Button>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.64fr)]">
          <div className="grid gap-4">
            <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Step 1
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
                {guidedFlowCopy.steps[0]?.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {guidedFlowCopy.steps[0]?.description}
              </p>
            </div>

            {noCustomers ? (
              <FriendlyEmptyState
                icon={UsersRound}
                title={helperCopy.noCustomersTitle}
                description={helperCopy.noCustomersDescription}
                hint={helperCopy.noCustomersHint}
                primaryAction={{
                  label: helperCopy.addCustomer,
                  onClick: () => setQuickAddCustomerOpen(true),
                }}
                secondaryAction={{
                  label: helperCopy.openCustomers,
                  href: "/customers",
                  variant: "outline",
                }}
              />
            ) : null}

            <FirstTimeHint
              id="bill-step-customer"
              message="Choose the customer first. This makes the rest of the bill easier."
            >
              <div
                className={
                  shortcutHighlight === "form"
                    ? "rounded-[2rem] shadow-[0_0_0_4px_rgba(37,99,235,0.12)]"
                    : undefined
                }
              >
            <InvoiceForm
              form={form}
              customers={customers}
              warehouses={warehouses}
              businessSummary={businessSummary}
              invoiceNumberPreview={invoiceNumberPreview}
              subtotalAmount={totals.subtotal}
              totalAmount={totals.total}
              taxMode={taxMode}
              discountAppliedAmount={discountAppliedAmount}
              discountError={discountValidationMessage}
              onFormChange={handleFormChange}
              onTaxModeChange={handleTaxModeChange}
              onSubmit={handleSubmit}
                  isSubmitting={
                    createInvoice.isPending || checkoutAutomationPending
                  }
                  summaryErrors={summaryErrors}
                  serverError={serverError}
                  hideSubmit
                />
              </div>
            </FirstTimeHint>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-[1.7rem] bg-white/90 p-6 text-sm text-slate-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-700/70">
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {helperCopy.missingCustomerQuestion}
              </p>
              <p className="mt-2 leading-6">
                {helperCopy.missingCustomerAnswer}
              </p>
            </div>
            <div className="no-print rounded-[1.7rem] bg-white/90 p-6 text-sm text-slate-600 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-700/70">
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {advancedHelpCopy.title}
              </p>
              <p className="mt-2 leading-6">{advancedHelpCopy.body}</p>
            </div>
          </aside>
        </section>

        <section className="mt-8 grid gap-6">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Step 2
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
              {guidedFlowCopy.steps[1]?.title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {guidedFlowCopy.steps[1]?.description}
            </p>
          </div>

          {noProducts ? (
            <FriendlyEmptyState
              icon={PackagePlus}
              title={helperCopy.noProductsTitle}
              description={helperCopy.noProductsDescription}
              hint={helperCopy.noProductsHint}
              primaryAction={{
                label: helperCopy.addProduct,
                onClick: () => setQuickAddProductOpen(true),
              }}
              secondaryAction={{
                label: helperCopy.openProducts,
                href: "/products",
                variant: "outline",
              }}
            />
          ) : (
            <FirstTimeHint
              id="bill-step-products"
              message="Search or scan a product here, then add it to the bill."
            >
              <InvoiceTable
                items={items}
                errors={itemErrors}
                productLookup={productLookup}
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
            </FirstTimeHint>
          )}
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.72fr)_minmax(340px,0.62fr)] xl:items-start xl:gap-8">
          <div className="grid gap-6">
            <div className="rounded-[1.6rem] border border-slate-200 bg-white/90 px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Step 3
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-100">
                {guidedFlowCopy.steps[2]?.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {guidedFlowCopy.steps[2]?.description}
              </p>
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
                    stackKey={`invoices-preview-${activeTemplate.templateId}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}-${activeTheme.primaryColor}`}
                  >
                    <InvoiceTemplate
                      key={`${activeTemplate.templateId}-${activeSectionOrder.join(",")}-${activeEnabledSections.join(",")}`}
                      templateId={activeTemplate.templateId}
                      templateName={activeTemplate.templateName}
                      data={invoicePreviewData}
                      enabledSections={activeEnabledSections}
                      sectionOrder={activeSectionOrder}
                      theme={activeTheme}
                    />
                  </A4PreviewStack>
                </div>
              </DesignConfigProvider>
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
          </div>

          <aside className="grid gap-6 xl:sticky xl:top-24">
            <InvoiceTotals
              totals={totals}
              taxMode={taxMode}
              discountValue={form.discount}
              discountType={form.discount_type}
              discountLabel={discountSummaryLabel}
              paidAmount={
                form.payment_status === "PAID"
                  ? totals.total
                  : form.payment_status === "PARTIALLY_PAID"
                    ? Math.min(
                        Math.max(Number(form.amount_paid || 0), 0),
                        totals.total,
                      )
                    : 0
              }
              remainingAmount={
                form.payment_status === "PAID"
                  ? 0
                  : Math.max(
                      totals.total -
                        (form.payment_status === "PARTIALLY_PAID"
                          ? Math.min(
                              Math.max(Number(form.amount_paid || 0), 0),
                              totals.total,
                            )
                          : 0),
                      0,
                    )
              }
              className="xl:max-w-[390px]"
              action={checkoutActionNode}
            />

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
          </aside>
        </section>

      </div>
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
          title={t("invoiceComposer.emailModalTitle")}
          description={t("invoiceComposer.emailModalDescription")}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
              <p>
                {t("invoiceDetail.emailDebugInvoice", {
                  value: lastCreatedInvoiceNumber ?? "-",
                })}
              </p>
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
              <Label htmlFor="invoice-email-recipient">
                {t("invoiceComposer.emailLabel")}
              </Label>
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
              [
                `${shortcutModifierLabel}+B`,
                t("invoiceComposer.shortcutNewBill"),
              ],
              [
                `${shortcutModifierLabel}+P`,
                t("invoiceComposer.shortcutQuickProduct"),
              ],
              [
                `${shortcutModifierLabel}+C`,
                t("invoiceComposer.shortcutQuickCustomer"),
              ],
              [
                `${shortcutModifierLabel}+S`,
                t("invoiceComposer.shortcutSaveBill"),
              ],
              [
                `${shortcutModifierLabel}+D`,
                t("invoiceComposer.shortcutDiscount"),
              ],
              [
                `${shortcutModifierLabel}+Q`,
                t("invoiceComposer.shortcutFocusSearch"),
              ],
              [
                `${shortcutModifierLabel}+Delete`,
                t("invoiceComposer.shortcutRemoveItem"),
              ],
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
              <Label htmlFor="quick-product-name">
                {t("invoiceComposer.name")}
              </Label>
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
              <Label htmlFor="quick-product-price">
                {t("invoiceComposer.price")}
              </Label>
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
              <Label htmlFor="quick-product-barcode">
                {t("invoiceComposer.barcode")}
              </Label>
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
                {createProduct.isPending
                  ? t("common.processing")
                  : t("invoiceComposer.saveProduct")}
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
              <Label htmlFor="quick-customer-name">
                {t("invoiceComposer.name")}
              </Label>
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
              <Label htmlFor="quick-customer-phone">
                {t("invoiceComposer.phone")}
              </Label>
              <Input
                id="quick-customer-phone"
                value={quickCustomerForm.phone}
                onChange={(event) =>
                  setQuickCustomerForm((currentForm) => ({
                    ...currentForm,
                    phone: event.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                placeholder={t("invoiceComposer.customerPhonePlaceholder")}
                inputMode="numeric"
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
                {createCustomer.isPending
                  ? t("common.processing")
                  : t("invoiceComposer.saveCustomer")}
              </Button>
            </div>
          </form>
        </Modal>
      </>
    </DashboardLayout>
  );
};

export default InvoiceClient;
