"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoiceTotals from "@/components/invoice/InvoiceTotals";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Modal from "@/components/ui/modal";
import {
  useCreateCustomerMutation,
  useCreateInvoiceMutation,
  useCustomersQuery,
  useProductsQuery,
} from "@/hooks/useInventoryQueries";
import { useActiveInvoiceTemplate } from "@/hooks/invoice/useActiveInvoiceTemplate";
import {
  fetchBusinessProfile,
  type BusinessProfileRecord,
  type Customer,
  type InvoiceInput,
  type Product,
} from "@/lib/apiClient";
import { useInvoiceTotals } from "@/hooks/invoice/useInvoiceTotals";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  DiscountType,
  InvoiceFormState,
  InvoiceItemForm,
  TaxMode,
} from "@/types/invoice";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";

type SimpleBillClientProps = {
  name: string;
  image?: string;
  initialInvoiceDate: string;
};

type SimpleBillItem = {
  id: string;
  productId?: number;
  name: string;
  quantity: string;
  price: string;
};

type PaymentChoice = "CASH" | "UPI" | "ONLINE";
type InvoicePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER";
type DiscountMode = "AMOUNT" | "PERCENT";

type SavedSimpleBill = {
  customerId?: number;
  customerName?: string;
  payment: PaymentChoice;
  discount: string;
  discountMode: DiscountMode;
  gstEnabled: boolean;
  notes: string;
  items: SimpleBillItem[];
};

const LAST_CUSTOMER_KEY = "billsutra.simple-bill.last-customer";
const LAST_BILL_KEY = "billsutra.simple-bill.last-bill";
const PRODUCT_USAGE_KEY = "billsutra.simple-bill.product-usage";
const INITIAL_ITEM_ID = "simple-bill-item-1";
const GST_RATE = 18;
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

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const createItem = (id?: string): SimpleBillItem => ({
  id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: "",
  quantity: "1",
  price: "",
});

const toAmount = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const toQuantity = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, numberValue) : 1;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const customerLabel = (customer: Customer) =>
  customer.phone ? `${customer.name} (${customer.phone})` : customer.name;

const paymentMethod = (payment: PaymentChoice): InvoicePaymentMethod => {
  if (payment === "UPI") return "UPI";
  if (payment === "ONLINE") return "BANK_TRANSFER";
  return "CASH";
};

const paymentLabel = (payment: InvoicePaymentMethod) => {
  if (payment === "UPI") return "UPI";
  if (payment === "BANK_TRANSFER") return "Online";
  return "Cash";
};

const containsText = (value: string | null | undefined, search: string) =>
  value?.toLowerCase().includes(search.toLowerCase()) ?? false;

const toDiscountType = (mode: DiscountMode): DiscountType =>
  mode === "PERCENT" ? "PERCENTAGE" : "FIXED";

const mapSimpleBillItemsToInvoiceItems = (
  billItems: SimpleBillItem[],
  gstEnabled: boolean,
): InvoiceItemForm[] =>
  billItems.map((item) => ({
    product_id: item.productId ? String(item.productId) : "",
    name: item.name.trim(),
    quantity: String(toQuantity(item.quantity)),
    price: String(toAmount(item.price)),
    tax_rate: gstEnabled ? String(GST_RATE) : "",
  }));

const isInvoiceItemReady = (item: InvoiceItemForm) =>
  Boolean(item.name.trim() && Number(item.quantity) > 0 && Number(item.price) > 0);

const mapSimpleBillToInvoice = ({
  customerId,
  invoiceDate,
  discount,
  discountType,
  notes,
  items,
}: {
  customerId: number;
  invoiceDate: string;
  discount: string;
  discountType: DiscountType;
  notes: string;
  items: InvoiceItemForm[];
}): InvoiceInput => ({
  customer_id: customerId,
  date: invoiceDate || todayInputValue(),
  due_date: invoiceDate || todayInputValue(),
  discount: Number(discount) || undefined,
  discount_type: discountType,
  notes: notes.trim() || undefined,
  status: "SENT",
  sync_sales: false,
  items: items.filter(isInvoiceItemReady).map((item) => ({
    product_id: item.product_id ? Number(item.product_id) : undefined,
    name: item.name.trim(),
    quantity: Number(item.quantity),
    price: Number(item.price),
    tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
  })),
});

