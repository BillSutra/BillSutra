"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Download, Plus, Printer, ReceiptText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import TemplatePreviewRenderer from "@/components/invoice/TemplatePreviewRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  type Invoice,
  type InvoiceInput,
  type Product,
} from "@/lib/apiClient";
import {
  formatBusinessAddressFromRecord,
  formatCustomerAddressFromRecord,
} from "@/lib/indianAddress";
import { useInvoiceTotals } from "@/hooks/invoice/useInvoiceTotals";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
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
  initialCustomerName?: string;
  resetOnLoad?: boolean;
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

type SimpleBillDraft = SavedSimpleBill & {
  invoiceDate: string;
  customerSearch: string;
  selectedCustomerId: number | null;
  addingCustomer: boolean;
  newCustomerName: string;
  newCustomerPhone: string;
};

const LAST_CUSTOMER_KEY = "billsutra.simple-bill.last-customer";
const LAST_BILL_KEY = "billsutra.simple-bill.last-bill";
const PRODUCT_USAGE_KEY = "billsutra.simple-bill.product-usage";
const SIMPLE_BILL_DRAFT_KEY = "billsutra.simple-bill.draft.v1";
const INITIAL_ITEM_ID = "simple-bill-item-1";
const WALK_IN_CUSTOMER_PHONE = "9000000000";
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
  customer.phone
    ? `${customer.type === "business" ? customer.businessName || customer.name : customer.name} (${customer.phone})`
    : customer.type === "business"
      ? customer.businessName || customer.name
      : customer.name;

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