const buildSimpleBillInvoicePreviewData = ({
  businessProfile,
  customer,
  fallbackCustomerName,
  fallbackCustomerPhone,
  invoiceNumber,
  invoiceDate,
  dueDate,
  items,
  totals,
  discountType,
  discount,
  payment,
  notes,
}: {
  businessProfile?: BusinessProfileRecord | null;
  customer?: Customer | null;
  fallbackCustomerName: string;
  fallbackCustomerPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  items: InvoiceItemForm[];
  totals: NonNullable<InvoicePreviewData["totals"]>;
  discountType: DiscountType;
  discount: string;
  payment: InvoicePaymentMethod;
  notes: string;
}): InvoicePreviewData => {
  const selectedPaymentLabel = paymentLabel(payment);

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    business: {
      businessName: businessProfile?.business_name || "BillSutra",
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
      name: customer?.name ?? (fallbackCustomerName || "Customer"),
      email: customer?.email ?? "",
      phone: customer?.phone ?? fallbackCustomerPhone,
      address: customer?.address ?? "",
    },
    items: items.filter(isInvoiceItemReady).map((item) => ({
      name: item.name.trim(),
      description: item.tax_rate ? `GST ${item.tax_rate}%` : "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.price),
      taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
    })),
    totals,
    discount: {
      type: discountType,
      value: Number(discount) || 0,
      label:
        discountType === "PERCENTAGE"
          ? `Discount (${Math.min(100, Number(discount) || 0).toFixed(2)}%)`
          : "Discount",
    },
    paymentSummary: {
      statusLabel: `${selectedPaymentLabel} selected`,
      statusTone: "pending",
      statusNote: `Payment method: ${selectedPaymentLabel}`,
      paidAmount: 0,
      remainingAmount: totals.total,
      history: [],
    },
    notes: notes.trim(),
    paymentInfo: `Payment method: ${selectedPaymentLabel}`,
    closingNote: "Thank you for your business.",
    signatureLabel: "Authorized Signature",
  };
};

const ExistingInvoicePreview = ({
  data,
  hasItems = true,
  templateId,
  templateName,
  enabledSections,
  sectionOrder,
  theme,
  designConfig,
}: {
  data: InvoicePreviewData;
  hasItems?: boolean;
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder: SectionKey[];
  theme: InvoiceTheme;
  designConfig: ReturnType<typeof normalizeDesignConfig>;
}) => {
  if (!hasItems) {
    return (
      <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700">
        <div className="flex min-h-[34rem] items-center justify-center rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          Add items to see preview
        </div>
      </div>
    );
  }

  return (
    <DesignConfigProvider
      value={{
        designConfig,
        updateSection: () => {},
        resetSection: () => {},
        resetAll: () => {},
      }}
    >
      <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        <A4PreviewStack
          stackKey={`simple-bill-preview-${templateId ?? "default"}-${data.invoiceNumber}-${data.items.length}-${data.totals?.total ?? 0}`}
        >
          <TemplatePreviewRenderer
            templateId={templateId}
            templateName={templateName}
            data={data}
            enabledSections={enabledSections}
            sectionOrder={sectionOrder}
            theme={theme}
          />
        </A4PreviewStack>
      </div>
    </DesignConfigProvider>
  );
};