const normalizeText = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const parseApiErrorMessage = (error: unknown, fallback: string) => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as
    | { message?: string; errors?: Record<string, string[] | string> }
    | undefined;

  const messages = new Set<string>();

  if (data?.message?.trim()) {
    messages.add(data.message.trim());
  }

  if (data?.errors) {
    Object.values(data.errors).forEach((value) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((entry) => {
        if (typeof entry === "string" && entry.trim()) {
          messages.add(entry.trim());
        }
      });
    });
  }

  return messages.size > 0 ? Array.from(messages).join(" ") : fallback;
};

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
  Boolean(
    item.name.trim() && Number(item.quantity) > 0 && Number(item.price) > 0,
  );

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
  previewCopy,
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
  previewCopy: {
    customerFallback: string;
    discountLabel: string;
    paymentSelectedSuffix: string;
    paymentMethodPrefix: string;
    closingNote: string;
    signatureLabel: string;
  };
}): InvoicePreviewData => {
  const selectedPaymentLabel = paymentLabel(payment);

  return {
    invoiceNumber,
    invoiceDate,
    dueDate,
    business: {
      businessName: businessProfile?.business_name || "BillSutra",
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
      logoUrl: businessProfile?.logo_url ?? "",
      taxId: businessProfile?.tax_id ?? "",
      currency: businessProfile?.currency ?? "INR",
      showLogoOnInvoice: businessProfile?.show_logo_on_invoice ?? false,
      showTaxNumber: businessProfile?.show_tax_number ?? false,
      showPaymentQr: businessProfile?.show_payment_qr ?? false,
    },
    client: {
      name:
        (customer?.type === "business"
          ? customer.businessName || customer.name
          : customer?.name) ||
        fallbackCustomerName ||
        previewCopy.customerFallback,
      type: customer?.type,
      businessName: customer?.businessName ?? customer?.business_name ?? "",
      gstin: customer?.gstin ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? fallbackCustomerPhone,
      address: formatCustomerAddressFromRecord(customer) || "",
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
          ? `${previewCopy.discountLabel} (${Math.min(100, Number(discount) || 0).toFixed(2)}%)`
          : previewCopy.discountLabel,
    },
    paymentSummary: {
      statusLabel: `${selectedPaymentLabel} ${previewCopy.paymentSelectedSuffix}`,
      statusTone: "pending",
      statusNote: `${previewCopy.paymentMethodPrefix}: ${selectedPaymentLabel}`,
      paidAmount: 0,
      remainingAmount: totals.total,
      history: [],
    },
    notes: notes.trim(),
    paymentInfo: `${previewCopy.paymentMethodPrefix}: ${selectedPaymentLabel}`,
    closingNote: previewCopy.closingNote,
    signatureLabel: previewCopy.signatureLabel,
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
  emptyMessage,
}: {
  data: InvoicePreviewData;
  hasItems?: boolean;
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder: SectionKey[];
  theme: InvoiceTheme;
  designConfig: ReturnType<typeof normalizeDesignConfig>;
  emptyMessage: string;
}) => {
  if (!hasItems) {
    return (
      <div className="min-w-0 overflow-hidden rounded-[1.75rem] border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700">
        <div className="flex min-h-136 items-center justify-center rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          {emptyMessage}
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
  initialCustomerName = "",
  resetOnLoad = false,
}: SimpleBillClientProps) => {
  const router = useRouter();
  const { formatDate, language, t } = useI18n();
  const isHindi = language === "hi";
  const copy = useMemo(
    () =>
      isHindi
        ? {
            guestName: "मेहमान",
            customerFallback: "ग्राहक",
            discountLabel: "छूट",
            paymentSelectedSuffix: "चुना गया",
            paymentMethodPrefix: "भुगतान तरीका",
            closingNote: "आपके व्यवसाय के लिए धन्यवाद।",
            signatureLabel: "अधिकृत हस्ताक्षर",
            toastEnterCustomerName: "ग्राहक का नाम दर्ज करें।",
            toastCustomerPhoneMin: "फोन नंबर में ठीक 10 अंक होने चाहिए।",
            toastCustomerQueued: "इनवॉइस बनाते समय ग्राहक जोड़ दिया जाएगा।",
            toastNoSavedBill: "दोहराने के लिए कोई सेव किया हुआ बिल नहीं मिला।",
            toastLastBillLoaded: "पिछला बिल लोड हो गया।",
            toastLoadBillError: "पिछला बिल लोड नहीं हो पाया।",
            toastChooseCustomer: "ग्राहक चुनें या टाइप करें।",
            toastAddItem: "कम से कम एक आइटम कीमत के साथ जोड़ें।",
            toastProductNameMissing: "प्रोडक्ट का नाम खाली है।",
            toastFixLineItems:
              "हर भरे हुए आइटम में नाम, मात्रा और कीमत 0 से अधिक होना चाहिए।",
            toastBillGenerated: "बिल सफलतापूर्वक सेव हुआ ✅",
            toastGenerateError:
              "बिल नहीं बन पाया। जानकारी जांचकर दोबारा कोशिश करें।",
            toastPdfDownloaded: "डाउनलोड हो गया ✅",
            toastPdfError: "PDF डाउनलोड नहीं हो पाया।",
            toastPrintReady: "प्रिंट डायलॉग खुल गया है।",
            toastSelectCustomerFirst: "पहले ग्राहक चुनें या वॉक-इन चुनें।",
            toastGenerateBeforePrint: "पहले बिल जेनरेट और सेव करें।",
            toastWalkInApplied: "वॉक-इन ग्राहक चुना गया।",
            toastWalkInError: "वॉक-इन ग्राहक चुनने में दिक्कत हुई।",
            toastNewBillReady: "नया बिल तैयार है।",
            pageTitle: "सिंपल बिल",
            pageSubtitle: "सेकंडों में बिल बनाएं - टाइप करें या चुनें।",
            previewEmpty: "प्रीव्यू देखने के लिए आइटम जोड़ें",
            generatingBill: "बिल बन रहा है...",
            resetNewBill: "रीसेट / नया बिल",
            generateAndSaveBill: "बिल बनाएं और सेव करें",
            downloadPdf: "PDF डाउनलोड करें",
            printBill: "प्रिंट करें",
            nextStepsTitle: "बिल सेव हो गया। अब आगे क्या करें?",
            nextStepsDescription: "इनवॉइस नंबर: {invoiceNumber}",
            newBill: "नया बिल",
            previewSuccessTitle: "बिल सफलतापूर्वक जेनरेट हो गया",
            previewSuccessDescription:
              "इनवॉइस नंबर: {invoiceNumber}. पूरी डिटेल हिस्ट्री में देखें।",
            viewInHistory: "हिस्ट्री में देखें",
            billPreviewTitle: "बिल प्रीव्यू",
            billPreviewDescription: "सेव करने से पहले बिल जांच लें।",
            useCustomer: "ग्राहक चुनें",
            useWalkInCustomer: "वॉक-इन ग्राहक उपयोग करें",
            walkInCustomerName: "Walk-in Customer",
            repeatLastBill: "पिछला बिल दोहराएं",
            addItem: "प्रोडक्ट जोड़ें",
            previewBill: "बिल प्रीव्यू",
            closeLabel: "बंद करें",
            readyHintEmpty: "प्रीव्यू देखने के लिए आइटम जोड़ें",
            readyHintDone: "फाइनल बिल के लिए सब तैयार है।",
            guidedTitle: "1-2 मिनट में बिल बनाएं",
            guidedDescription:
              "पहले ग्राहक चुनें, फिर प्रोडक्ट जोड़ें, बिल देखें और प्रिंट/डाउनलोड करें।",
            stepCustomer: "स्टेप 1: ग्राहक चुनें",
            stepProducts: "स्टेप 2: प्रोडक्ट जोड़ें",
            stepReview: "स्टेप 3: बिल जांचें",
            stepPrint: "स्टेप 4: प्रिंट / डाउनलोड",
            customerRequiredHint:
              "आगे बढ़ने के लिए पहले ग्राहक चुनें या वॉक-इन ग्राहक चुनें।",
            loadingHint: "डेटा लोड हो रहा है...",
            leaveWarning:
              "आपका बिल ड्राफ्ट सेव है। क्या आप बिना सेव किए बाहर निकलना चाहते हैं?",
            gstHint: "GST वैकल्पिक है (सुझाव: GST चालू रखें अगर रजिस्टर्ड हैं)",
            customerAutoHint:
              "ग्राहक का नाम लिखें। खाली छोड़ेंगे तो वॉक-इन ग्राहक अपने आप जुड़ जाएगा।",
            totalAmountLabel: "कुल राशि",
            previewHint:
              "स्क्रीन के लिए प्रीव्यू। प्रिंट हमेशा साफ़ ब्लैक-एंड-व्हाइट रहेगा।",
          }
        : {
            guestName: "Guest",
            customerFallback: "Customer",
            discountLabel: "Discount",
            paymentSelectedSuffix: "selected",
            paymentMethodPrefix: "Payment method",
            closingNote: "Thank you for your business.",
            signatureLabel: "Authorized Signature",
            toastEnterCustomerName: "Enter the customer name.",
            toastCustomerPhoneMin:
              "Phone number should contain exactly 10 digits.",
            toastCustomerQueued:
              "Customer will be added when the invoice is generated.",
            toastNoSavedBill: "No saved bill to repeat yet.",
            toastLastBillLoaded: "Last bill loaded.",
            toastLoadBillError: "Could not load the last bill.",
            toastChooseCustomer: "Type or select a customer.",
            toastAddItem: "Add at least one item with a price.",
            toastProductNameMissing: "Product name is missing.",
            toastFixLineItems:
              "Each entered item needs a name, quantity above 0, and price above 0.",
            toastBillGenerated: "Bill saved successfully ✅",
            toastGenerateError:
              "Could not generate the bill. Please check the details and try again.",
            toastPdfDownloaded: "Downloaded ✅",
            toastPdfError: "Could not download PDF.",
            toastPrintReady: "Print dialog is open.",
            toastSelectCustomerFirst:
              "Please select a customer first or choose Walk-in Customer.",
            toastGenerateBeforePrint: "Generate and save the bill first.",
            toastWalkInApplied: "Walk-in customer selected.",
            toastWalkInError: "Could not use Walk-in Customer right now.",
            toastNewBillReady: "New bill is ready.",
            pageTitle: "Simple Bill",
            pageSubtitle: "Create bill in seconds - type or select.",
            previewEmpty: "Add items to see preview",
            generatingBill: "Generating Bill...",
            resetNewBill: "Reset / New Bill",
            generateAndSaveBill: "Generate & Save Bill",
            downloadPdf: "Download PDF",
            printBill: "Print Bill",
            nextStepsTitle: "Bill saved. What next?",
            nextStepsDescription: "Invoice number: {invoiceNumber}",
            newBill: "New Bill",
            previewSuccessTitle: "Bill generated successfully",
            previewSuccessDescription:
              "Invoice number: {invoiceNumber}. Open full details in history.",
            viewInHistory: "View in History",
            billPreviewTitle: "Bill Preview",
            billPreviewDescription: "Review the bill before saving it.",
            useCustomer: "Use Customer",
            useWalkInCustomer: "Use Walk-in Customer",
            walkInCustomerName: "Walk-in Customer",
            repeatLastBill: "Repeat Last Bill",
            addItem: "Add Product",
            previewBill: "Preview Bill",
            closeLabel: "Close",
            readyHintEmpty: "Add items to see preview",
            readyHintDone: "Everything looks ready for the final bill.",
            guidedTitle: "Create a bill in 1-2 minutes",
            guidedDescription:
              "Pick customer, add products, review bill, then print or download.",
            stepCustomer: "Step 1: Add Customer",
            stepProducts: "Step 2: Add Products",
            stepReview: "Step 3: Review Bill",
            stepPrint: "Step 4: Print / Download",
            customerRequiredHint:
              "Select a customer first to unlock product entry.",
            loadingHint: "Loading data...",
            leaveWarning:
              "Your draft is saved. Do you want to leave without finishing this bill?",
            gstHint:
              "GST is optional (suggested: keep it ON if GST registered)",
            customerAutoHint:
              "Type customer name. Leave empty to use Walk-in automatically.",
            totalAmountLabel: "Total Amount",
            previewHint:
              "Preview is for screen. Print always stays clean black and white.",
          },
    [isHindi],
  );
  const displayName = name.trim() || copy.guestName;
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
  const { data: businessProfile } = useQuery({
    queryKey: ["business-profile"],
    queryFn: fetchBusinessProfile,
  });
  const { downloadPdf } = useInvoicePdf();
  const createCustomer = useCreateCustomerMutation();
  const createInvoice = useCreateInvoiceMutation();
  const [invoiceDate, setInvoiceDate] = useState(initialInvoiceDate);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [notes, setNotes] = useState("");
  const [customerSearch, setCustomerSearch] = useState(
    initialCustomerName.trim(),
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(
    null,
  );
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
  const [generatedInvoice, setGeneratedInvoice] = useState<Invoice | null>(
    null,
  );
  const [isAssigningWalkIn, setIsAssigningWalkIn] = useState(false);
  const [productUsage, setProductUsage] = useState<Record<number, number>>({});
  const submitLockRef = useRef(false);
  const newCustomerPhoneRef = useRef<HTMLInputElement | null>(null);
  const itemNameRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemQuantityRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const itemPriceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingCustomerPrefillRef = useRef(initialCustomerName.trim());

  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ??
      (createdCustomer?.id === selectedCustomerId ? createdCustomer : null),
    [createdCustomer, customers, selectedCustomerId],
  );

  const walkInCustomer = useMemo(
    () =>
      customers.find((customer) => {
        const normalizedName = normalizeText(customer.name);
        return (
          normalizedName === "walk-in customer" ||
          normalizedName === "walk in customer" ||
          normalizedName === normalizeText(copy.walkInCustomerName)
        );
      }) ?? null,
    [copy.walkInCustomerName, customers],
  );

  const customerSuggestions = useMemo(() => {
    const search = customerSearch.trim();
    if (!search) return customers.slice(0, 5);
    return customers
      .filter(
        (customer) =>
          containsText(customer.name, search) ||
          containsText(customer.phone, search),
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

  const discountType = useMemo(
    () => toDiscountType(discountMode),
    [discountMode],
  );
  const invoiceItems = useMemo(
    () => mapSimpleBillItemsToInvoiceItems(items, gstEnabled),
    [gstEnabled, items],
  );
  const validItems = useMemo(
    () => invoiceItems.filter(isInvoiceItemReady),
    [invoiceItems],
  );
  const hasSelectedCustomer = Boolean(selectedCustomer);
  const hasCustomerContext =
    hasSelectedCustomer ||
    Boolean(customerSearch.trim()) ||
    (addingCustomer && Boolean(newCustomerName.trim()));
  const canGenerateBill = hasCustomerContext && validItems.length > 0;
  const productsLocked = !hasCustomerContext;
  const currentStep = !hasCustomerContext
    ? 1
    : validItems.length === 0
      ? 2
      : previewOpen
        ? 4
        : 3;
  const stepItems = useMemo(
    () => [
      copy.stepCustomer,
      copy.stepProducts,
      copy.stepReview,
      copy.stepPrint,
    ],
    [copy.stepCustomer, copy.stepProducts, copy.stepReview, copy.stepPrint],
  );
  const hasDraftContent = useMemo(
    () =>
      Boolean(
        customerSearch.trim() ||
        selectedCustomerId ||
        notes.trim() ||
        discount.trim() ||
        payment !== "CASH" ||
        gstEnabled ||
        addingCustomer ||
        newCustomerName.trim() ||
        newCustomerPhone.trim() ||
        items.some(
          (item) =>
            item.name.trim() ||
            item.price.trim() ||
            item.productId ||
            (item.quantity.trim() && item.quantity.trim() !== "1"),
        ),
      ),
    [
      addingCustomer,
      customerSearch,
      discount,
      gstEnabled,
      items,
      newCustomerName,
      newCustomerPhone,
      notes,
      payment,
      selectedCustomerId,
    ],
  );
  const isInitialLoading = customersLoading || productsLoading;
  const hasDataLoadError = customersError || productsError;
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
        copy.customerFallback,
      fallbackCustomerPhone: addingCustomer
        ? newCustomerPhone.replace(/\D/g, "")
        : "",
      invoiceNumber:
        generatedInvoice?.invoice_number || t("invoice.invoicePreviewNumber"),
      invoiceDate: previewInvoiceDate,
      dueDate: previewInvoiceDate,
      items: invoiceItems,
      totals,
      discountType,
      discount: invoiceForm.discount,
      payment: selectedPaymentMethod,
      notes,
      previewCopy: {
        customerFallback: copy.customerFallback,
        discountLabel: copy.discountLabel,
        paymentSelectedSuffix: copy.paymentSelectedSuffix,
        paymentMethodPrefix: copy.paymentMethodPrefix,
        closingNote: copy.closingNote,
        signatureLabel: copy.signatureLabel,
      },
    });
  }, [
    addingCustomer,
    copy,
    businessProfile,
    customerSearch,
    discountType,
    invoiceForm.discount,
    invoiceItems,
    generatedInvoice?.invoice_number,
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

    if (resetOnLoad) {
      window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
      return;
    }

    const lastCustomerId = Number(
      window.localStorage.getItem(LAST_CUSTOMER_KEY),
    );
    if (Number.isFinite(lastCustomerId) && lastCustomerId > 0) {
      setSelectedCustomerId(lastCustomerId);
    }

    const storedDraft = window.localStorage.getItem(SIMPLE_BILL_DRAFT_KEY);
    if (!storedDraft) {
      return;
    }

    try {
      const draft = JSON.parse(storedDraft) as Partial<SimpleBillDraft>;

      if (typeof draft.invoiceDate === "string" && draft.invoiceDate) {
        setInvoiceDate(draft.invoiceDate);
      }
      if (typeof draft.customerSearch === "string") {
        setCustomerSearch(draft.customerSearch);
      }
      if (
        typeof draft.selectedCustomerId === "number" &&
        Number.isFinite(draft.selectedCustomerId) &&
        draft.selectedCustomerId > 0
      ) {
        setSelectedCustomerId(draft.selectedCustomerId);
      } else if (draft.selectedCustomerId === null) {
        setSelectedCustomerId(null);
      }
      if (typeof draft.addingCustomer === "boolean") {
        setAddingCustomer(draft.addingCustomer);
      }
      if (typeof draft.newCustomerName === "string") {
        setNewCustomerName(draft.newCustomerName);
      }
      if (typeof draft.newCustomerPhone === "string") {
        setNewCustomerPhone(draft.newCustomerPhone);
      }
      if (typeof draft.discount === "string") {
        setDiscount(draft.discount);
      }
      if (draft.discountMode === "AMOUNT" || draft.discountMode === "PERCENT") {
        setDiscountMode(draft.discountMode);
      }
      if (typeof draft.gstEnabled === "boolean") {
        setGstEnabled(draft.gstEnabled);
      }
      if (typeof draft.notes === "string") {
        setNotes(draft.notes);
      }
      if (
        draft.payment === "CASH" ||
        draft.payment === "UPI" ||
        draft.payment === "ONLINE"
      ) {
        setPayment(draft.payment);
      }
      if (Array.isArray(draft.items) && draft.items.length > 0) {
        setItems(
          draft.items.map((item) => ({
            id: item.id || createItem().id,
            productId:
              typeof item.productId === "number" &&
              Number.isFinite(item.productId)
                ? item.productId
                : undefined,
            name: item.name ?? "",
            quantity: item.quantity ?? "1",
            price: item.price ?? "",
          })),
        );
      }
    } catch {
      window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
    }
  }, [resetOnLoad]);

  useEffect(() => {
    if (!selectedCustomer) return;
    setCustomerSearch(customerLabel(selectedCustomer));
  }, [selectedCustomer]);

  useEffect(() => {
    if (!hasDraftContent) {
      window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
      return;
    }

    const draft: SimpleBillDraft = {
      invoiceDate,
      customerSearch,
      selectedCustomerId,
      addingCustomer,
      newCustomerName,
      newCustomerPhone,
      customerId: selectedCustomerId ?? undefined,
      customerName: selectedCustomer?.name ?? customerSearch,
      payment,
      discount,
      discountMode,
      gstEnabled,
      notes,
      items,
    };

    window.localStorage.setItem(SIMPLE_BILL_DRAFT_KEY, JSON.stringify(draft));
  }, [
    addingCustomer,
    customerSearch,
    discount,
    discountMode,
    gstEnabled,
    hasDraftContent,
    invoiceDate,
    items,
    newCustomerName,
    newCustomerPhone,
    notes,
    payment,
    selectedCustomer?.name,
    selectedCustomerId,
  ]);

  useEffect(() => {
    if (!hasDraftContent) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = copy.leaveWarning;
      return copy.leaveWarning;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [copy.leaveWarning, hasDraftContent]);

  const updateItem = useCallback(
    (id: string, patch: Partial<SimpleBillItem>) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const selectCustomer = useCallback((customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setCreatedCustomer((current) =>
      current?.id === customer.id ? current : null,
    );
    setCustomerSearch(customerLabel(customer));
    setNewCustomerName("");
    setNewCustomerPhone("");
    setAddingCustomer(false);
    setCustomerSuggestionsOpen(false);
  }, []);

  useEffect(() => {
    const pendingPrefill = pendingCustomerPrefillRef.current.trim();
    if (!pendingPrefill || customers.length === 0 || selectedCustomerId) {
      return;
    }

    const normalizedPrefill = pendingPrefill.toLowerCase();
    const exactMatch = customers.find(
      (customer) => customer.name.toLowerCase() === normalizedPrefill,
    );

    if (exactMatch) {
      selectCustomer(exactMatch);
    } else {
      setCustomerSearch(pendingPrefill);
    }

    pendingCustomerPrefillRef.current = "";
  }, [customers, selectCustomer, selectedCustomerId]);

  const ensureWalkInCustomer = useCallback(async () => {
    if (walkInCustomer) {
      selectCustomer(walkInCustomer);
      return walkInCustomer;
    }

    const created = await createCustomer.mutateAsync({
      name: copy.walkInCustomerName,
      phone: WALK_IN_CUSTOMER_PHONE,
    });
    selectCustomer(created);
    return created;
  }, [copy.walkInCustomerName, createCustomer, selectCustomer, walkInCustomer]);

  const handleUseWalkInCustomer = useCallback(async () => {
    if (isAssigningWalkIn) {
      return;
    }

    try {
      setIsAssigningWalkIn(true);
      await ensureWalkInCustomer();
      toast.success(copy.toastWalkInApplied);
    } catch {
      toast.error(copy.toastWalkInError);
    } finally {
      setIsAssigningWalkIn(false);
    }
  }, [
    copy.toastWalkInApplied,
    copy.toastWalkInError,
    ensureWalkInCustomer,
    isAssigningWalkIn,
  ]);

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
      toast.error(copy.toastEnterCustomerName);
      return;
    }

    const normalizedPhone = newCustomerPhone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error(copy.toastCustomerPhoneMin);
      return;
    }

    setCustomerSearch(
      normalizedPhone
        ? `${newCustomerName.trim()} (${normalizedPhone})`
        : newCustomerName.trim(),
    );
    setCustomerSuggestionsOpen(false);
    toast.success(copy.toastCustomerQueued);
  };

  const loadLastBill = () => {
    const stored = window.localStorage.getItem(LAST_BILL_KEY);
    if (!stored) {
      toast.info(copy.toastNoSavedBill);
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
      toast.success(copy.toastLastBillLoaded);
    } catch {
      toast.error(copy.toastLoadBillError);
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
    if (
      isSubmitting ||
      createInvoice.isPending ||
      createCustomer.isPending ||
      submitLockRef.current
    ) {
      return;
    }

    if (!hasCustomerContext) {
      toast.error(copy.toastChooseCustomer);
      return;
    }

    const enteredInvoiceItems = invoiceItems.filter((item) =>
      Boolean(
        item.name.trim() ||
        item.product_id ||
        Number(item.quantity) > 1 ||
        Number(item.price) > 0,
      ),
    );

    const hasInvalidLineItems = enteredInvoiceItems.some(
      (item) =>
        !item.name.trim() ||
        Number(item.quantity) <= 0 ||
        Number(item.price) <= 0,
    );

    if (hasInvalidLineItems) {
      toast.error(copy.toastFixLineItems);
      return;
    }

    const hasMissingProductName = invoiceItems.some(
      (item) =>
        !item.name.trim() &&
        (Number(item.quantity) > 0 ||
          Number(item.price) > 0 ||
          item.product_id),
    );
    if (hasMissingProductName) {
      toast.error(copy.toastProductNameMissing);
      return;
    }

    if (validItems.length === 0) {
      toast.error(copy.toastAddItem);
      return;
    }

    try {
      submitLockRef.current = true;
      setIsSubmitting(true);

      let customer: Customer | null = selectedCustomer;

      if (!customer && addingCustomer && newCustomerName.trim()) {
        const normalizedPhone = newCustomerPhone.replace(/\D/g, "");
        if (!/^\d{10}$/.test(normalizedPhone)) {
          toast.error(copy.toastCustomerPhoneMin);
          return;
        }

        customer = await createCustomer.mutateAsync({
          name: newCustomerName.trim(),
          phone: normalizedPhone,
        });
      }

      if (!customer) {
        const typedCustomerName = customerSearch.trim();
        if (typedCustomerName) {
          customer = await createCustomer.mutateAsync({
            name: typedCustomerName,
            phone: WALK_IN_CUSTOMER_PHONE,
          });
          selectCustomer(customer);
        } else {
          customer = await ensureWalkInCustomer();
        }
      }

      if (!customer) {
        toast.error(copy.toastChooseCustomer);
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
      setGeneratedInvoice(createdInvoice);
      setPreviewOpen(true);
      toast.success(copy.toastBillGenerated);
      window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
      router.refresh();
    } catch (error) {
      toast.error(parseApiErrorMessage(error, copy.toastGenerateError));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleCreateNewBill = useCallback(() => {
    setInvoiceDate(todayInputValue());
    setCustomerSearch("");
    setSelectedCustomerId(null);
    setCreatedCustomer(null);
    setAddingCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setItems([createItem(INITIAL_ITEM_ID)]);
    setDiscount("");
    setDiscountMode("AMOUNT");
    setPayment("CASH");
    setGstEnabled(false);
    setNotes("");
    setGeneratedInvoice(null);
    setPreviewOpen(false);
    setFocusedItemId(null);
    window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
    toast.success(copy.toastNewBillReady);
  }, [copy.toastNewBillReady]);

  const handlePrintBill = () => {
    if (!generatedInvoice) {
      toast.error(copy.toastGenerateBeforePrint);
      return;
    }

    if (!hasCustomerContext) {
      toast.error(copy.toastSelectCustomerFirst);
      return;
    }

    if (validItems.length === 0) {
      toast.error(copy.toastAddItem);
      return;
    }

    window.print();
    toast.success(copy.toastPrintReady);
  };

  const handleDownloadBill = async () => {
    if (!generatedInvoice) {
      toast.error(copy.toastGenerateBeforePrint);
      return;
    }

    if (!hasCustomerContext) {
      toast.error(copy.toastSelectCustomerFirst);
      return;
    }

    if (validItems.length === 0) {
      toast.error(copy.toastAddItem);
      return;
    }

    try {
      await downloadPdf({
        previewPayload: {
          templateId: activeTemplate.templateId,
          templateName: activeTemplate.templateName,
          data: invoicePreviewData,
          enabledSections: activeEnabledSections,
          sectionOrder: activeSectionOrder,
          theme: activeTheme,
          designConfig: activeDesignConfig,
        },
        fileName: `${generatedInvoice.invoice_number || invoicePreviewData.invoiceNumber || "bill"}.pdf`,
      });
      toast.success(copy.toastPdfDownloaded);
    } catch {
      toast.error(copy.toastPdfError);
    }
  };

  const handleRetryDataLoad = useCallback(() => {
    void Promise.all([refetchCustomers(), refetchProducts()]);
  }, [refetchCustomers, refetchProducts]);

  return (
    <DashboardLayout
      name={displayName}
      image={image}
      title={copy.pageTitle}
      subtitle={copy.pageSubtitle}
    >
      <div className="mx-auto grid w-full max-w-5xl gap-5">
        <section className="rounded-2xl bg-card/92 p-5 ring-1 ring-border/55">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div>
              <p className="text-base font-semibold text-foreground">
                {copy.guidedTitle}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {copy.guidedDescription}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {isHindi
                  ? "बिल नंबर सेव करते समय अपने आप बनेगा"
                  : "Bill number is generated automatically when you save."}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="simple-invoice-date">
                {isHindi ? "बिल तारीख" : "Bill Date"}
              </Label>
              <Input
                id="simple-invoice-date"
                type="date"
                aria-label="Bill date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                className="h-11"
              />
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-12 text-base font-semibold"
                onClick={handleCreateNewBill}
              >
                {copy.resetNewBill}
              </Button>
            </div>
          </div>

          {hasDataLoadError ? (
            <div className="mt-3 rounded-lg border border-amber-300/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
              <p className="font-semibold">
                {isHindi
                  ? "ग्राहक या प्रोडक्ट डेटा लोड नहीं हुआ"
                  : "Customer or product data failed to load"}
              </p>
              <p className="mt-1 text-xs opacity-90">
                {isHindi
                  ? "कृपया दोबारा कोशिश करें।"
                  : "Please retry to continue with full data."}
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={handleRetryDataLoad}
              >
                {isHindi ? "फिर से लोड करें" : "Retry loading"}
              </Button>
            </div>
          ) : isInitialLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {copy.loadingHint}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl bg-card/92 p-5 ring-1 ring-border/55">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-foreground">
              {copy.stepCustomer}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isHindi
                ? "नाम या फोन लिखें और ग्राहक चुनें।"
                : "Type name/phone and choose customer."}
            </p>
          </div>

          <div className="relative mt-4 grid gap-2">
            <Label htmlFor="simple-customer">
              {isHindi ? "ग्राहक नाम या फोन" : "Customer Name or Phone"}
            </Label>
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
              placeholder={
                isHindi
                  ? "ग्राहक का नाम लिखना शुरू करें"
                  : "Start typing customer name"
              }
            />
            {customerSuggestionsOpen ? (
              <div className="absolute left-0 right-0 top-19 z-20 overflow-hidden rounded-lg bg-popover shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)] ring-1 ring-border/70">
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
                        <span className="text-muted-foreground">
                          {customer.phone}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    {isHindi
                      ? "कोई सेव ग्राहक नहीं मिला"
                      : "No saved customer found"}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {copy.customerAutoHint}
          </p>
        </section>

        <section className="rounded-2xl bg-card/92 p-5 ring-1 ring-border/55">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {copy.stepProducts}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isHindi
                  ? "प्रोडक्ट का नाम, मात्रा और कीमत डालें।"
                  : "Add product name, quantity, and price."}
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              className="h-11 font-semibold"
              disabled={productsLocked}
              onClick={() => addItemAfter()}
            >
              <Plus size={16} />
              {copy.addItem}
            </Button>
          </div>

          {productsLocked ? (
            <div className="mt-4 rounded-lg bg-muted/45 px-4 py-3 text-sm text-muted-foreground">
              {copy.customerRequiredHint}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {items.length === 1 && !items[0]?.name.trim() ? (
              <div className="rounded-lg bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                {isHindi ? "पहला प्रोडक्ट जोड़ें" : "Start by adding a product"}
              </div>
            ) : null}

            {!productsLocked &&
              items.map((item, index) => {
                const lineTotal =
                  toQuantity(item.quantity) * toAmount(item.price);
                const suggestions = getProductSuggestions(item.name);
                const hasExactProductMatch = products.some(
                  (product) =>
                    product.name.toLowerCase() ===
                    item.name.trim().toLowerCase(),
                );

                return (
                  <div
                    key={item.id}
                    className="grid min-w-0 gap-3 rounded-lg bg-background/80 p-3 ring-1 ring-border/45"
                  >
                    <div className="relative grid min-w-0 gap-2">
                      <Label
                        htmlFor={`simple-item-${item.id}`}
                        className="whitespace-nowrap"
                      >
                        {isHindi ? "प्रोडक्ट नाम" : "Product Name"}
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
                            ? isHindi
                              ? "प्रोडक्ट नाम लिखें"
                              : "Type product name"
                            : isHindi
                              ? "प्रोडक्ट नाम"
                              : "Product name"
                        }
                      />
                      {focusedItemId === item.id ? (
                        <div className="absolute left-0 right-0 top-19 z-10 overflow-hidden rounded-lg bg-popover shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)] ring-1 ring-border/70">
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
                                    () =>
                                      itemQuantityRefs.current[
                                        item.id
                                      ]?.focus(),
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
                              {isHindi
                                ? "कोई सेव प्रोडक्ट नहीं मिला"
                                : "No saved product found"}
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
                              {isHindi
                                ? `\"${item.name.trim()}\" जोड़ें`
                                : `Add \"${item.name.trim()}\"`}
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
                          {isHindi ? "मात्रा" : "Quantity"}
                        </Label>
                        <Input
                          id={`simple-qty-${item.id}`}
                          ref={(node) => {
                            itemQuantityRefs.current[item.id] = node;
                          }}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.id, {
                              quantity: event.target.value.replace(
                                /[^\d.]/g,
                                "",
                              ),
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
                          {isHindi ? "कीमत" : "Price"}
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
                      <div className="min-w-0 rounded-lg bg-muted/45 px-3 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {isHindi ? "लाइन टोटल" : "Line Total"}
                        </p>
                        <p className="mt-1 text-base font-semibold text-foreground">
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

        <section className="rounded-2xl bg-card/95 p-5 ring-1 ring-border/55">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)] md:items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {copy.totalAmountLabel}
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {formatMoney(totals.total)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("invoiceComposer.lineItemsCount", {
                  count: validItems.length,
                })}
              </p>
            </div>
            <div className="grid gap-2">
              <Button
                type="button"
                size="lg"
                className="h-12 w-full bg-slate-900 text-base font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={
                  isSubmitting ||
                  createInvoice.isPending ||
                  createCustomer.isPending ||
                  !canGenerateBill
                }
                onClick={() => void handleGenerateBill()}
              >
                <ReceiptText size={18} />
                {isSubmitting ? copy.generatingBill : copy.generateAndSaveBill}
              </Button>

              {generatedInvoice ? (
                <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <p className="text-sm font-semibold text-foreground">
                    {copy.nextStepsTitle}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {copy.nextStepsDescription.replace(
                      "{invoiceNumber}",
                      generatedInvoice.invoice_number,
                    )}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleDownloadBill()}
                    >
                      <Download size={16} />
                      {copy.downloadPdf}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrintBill}
                    >
                      <Printer size={16} />
                      {copy.printBill}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCreateNewBill}
                    >
                      <Plus size={16} />
                      {copy.newBill}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-card/92 p-5 ring-1 ring-border/55">
          <h3 className="text-lg font-semibold text-foreground">
            {copy.billPreviewTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.previewHint}
          </p>

          {generatedInvoice ? (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50/70 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-800/70 dark:bg-emerald-950/20">
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {copy.previewSuccessTitle}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  {copy.previewSuccessDescription.replace(
                    "{invoiceNumber}",
                    generatedInvoice.invoice_number,
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() =>
                  router.push(`/invoices/history/${generatedInvoice.id}`)
                }
              >
                {copy.viewInHistory}
              </Button>
            </div>
          ) : null}

          <div className="mt-4">
            <ExistingInvoicePreview
              data={invoicePreviewData}
              hasItems={validItems.length > 0}
              templateId={activeTemplate.templateId}
              templateName={activeTemplate.templateName}
              enabledSections={activeEnabledSections}
              sectionOrder={activeSectionOrder}
              theme={activeTheme}
              designConfig={activeDesignConfig}
              emptyMessage={copy.previewEmpty}
            />
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default SimpleBillClient;