const SimpleBillClient = ({
  name,
  image,
  initialInvoiceDate,
}: SimpleBillClientProps) => {
  const displayName = name.trim() || "Guest";
  const router = useRouter();
  const { formatDate, t } = useI18n();
  const { data: customers = [] } = useCustomersQuery();
  const { data: products = [] } = useProductsQuery({ limit: 1000 });
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const createCustomer = useCreateCustomerMutation();
  const createInvoice = useCreateInvoiceMutation();
  const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null);
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [items, setItems] = useState<SimpleBillItem[]>(() => [
    createItem(INITIAL_ITEM_ID),
  ]);
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("AMOUNT");
  const [payment, setPayment] = useState<PaymentChoice>("CASH");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productUsage, setProductUsage] = useState<Record<number, number>>({});
  const newCustomerPhoneRef = useRef<HTMLInputElement | null>(null);
  const itemNameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemQuantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemPriceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ??
      (createdCustomer?.id === selectedCustomerId ? createdCustomer : null),
    [createdCustomer, customers, selectedCustomerId],
  );

  const customerSuggestions = useMemo(() => {
    const search = customerSearch.trim();
    if (!search) return customers.slice(0, 5);
    return customers
      .filter(
        (customer) =>
          containsText(customer.name, search) || containsText(customer.phone, search),
      )
      .slice(0, 5);
  }, [customerSearch, customers]);

  const hasExactCustomerMatch = useMemo(() => {
    const search = customerSearch.trim().toLowerCase();
    if (!search) return false;
    return customers.some(
      (customer) =>
        customer.name.toLowerCase() === search ||
        customerLabel(customer).toLowerCase() === search,
    );
  }, [customerSearch, customers]);

  const discountType = useMemo(() => toDiscountType(discountMode), [discountMode]);
  const invoiceItems = useMemo(
    () => mapSimpleBillItemsToInvoiceItems(items, gstEnabled),
    [gstEnabled, items],
  );
  const validItems = useMemo(
    () => invoiceItems.filter(isInvoiceItemReady),
    [invoiceItems],
  );
  const taxMode: TaxMode = gstEnabled ? "CGST_SGST" : "NONE";
  const invoiceForm = useMemo<InvoiceFormState>(
    () => ({
      customer_id: selectedCustomerId ? String(selectedCustomerId) : "",
      date: invoiceDate,
      due_date: invoiceDate,
      discount: discount || "0",
      discount_type: discountType,
      notes,
      sync_sales: false,
      warehouse_id: "",
    }),
    [discount, discountType, invoiceDate, notes, selectedCustomerId],
  );
  const totals = useInvoiceTotals(
    invoiceItems,
    invoiceForm.discount,
    invoiceForm.discount_type,
    taxMode,
  );
  const fallbackActiveTemplate = useMemo(
    () => ({
      templateId: "professional",
      templateName: "Professional",
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
  const previewInvoiceDate = useMemo(
    () =>
      formatDate(invoiceDate ? `${invoiceDate}T00:00:00` : new Date(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [formatDate, invoiceDate],
  );
  const selectedPaymentMethod = paymentMethod(payment);
  const invoicePreviewData = useMemo<InvoicePreviewData>(() => {
    return buildSimpleBillInvoicePreviewData({
      businessProfile,
      customer: selectedCustomer,
      fallbackCustomerName:
        (addingCustomer ? newCustomerName.trim() : customerSearch.trim()) ||
        "Customer",
      fallbackCustomerPhone: addingCustomer ? newCustomerPhone.trim() : "",
      invoiceNumber: t("invoice.invoicePreviewNumber"),
      invoiceDate: previewInvoiceDate,
      dueDate: previewInvoiceDate,
      items: invoiceItems,
      totals,
      discountType,
      discount: invoiceForm.discount,
      payment: selectedPaymentMethod,
      notes,
    });
  }, [
    addingCustomer,
    businessProfile,
    customerSearch,
    discountType,
    invoiceForm.discount,
    invoiceItems,
    newCustomerName,
    newCustomerPhone,
    notes,
    previewInvoiceDate,
    selectedCustomer,
    selectedPaymentMethod,
    t,
    totals,
  ]);

  const frequentProducts = useMemo(
    () =>
      [...products]
        .sort(
          (left, right) =>
            (productUsage[right.id] ?? 0) - (productUsage[left.id] ?? 0),
        )
        .slice(0, 4),
    [productUsage, products],
  );

  const getProductSuggestions = useCallback(
    (itemName: string) => {
      const search = itemName.trim();
      if (!search) return products.slice(0, 5);
      return products
        .filter(
          (product) =>
            containsText(product.name, search) ||
            containsText(product.barcode, search),
        )
        .slice(0, 5);
    },
    [products],
  );

  useEffect(() => {
    const storedUsage = window.localStorage.getItem(PRODUCT_USAGE_KEY);
    if (storedUsage) {
      try {
        setProductUsage(JSON.parse(storedUsage) as Record<number, number>);
      } catch {
        setProductUsage({});
      }
    }

    const lastCustomerId = Number(window.localStorage.getItem(LAST_CUSTOMER_KEY));
    if (Number.isFinite(lastCustomerId) && lastCustomerId > 0) {
      setSelectedCustomerId(lastCustomerId);
    }
  }, []);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerSearch(customerLabel(selectedCustomer));
  }, [selectedCustomer]);

  const updateItem = useCallback(
    (id: string, patch: Partial<SimpleBillItem>) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCreatedCustomer((current) => (current?.id === customer.id ? current : null));
    setCustomerSearch(customerLabel(customer));
    setNewCustomerName("");
    setNewCustomerPhone("");
    setAddingCustomer(false);
    setCustomerSuggestionsOpen(false);
  };

  const selectProductForItem = useCallback(
    (itemId: string, product: Product) => {
      updateItem(itemId, {
        productId: product.id,
        name: product.name,
        price: String(Number(product.price) || 0),
      });
    },
    [updateItem],
  );

  const handleItemNameChange = useCallback(
    (itemId: string, value: string) => {
      const exactMatch = products.find(
        (product) => product.name.toLowerCase() === value.trim().toLowerCase(),
      );

      if (exactMatch) {
        selectProductForItem(itemId, exactMatch);
        return;
      }

      updateItem(itemId, { name: value, productId: undefined });
    },
    [products, selectProductForItem, updateItem],
  );

  const addItemAfter = useCallback((afterId?: string) => {
    const nextItem = createItem();
    setItems((current) => {
      if (!afterId) return [...current, nextItem];
      const index = current.findIndex((item) => item.id === afterId);
      if (index < 0) return [...current, nextItem];
      return [
        ...current.slice(0, index + 1),
        nextItem,
        ...current.slice(index + 1),
      ];
    });
    window.setTimeout(() => itemNameRefs.current[nextItem.id]?.focus(), 0);
  }, []);

  const removeItem = (id: string) => {
    setItems((current) =>
      current.length === 1
        ? [{ ...createItem(), id }]
        : current.filter((item) => item.id !== id),
    );
  };

  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value);
    setCustomerSuggestionsOpen(true);
    setAddingCustomer(false);
    setCreatedCustomer(null);
    const match = customers.find(
      (customer) =>
        customerLabel(customer).toLowerCase() === value.trim().toLowerCase() ||
        customer.name.toLowerCase() === value.trim().toLowerCase(),
    );
    setSelectedCustomerId(match?.id ?? null);
  };

  const startAddCustomer = (nameToUse = customerSearch) => {
    setAddingCustomer(true);
    setSelectedCustomerId(null);
    setCreatedCustomer(null);
    setNewCustomerName(nameToUse.trim());
    setCustomerSuggestionsOpen(false);
    window.setTimeout(() => {
      if (nameToUse.trim()) {
        newCustomerPhoneRef.current?.focus();
      } else {
        document.getElementById("simple-new-customer-name")?.focus();
      }
    }, 0);
  };

  const handleQuickAddCustomer = () => {
    if (!newCustomerName.trim()) {
      toast.error("Enter the customer name.");
      return;
    }

    setCustomerSearch(
      newCustomerPhone.trim()
        ? `${newCustomerName.trim()} (${newCustomerPhone.trim()})`
        : newCustomerName.trim(),
    );
    setCustomerSuggestionsOpen(false);
    toast.success("Customer will be added when the invoice is generated.");
  };

  const loadLastBill = () => {
    const stored = window.localStorage.getItem(LAST_BILL_KEY);
    if (!stored) {
      toast.info("No saved bill to repeat yet.");
      return;
    }

    try {
      const bill = JSON.parse(stored) as SavedSimpleBill;
      setAddingCustomer(false);
      setSelectedCustomerId(bill.customerId ?? null);
      setCreatedCustomer(null);
      setCustomerSearch(bill.customerName ?? "");
      setItems(
        bill.items.length > 0
          ? bill.items.map((item) => ({ ...item, id: createItem().id }))
          : [createItem()],
      );
      setDiscount(bill.discount);
      setDiscountMode(bill.discountMode ?? "AMOUNT");
      setGstEnabled(Boolean(bill.gstEnabled));
      setNotes(bill.notes ?? "");
      setPayment(bill.payment);
      setInvoiceDate(todayInputValue());
      toast.success("Last bill loaded.");
    } catch {
      toast.error("Could not load the last bill.");
    }
  };

  const saveProductUsage = (billItems: SimpleBillItem[]) => {
    const nextUsage = { ...productUsage };
    for (const item of billItems) {
      if (!item.productId) continue;
      nextUsage[item.productId] = (nextUsage[item.productId] ?? 0) + 1;
    }
    setProductUsage(nextUsage);
    window.localStorage.setItem(PRODUCT_USAGE_KEY, JSON.stringify(nextUsage));
  };

  const saveLastBill = (customer: Customer, billItems: SimpleBillItem[]) => {
    const saved: SavedSimpleBill = {
      customerId: customer.id,
      customerName: customerLabel(customer),
      payment,
      discount,
      discountMode,
      gstEnabled,
      notes,
      items: billItems,
    };
    window.localStorage.setItem(LAST_CUSTOMER_KEY, String(customer.id));
    window.localStorage.setItem(LAST_BILL_KEY, JSON.stringify(saved));
  };

  const handleGenerateBill = async () => {
    if (isSubmitting) return;

    if (addingCustomer && !newCustomerName.trim()) {
      toast.error("Enter the customer name.");
      return;
    }

    if (!addingCustomer && !selectedCustomerId) {
      toast.error("Type or select a customer.");
      return;
    }

    if (validItems.length === 0) {
      toast.error("Add at least one item with a price.");
      return;
    }

    try {
      setIsSubmitting(true);

      const customer = addingCustomer
        ? await createCustomer.mutateAsync({
            name: newCustomerName.trim(),
            phone: newCustomerPhone.trim() || undefined,
          })
        : selectedCustomer;

      if (!customer) {
        toast.error("Type or select a customer.");
        return;
      }

      const invoicePayload = mapSimpleBillToInvoice({
        customerId: customer.id,
        invoiceDate,
        discount: invoiceForm.discount,
        discountType: invoiceForm.discount_type,
        notes,
        items: invoiceItems,
      });

      const createdInvoice = await createInvoice.mutateAsync(invoicePayload);
      const billItems: SimpleBillItem[] = validItems.map((item) => ({
        id: item.product_id || createItem().id,
        productId: item.product_id ? Number(item.product_id) : undefined,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      saveProductUsage(billItems);
      saveLastBill(customer, billItems);
      setCreatedCustomer(customer);
      setSelectedCustomerId(customer.id);
      setCustomerSearch(customerLabel(customer));
      setAddingCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      toast.success("Bill generated.");
      router.push(`/invoices/history/${createdInvoice.id}`);
    } catch {
      toast.error("Could not generate the bill. Please check the details and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreviewBill = () => {
    setPreviewOpen(true);
  };

  return (
    <DashboardLayout
      name={displayName}
      image={image}
      title="Simple Bill"
      subtitle="Create bill in seconds - type or select."
    >
      <div className="mx-auto grid w-full max-w-[100rem] gap-5">
        <section className="rounded-lg bg-card/80 px-4 py-3 shadow-[0_14px_36px_-34px_rgba(15,23,42,0.45)] ring-1 ring-border/35 sm:px-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Create bill in seconds - type or select
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add customer, add items, preview if needed, then generate.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
              <span>Invoice number generated on save</span>
              <span className="text-muted-foreground">|</span>
              <Input
                id="simple-invoice-date"
                type="date"
                aria-label="Bill date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                className="h-9 w-[9.5rem] bg-background/80 text-sm"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-end">
              <button
                type="button"
                className={`h-12 rounded-lg px-4 text-sm font-semibold transition ${
                  gstEnabled
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => setGstEnabled((current) => !current)}
              >
                GST {gstEnabled ? "On" : "Off"}
              </button>
              <div className="grid gap-2">
                <Label htmlFor="simple-notes">Notes</Label>
                <Input
                  id="simple-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="h-12 text-base"
                  placeholder="Optional"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(340px,0.85fr)_minmax(0,1.15fr)_minmax(280px,0.5fr)] xl:items-start">
          <div className="grid min-w-0 gap-5">
            <section className="rounded-lg bg-card/90 p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] ring-1 ring-border/45 sm:p-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-foreground">Customer</h3>
                <p className="text-sm text-muted-foreground">
                  Type or select. Both work.
                </p>
              </div>

              <div className="relative mt-4 grid gap-2">
                <Label htmlFor="simple-customer">Customer Name or Phone</Label>
                <Input
                  id="simple-customer"
                  value={customerSearch}
                  onFocus={() => setCustomerSuggestionsOpen(true)}
                  onBlur={() =>
                    window.setTimeout(() => setCustomerSuggestionsOpen(false), 120)
                  }
                  onChange={(event) => handleCustomerSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && customerSuggestions[0]) {
                      event.preventDefault();
                      selectCustomer(customerSuggestions[0]);
                    }
                  }}
                  className="h-12 text-base"
                  placeholder="Start typing customer name"
                />
                {customerSuggestionsOpen ? (
                  <div className="absolute left-0 right-0 top-[4.75rem] z-20 overflow-hidden rounded-lg bg-popover shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)] ring-1 ring-border/70">
                    {customerSuggestions.length > 0 ? (
                      customerSuggestions.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-accent/70"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectCustomer(customer)}
                        >
                          <span className="font-semibold text-foreground">
                            {customer.name}
                          </span>
                          {customer.phone ? (
                            <span className="text-muted-foreground">{customer.phone}</span>
                          ) : null}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-muted-foreground">
                        No saved customer found
                      </p>
                    )}
                    {customerSearch.trim() && !hasExactCustomerMatch ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-t border-border/60 px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-primary/5"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => startAddCustomer(customerSearch)}
                      >
                        <Plus size={16} />
                        Add &quot;{customerSearch.trim()}&quot; as new customer
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => startAddCustomer(customerSearch)}
                >
                  <Plus size={16} />
                  Add New
                </Button>
              </div>

              {addingCustomer ? (
                <div className="mt-4 grid gap-3 rounded-lg bg-muted/35 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <div className="grid gap-2">
                    <Label htmlFor="simple-new-customer-name">Name</Label>
                    <Input
                      id="simple-new-customer-name"
                      value={newCustomerName}
                      onChange={(event) => setNewCustomerName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          newCustomerPhoneRef.current?.focus();
                        }
                      }}
                      className="h-12 text-base"
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="simple-new-customer-phone">Phone</Label>
                    <Input
                      id="simple-new-customer-phone"
                      ref={newCustomerPhoneRef}
                      value={newCustomerPhone}
                      onChange={(event) =>
                        setNewCustomerPhone(event.target.value.replace(/[^\d]/g, ""))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleQuickAddCustomer();
                        }
                      }}
                      className="h-12 text-base"
                      placeholder="Phone number"
                      inputMode="tel"
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-12"
                    disabled={createCustomer.isPending}
                    onClick={() => void handleQuickAddCustomer()}
                  >
                    Use Customer
                  </Button>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg bg-card/90 p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] ring-1 ring-border/45 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Items</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Search saved products or type the item name directly.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={loadLastBill}>
                    <RotateCcw size={16} />
                    Repeat Last Bill
                  </Button>
                  <Button type="button" onClick={() => addItemAfter()}>
                    <Plus size={16} />
                    Add Item
                  </Button>
                </div>
              </div>

              {frequentProducts.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Frequent
                  </span>
                  {frequentProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary ring-1 ring-primary/15 transition hover:bg-primary hover:text-primary-foreground hover:shadow-sm"
                      onClick={() => {
                        const target =
                          items.find((item) => !item.name.trim()) ?? items[items.length - 1];
                        if (!target) return;
                        selectProductForItem(target.id, product);
                        window.setTimeout(
                          () => itemQuantityRefs.current[target.id]?.focus(),
                          0,
                        );
                      }}
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {items.length === 1 && !items[0]?.name.trim() ? (
                  <div className="rounded-lg bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    Start by adding an item
                  </div>
                ) : null}

                {items.map((item, index) => {
                  const lineTotal = toQuantity(item.quantity) * toAmount(item.price);
                  const suggestions = getProductSuggestions(item.name);
                  const hasExactProductMatch = products.some(
                    (product) =>
                      product.name.toLowerCase() === item.name.trim().toLowerCase(),
                  );

                  return (
                    <div
                      key={item.id}
                      className="grid min-w-0 gap-3 rounded-lg bg-background/80 p-3 shadow-[0_14px_34px_-30px_rgba(15,23,42,0.55)] ring-1 ring-border/45 animate-in fade-in slide-in-from-bottom-1 duration-200"
                    >
                      <div className="relative grid min-w-0 gap-2">
                        <Label
                          htmlFor={`simple-item-${item.id}`}
                          className="whitespace-nowrap"
                        >
                          Product Name
                        </Label>
                        <Input
                          id={`simple-item-${item.id}`}
                          ref={(node) => {
                            itemNameRefs.current[item.id] = node;
                          }}
                          value={item.name}
                          onFocus={() => setFocusedItemId(item.id)}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setFocusedItemId((current) =>
                                current === item.id ? null : current,
                              );
                            }, 120);
                          }}
                          onChange={(event) =>
                            handleItemNameChange(item.id, event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              itemQuantityRefs.current[item.id]?.focus();
                            }
                          }}
                          className="h-12 text-base"
                          placeholder={
                            index === 0
                              ? "Type product name (or select)"
                              : "Type product name"
                          }
                        />
                        {focusedItemId === item.id ? (
                          <div className="absolute left-0 right-0 top-[4.75rem] z-10 overflow-hidden rounded-lg bg-popover shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)] ring-1 ring-border/70">
                            {suggestions.length > 0 ? (
                              suggestions.map((product) => (
                                <button
                                  key={product.id}
                                  type="button"
                                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-accent/70"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    selectProductForItem(item.id, product);
                                    window.setTimeout(
                                      () => itemQuantityRefs.current[item.id]?.focus(),
                                      0,
                                    );
                                  }}
                                >
                                  <span className="font-semibold text-foreground">
                                    {product.name}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {formatMoney(Number(product.price) || 0)}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-4 py-3 text-sm text-muted-foreground">
                                No saved product found
                              </p>
                            )}
                            {item.name.trim() && !hasExactProductMatch ? (
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 border-t border-border/60 px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-primary/5"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateItem(item.id, {
                                    name: item.name.trim(),
                                    productId: undefined,
                                  });
                                  itemQuantityRefs.current[item.id]?.focus();
                                }}
                              >
                                <Plus size={16} />
                                Add &quot;{item.name.trim()}&quot; as new product
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid min-w-0 gap-2">
                          <Label
                            htmlFor={`simple-qty-${item.id}`}
                            className="whitespace-nowrap"
                          >
                            Quantity
                          </Label>
                          <Input
                            id={`simple-qty-${item.id}`}
                            ref={(node) => {
                              itemQuantityRefs.current[item.id] = node;
                            }}
                            value={item.quantity}
                            onChange={(event) =>
                              updateItem(item.id, {
                                quantity: event.target.value.replace(/[^\d.]/g, ""),
                              })
                            }
                            onFocus={(event) => event.target.select()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                itemPriceRefs.current[item.id]?.focus();
                              }
                            }}
                            className="h-12 text-base"
                            inputMode="decimal"
                          />
                        </div>
                        <div className="grid min-w-0 gap-2">
                          <Label
                            htmlFor={`simple-price-${item.id}`}
                            className="whitespace-nowrap"
                          >
                            Price
                          </Label>
                          <Input
                            id={`simple-price-${item.id}`}
                            ref={(node) => {
                              itemPriceRefs.current[item.id] = node;
                            }}
                            value={item.price}
                            onChange={(event) =>
                              updateItem(item.id, {
                                price: event.target.value.replace(/[^\d.]/g, ""),
                              })
                            }
                            onFocus={(event) => event.target.select()}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addItemAfter(item.id);
                              }
                            }}
                            className="h-12 text-base"
                            inputMode="decimal"
                            placeholder="0"
                          />
                        </div>
                        <div className="min-w-0 rounded-lg bg-muted/45 px-3 py-3 transition-colors duration-200">
                          <p className="text-xs font-medium text-muted-foreground">Total</p>
                          <p className="mt-1 text-base font-semibold text-foreground transition-all duration-200">
                            {formatMoney(lineTotal)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="justify-self-end self-end"
                          aria-label="Remove item"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg bg-card/90 p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] ring-1 ring-border/45 sm:p-5">
              <h3 className="text-lg font-semibold text-foreground">Payment</h3>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="simple-payment">Payment Method</Label>
                <select
                  id="simple-payment"
                  value={payment}
                  onChange={(event) => setPayment(event.target.value as PaymentChoice)}
                  className="app-field h-12 w-full rounded-lg px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="simple-discount">Discount</Label>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    id="simple-discount"
                    value={discount}
                    onChange={(event) =>
                      setDiscount(event.target.value.replace(/[^\d.]/g, ""))
                    }
                    className="h-12 text-base"
                    placeholder="Discount (₹ or %)"
                    inputMode="decimal"
                  />
                  <div className="flex rounded-lg bg-muted p-1">
                    {(["AMOUNT", "PERCENT"] as DiscountMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`h-10 min-w-10 rounded-md px-3 text-sm font-semibold transition ${
                          discountMode === mode
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setDiscountMode(mode)}
                      >
                        {mode === "AMOUNT" ? "₹" : "%"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 rounded-lg bg-card/90 p-4 shadow-[0_18px_45px_-34px_rgba(15,23,42,0.5)] ring-1 ring-border/45 xl:hidden">
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-12 justify-start text-base font-semibold"
                onClick={handlePreviewBill}
              >
                <Eye size={18} />
                Preview Bill
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-14 text-base font-semibold"
                disabled={isSubmitting}
                onClick={() => void handleGenerateBill()}
              >
                <ReceiptText size={18} />
                {isSubmitting ? "Generating..." : "Generate Bill"}
              </Button>
            </section>
          </div>

          <div className="hidden min-w-0 xl:grid xl:self-start">
            <ExistingInvoicePreview
              data={invoicePreviewData}
              hasItems={validItems.length > 0}
              templateId={activeTemplate.templateId}
              templateName={activeTemplate.templateName}
              enabledSections={activeEnabledSections}
              sectionOrder={activeSectionOrder}
              theme={activeTheme}
              designConfig={activeDesignConfig}
            />
          </div>

          <aside className="hidden min-w-0 xl:sticky xl:top-24 xl:grid xl:self-start">
            <InvoiceTotals
              totals={totals}
              taxMode={taxMode}
              discountValue={invoiceForm.discount}
              discountType={invoiceForm.discount_type}
              className="xl:max-w-[390px]"
              action={
                <div className="mt-6 grid gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="h-15 rounded-[1.2rem] text-base font-semibold shadow-[0_24px_48px_-28px_rgba(37,99,235,0.45)]"
                    disabled={isSubmitting || validItems.length === 0}
                    onClick={() => void handleGenerateBill()}
                  >
                    {isSubmitting ? "Generating..." : t("invoiceComposer.checkout")}
                  </Button>
                  <div className="flex items-center justify-between rounded-[1.15rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-100 dark:ring-emerald-900/40">
                    <span>
                      {validItems.length === 0
                        ? "Add items to see preview"
                        : "Everything looks ready for the final bill."}
                    </span>
                    <span className="font-semibold">
                      {t("invoiceComposer.lineItemsCount", {
                        count: validItems.length,
                      })}
                    </span>
                  </div>
                </div>
              }
            />
          </aside>
        </section>
      </div>

      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Bill Preview"
        description="Review the bill before saving it."
        contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleGenerateBill()}
            >
              <ReceiptText size={16} />
              {isSubmitting ? "Generating..." : "Generate Bill"}
            </Button>
          </>
        }
      >
        <ExistingInvoicePreview
          data={invoicePreviewData}
          hasItems={validItems.length > 0}
          templateId={activeTemplate.templateId}
          templateName={activeTemplate.templateName}
          enabledSections={activeEnabledSections}
          sectionOrder={activeSectionOrder}
          theme={activeTheme}
          designConfig={activeDesignConfig}
        />
      </Modal>
    </DashboardLayout>
  );
};

export default SimpleBillClient;
