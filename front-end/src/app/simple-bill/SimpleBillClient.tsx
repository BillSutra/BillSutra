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
import Modal from "@/components/ui/modal";
import {
  useCustomerSearchQuery,
  useCreateCustomerMutation,
  useCreateInvoiceMutation,
  useProductsQuery,
} from "@/hooks/useInventoryQueries";
import { useActiveInvoiceTemplate } from "@/hooks/invoice/useActiveInvoiceTemplate";
import {
  fetchBusinessProfile,
  fetchCustomers,
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
import { getStateFromGstin } from "@/lib/gstin";
import { resolveBackendAssetUrl } from "@/lib/backendAssetUrl";
import { useInvoicePdf } from "@/hooks/invoice/useInvoicePdf";
import { useI18n } from "@/providers/LanguageProvider";
import type {
  DiscountType,
  InvoiceItemForm,
  InvoiceTotals,
  TaxMode,
} from "@/types/invoice";
import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";
import {
  calculateInvoiceTotals,
  getDiscountValidationMessage,
} from "../../../../shared/invoice-calculations";

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
  gstRate: string;
  gstType: "CGST_SGST" | "IGST";
};

type PaymentChoice = "CASH" | "UPI" | "ONLINE";
type SimplePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";
type InvoicePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER";
type DiscountMode = "AMOUNT" | "PERCENT";

type SavedSimpleBill = {
  customerId?: number;
  customerName?: string;
  selectedCustomer?: Customer | null;
  paymentMethod: PaymentChoice;
  paymentStatus: SimplePaymentStatus;
  paidAmount: number;
  paymentDate: string;
  discount: string;
  discountMode: DiscountMode;
  gstEnabled: boolean;
  taxMode: TaxMode;
  notes: string;
  items: SimpleBillItem[];
};

type SimpleBillDraft = SavedSimpleBill & {
  invoiceDate: string;
  customerSearch: string;
  selectedCustomerId: number | null;
  selectedCustomer?: Customer | null;
  addingCustomer: boolean;
  newCustomerName: string;
  newCustomerPhone: string;
  newCustomerEmail?: string;
};

type BillState = {
  customer: Customer | null;
  items: SimpleBillItem[];
  totalAmount: number;
  paymentStatus: SimplePaymentStatus;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentChoice;
  paymentDate: string;
  discount: string;
  discountMode: DiscountMode;
  gstEnabled: boolean;
  taxMode: TaxMode;
  gstRate: string;
  pricesInclusiveOfTax: boolean;
  notes: string;
  invoiceDate: string;
};

const LAST_CUSTOMER_KEY = "billsutra.simple-bill.last-customer";
const LAST_BILL_KEY = "billsutra.simple-bill.last-bill";
const PRODUCT_USAGE_KEY = "billsutra.simple-bill.product-usage";
const SIMPLE_BILL_DRAFT_KEY = "billsutra.simple-bill.draft.v1";
const INITIAL_ITEM_ID = "simple-bill-item-1";
const WALK_IN_CUSTOMER_PHONE = "9000000000";
const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;
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

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const normalizeGstType = (
  value: string | null | undefined,
): "CGST_SGST" | "IGST" => (value === "IGST" ? "IGST" : "CGST_SGST");

const createItem = (
  id?: string,
  defaults?: Partial<Pick<SimpleBillItem, "gstRate" | "gstType">>,
): SimpleBillItem => ({
  id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name: "",
  quantity: "1",
  price: "",
  gstRate: defaults?.gstRate ?? "18",
  gstType: defaults?.gstType ?? "CGST_SGST",
});

const createInitialBillState = (invoiceDate: string): BillState => ({
  customer: null,
  items: [createItem(INITIAL_ITEM_ID)],
  totalAmount: 0,
  paymentStatus: "PAID",
  paidAmount: 0,
  dueAmount: 0,
  paymentMethod: "CASH",
  paymentDate: invoiceDate || todayInputValue(),
  discount: "",
  discountMode: "AMOUNT",
  gstEnabled: false,
  taxMode: "CGST_SGST",
  gstRate: "18",
  pricesInclusiveOfTax: false,
  notes: "",
  invoiceDate,
});

const toAmount = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const toQuantity = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, numberValue) : 1;
};

const toGstRate = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

type SimpleBillTotals = {
  subtotal: number;
  discount: number;
  taxableValue: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const calculateSimpleBillTotals = ({
  items,
  discountValue,
  discountType,
  taxMode,
  pricesInclusiveOfTax,
}: {
  items: Array<{
    quantity: string;
    price: string;
    gstRate?: string;
    gstType?: "CGST_SGST" | "IGST";
  }>;
  discountValue: string;
  discountType: DiscountMode;
  taxMode: "CGST_SGST" | "IGST" | "NONE";
  pricesInclusiveOfTax: boolean;
}): SimpleBillTotals => {
  const lineDetails = items
    .map((item) => {
      const quantity = Math.max(1, toQuantity(item.quantity));
      const unitPrice = Math.max(0, toAmount(item.price));
      const rate = taxMode !== "NONE" ? toGstRate(item.gstRate ?? "0") : 0;
      const lineTaxMode =
        taxMode === "NONE" ? "NONE" : normalizeGstType(item.gstType);

      if (pricesInclusiveOfTax && rate > 0) {
        const basePrice = roundCurrency(unitPrice / (1 + rate / 100));
        const lineSubtotal = roundCurrency(basePrice * quantity);
        const lineTax = roundCurrency(lineSubtotal * (rate / 100));
        return {
          lineSubtotal,
          lineTax,
          lineTotal: roundCurrency(unitPrice * quantity),
          lineTaxMode,
        };
      }

      const lineSubtotal = roundCurrency(unitPrice * quantity);
      const lineTax =
        lineTaxMode === "NONE" ? 0 : roundCurrency((lineSubtotal * rate) / 100);
      return {
        lineSubtotal,
        lineTax,
        lineTotal: roundCurrency(lineSubtotal + lineTax),
        lineTaxMode,
      };
    })
    .filter((d) => d.lineSubtotal > 0);

  const subtotal = roundCurrency(
    lineDetails.reduce((sum, d) => sum + d.lineSubtotal, 0),
  );

  let discount = 0;
  if (discountValue && Number(discountValue) > 0) {
    if (discountType === "PERCENT") {
      discount = roundCurrency((subtotal * Math.min(100, Number(discountValue))) / 100);
    } else {
      discount = roundCurrency(Math.min(subtotal, Number(discountValue)));
    }
  }

  const taxableValue = roundCurrency(Math.max(0, subtotal - discount));
  const tax = roundCurrency(lineDetails.reduce((sum, d) => sum + d.lineTax, 0));
  const cgst = roundCurrency(
    lineDetails.reduce(
      (sum, d) => sum + (d.lineTaxMode === "CGST_SGST" ? d.lineTax / 2 : 0),
      0,
    ),
  );
  const sgst = roundCurrency(
    lineDetails.reduce(
      (sum, d) => sum + (d.lineTaxMode === "CGST_SGST" ? d.lineTax / 2 : 0),
      0,
    ),
  );
  const igst = roundCurrency(
    lineDetails.reduce(
      (sum, d) => sum + (d.lineTaxMode === "IGST" ? d.lineTax : 0),
      0,
    ),
  );
  const total = roundCurrency(Math.max(0, taxableValue + tax));

  return { subtotal, discount, taxableValue, tax, cgst, sgst, igst, total };
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

const toInvoicePaymentMethod = (
  paymentMethod: PaymentChoice,
): InvoicePaymentMethod => {
  if (paymentMethod === "UPI") return "UPI";
  if (paymentMethod === "ONLINE") return "BANK_TRANSFER";
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

const CUSTOMER_NAME_PATTERN = /^[\p{L}\p{M}\s.'-]+$/u;

const parseCustomerPrefill = (value: string) => {
  const trimmedValue = value.trim();
  const normalizedPhone = trimmedValue.replace(/\D/g, "");
  const isPhoneLike = /^\d{10}$/.test(normalizedPhone);

  return {
    name: isPhoneLike ? "" : trimmedValue,
    phone: isPhoneLike ? normalizedPhone : "",
  };
};

const matchesSelectedCustomerInput = (
  customer: Customer | null,
  value: string,
) => {
  const normalizedValue = normalizeText(value);
  if (!customer || !normalizedValue) return false;

  return [
    customer.name,
    customer.phone,
    customer.display_name,
    customer.businessName,
    customer.business_name,
    customerLabel(customer),
  ].some((entry) => normalizeText(entry) === normalizedValue);
};

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
    tax_rate: gstEnabled ? String(toGstRate(item.gstRate)) : "",
    gst_type: gstEnabled ? item.gstType : "NONE",
  }));

const isInvoiceItemReady = (item: InvoiceItemForm) =>
  Boolean(
    item.name.trim() && Number(item.quantity) > 0 && Number(item.price) > 0,
  );

const normalizeBillState = (billState: BillState): BillState => {
  const normalizedItems =
    billState.items.length > 0 ? billState.items : [createItem(INITIAL_ITEM_ID)];
  const totals = calculateInvoiceTotals({
    items: mapSimpleBillItemsToInvoiceItems(normalizedItems, billState.gstEnabled),
    discountValue: billState.discount || "0",
    discountType: toDiscountType(billState.discountMode),
    taxMode: billState.gstEnabled ? billState.taxMode : "NONE",
  });
  const normalizedPaidAmount =
    billState.paymentStatus === "PAID"
      ? totals.total
      : billState.paymentStatus === "PARTIALLY_PAID"
        ? Math.min(Math.max(billState.paidAmount || 0, 0), totals.total)
        : 0;

  return {
    ...billState,
    items: normalizedItems,
    totalAmount: totals.total,
    paidAmount: normalizedPaidAmount,
    dueAmount: Math.max(totals.total - normalizedPaidAmount, 0),
    paymentMethod: billState.paymentMethod || "CASH",
    paymentDate:
      billState.paymentDate || billState.invoiceDate || todayInputValue(),
    taxMode:
      normalizeGstType(billState.taxMode),
  };
};

const mapPaymentStatusToInvoiceStatus = (status: SimplePaymentStatus) => {
  if (status === "PAID") return "PAID";
  if (status === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "SENT";
};

const mapSimpleBillToInvoice = ({
  customerId,
  invoiceDate,
  discount,
  discountType,
  taxMode,
  paymentStatus,
  paidAmount,
  paymentDate,
  paymentMethod,
  totalAmount,
  notes,
  items,
}: {
  customerId: number;
  invoiceDate: string;
  discount: string;
  discountType: DiscountType;
  taxMode: TaxMode;
  paymentStatus: SimplePaymentStatus;
  paidAmount: number;
  paymentDate: string;
  paymentMethod: InvoicePaymentMethod;
  totalAmount: number;
  notes: string;
  items: InvoiceItemForm[];
}): InvoiceInput => {
  const normalizedPaidAmount =
    paymentStatus === "PAID"
      ? totalAmount
      : paymentStatus === "PARTIALLY_PAID"
        ? Math.max(0, paidAmount)
        : 0;

  return {
    customer_id: customerId,
    date: invoiceDate || todayInputValue(),
    due_date: invoiceDate || todayInputValue(),
    discount: Number(discount) || undefined,
    discount_type: discountType,
    tax_mode: taxMode,
    payment_status: paymentStatus,
    amount_paid: paymentStatus === "UNPAID" ? undefined : normalizedPaidAmount,
    payment_method: paymentStatus === "UNPAID" ? undefined : paymentMethod,
    payment_date: paymentStatus === "UNPAID" ? undefined : paymentDate,
    notes: notes.trim() || undefined,
    status: mapPaymentStatusToInvoiceStatus(paymentStatus),
    sync_sales: true,
    items: items.filter(isInvoiceItemReady).map((item) => ({
      product_id: item.product_id ? Number(item.product_id) : undefined,
      name: item.name.trim(),
      quantity: Number(item.quantity),
      price: Number(item.price),
      tax_rate: item.tax_rate ? Number(item.tax_rate) : undefined,
      gst_type: item.gst_type === "NONE" ? undefined : item.gst_type,
    })),
  };
};

const buildSimpleBillInvoicePreviewData = ({
  businessProfile,
  customer,
  fallbackCustomerName,
  fallbackCustomerPhone,
  invoiceNumber,
  invoiceDate,
  dueDate,
  totals,
  taxMode,
  discountType,
  discount,
  paymentStatus,
  paidAmount,
  paymentDate,
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
  totals: InvoiceTotals;
  taxMode: TaxMode;
  discountType: DiscountType;
  discount: string;
  paymentStatus: SimplePaymentStatus;
  paidAmount: number;
  paymentDate: string;
  payment: InvoicePaymentMethod;
  notes: string;
  previewCopy: {
    customerFallback: string;
    discountLabel: string;
    pendingLabel: string;
    paidLabel: string;
    partiallyPaidLabel: string;
    awaitingPayment: string;
    paymentMethodPrefix: string;
    closingNote: string;
    signatureLabel: string;
  };
}): InvoicePreviewData => {
  const selectedPaymentLabel = paymentLabel(payment);
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
  const normalizedPaidAmount =
    paymentStatus === "PAID"
      ? totals.total
      : paymentStatus === "PARTIALLY_PAID"
        ? Math.min(Math.max(paidAmount, 0), totals.total)
        : 0;
  const remainingAmount = Math.max(totals.total - normalizedPaidAmount, 0);
  const paymentSummaryStatusLabel =
    paymentStatus === "PAID"
      ? previewCopy.paidLabel
      : paymentStatus === "PARTIALLY_PAID"
        ? previewCopy.partiallyPaidLabel
        : previewCopy.pendingLabel;
  const paymentSummaryTone =
    paymentStatus === "PAID"
      ? "paid"
      : paymentStatus === "PARTIALLY_PAID"
        ? "partial"
        : "pending";
  const paymentSummaryNote =
    paymentStatus === "UNPAID"
      ? previewCopy.awaitingPayment
      : `${previewCopy.paymentMethodPrefix}: ${selectedPaymentLabel}`;

  return {
    invoiceTitle: taxMode === "NONE" ? "Bill" : "Tax Invoice",
    invoiceNumber,
    invoiceDate,
    dueDate,
    placeOfSupply: customerState || businessState || "",
    taxMode,
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
      logoUrl: resolveBackendAssetUrl(businessProfile?.logo_url),
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
    items: (totals.items ?? [])
      .filter((item) => item.name.trim() && item.quantity > 0 && item.price > 0)
      .map((item) => ({
        name: item.name.trim(),
        description:
          item.gst_type === "NONE"
            ? "GST: 0%"
            : item.gst_type === "IGST"
              ? `IGST ${item.tax_rate ?? 0}%: ${formatMoney(item.igst)}`
              : `CGST ${(item.tax_rate ?? 0) / 2}%: ${formatMoney(item.cgst)} | SGST ${(item.tax_rate ?? 0) / 2}%: ${formatMoney(item.sgst)}`,
        quantity: item.quantity,
        unitPrice: item.price,
        gstType: item.gst_type,
        baseAmount: item.baseAmount,
        gstAmount: item.lineTax,
        cgstAmount: item.cgst,
        sgstAmount: item.sgst,
        igstAmount: item.igst,
        taxableValue: item.baseAmount,
        taxRate: item.tax_rate ?? 0,
        amount: item.lineTotal,
      })),
    totals: {
      ...totals,
      totalBase: totals.totalBase ?? totals.subtotal,
      grandTotal: totals.total,
      roundOff: 0,
    },
    discount: {
      type: discountType,
      value: Number(discount) || 0,
      label:
        discountType === "PERCENTAGE"
          ? `${previewCopy.discountLabel} (${Math.min(100, Number(discount) || 0).toFixed(2)}%)`
          : previewCopy.discountLabel,
    },
    paymentSummary: {
      statusLabel: paymentSummaryStatusLabel,
      statusTone: paymentSummaryTone,
      statusNote: paymentSummaryNote,
      paidAmount: normalizedPaidAmount,
      remainingAmount,
      history:
        normalizedPaidAmount > 0
          ? [
              {
                id: "simple-bill-payment",
                amount: normalizedPaidAmount,
                paidAt: paymentDate,
                method: selectedPaymentLabel,
              },
            ]
          : [],
    },
    payment: {
      mode: selectedPaymentLabel,
    },
    notes: notes.trim(),
    paymentInfo:
      paymentStatus === "UNPAID"
        ? previewCopy.awaitingPayment
        : `${previewCopy.paymentMethodPrefix}: ${selectedPaymentLabel}`,
    closingNote: previewCopy.closingNote,
    signatureLabel: previewCopy.signatureLabel,
  };
};

const ExistingInvoicePreview = ({
  data,
  previewKey,
  templateRenderKey,
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
  previewKey: string;
  templateRenderKey: string;
  hasItems?: boolean;
  templateId?: string | null;
  templateName?: string | null;
  enabledSections: SectionKey[];
  sectionOrder: SectionKey[];
  theme: InvoiceTheme;
  designConfig: ReturnType<typeof normalizeDesignConfig>;
  emptyMessage: string;
}) => {
  const stackKey = `simple-bill-preview-${templateRenderKey}-${previewKey}`;

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
        <A4PreviewStack key={stackKey} stackKey={stackKey}>
          <TemplatePreviewRenderer
            key={`${templateRenderKey}-${previewKey}`}
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
          pendingLabel: "लंबित",
          paidLabel: "भुगतान हो चुका",
          partiallyPaidLabel: "आंशिक भुगतान",
          awaitingPayment: "भुगतान की प्रतीक्षा",
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
            toastPaymentMethodRequired:
              "Paid या आंशिक भुगतान के लिए भुगतान तरीका चुनें।",
            toastPartialPaidRequired:
              "आंशिक भुगतान के लिए 0 से अधिक राशि दर्ज करें।",
            toastPartialPaidTooHigh:
              "आंशिक भुगतान राशि कुल से कम होनी चाहिए।",
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
            paymentStatusTitle: "भुगतान स्थिति",
            paymentStatusHint:
              "डिफॉल्ट Paid है। ज़रूरत हो तो Partial या Unpaid चुनें।",
            paymentStatusPaid: "Paid",
            paymentStatusPartial: "Partial",
            paymentStatusUnpaid: "Unpaid",
            paymentMethodLabel: "भुगतान तरीका",
            paymentDateLabel: "भुगतान तारीख",
            partialPaidAmountLabel: "आंशिक भुगतान राशि",
            partialPaidAmountPlaceholder: "0",
            paidAmountLabel: "भुगतान",
            dueAmountLabel: "बाकी",
            totalAmountLabel: "कुल राशि",
            previewHint:
              "स्क्रीन के लिए प्रीव्यू। प्रिंट हमेशा साफ़ ब्लैक-एंड-व्हाइट रहेगा।",
          }
        : {
            guestName: "Guest",
            customerFallback: "Customer",
            discountLabel: "Discount",
            pendingLabel: "Pending",
            paidLabel: "Paid",
            partiallyPaidLabel: "Partially paid",
            awaitingPayment: "Awaiting payment",
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
            toastPaymentMethodRequired:
              "Choose a payment method for paid or partial bills.",
            toastPartialPaidRequired:
              "Enter a paid amount greater than 0 for partial bills.",
            toastPartialPaidTooHigh:
              "Partial paid amount must be less than total.",
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
            paymentStatusTitle: "Payment status",
            paymentStatusHint:
              "Paid is selected by default. Switch to Partial or Unpaid when needed.",
            paymentStatusPaid: "Paid",
            paymentStatusPartial: "Partial",
            paymentStatusUnpaid: "Unpaid",
            paymentMethodLabel: "Payment method",
            paymentDateLabel: "Payment date",
            partialPaidAmountLabel: "Partial paid amount",
            partialPaidAmountPlaceholder: "0",
            paidAmountLabel: "Paid",
            dueAmountLabel: "Due",
            totalAmountLabel: "Total Amount",
            previewHint:
              "Preview is for screen. Print always stays clean black and white.",
          },
    [isHindi],
  );
  const displayName = name.trim() || copy.guestName;
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
  const [billState, setBillState] = useState<BillState>(() =>
    createInitialBillState(initialInvoiceDate),
  );
  const [customerSearch, setCustomerSearch] = useState(
    initialCustomerName.trim(),
  );
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState(
    initialCustomerName.trim(),
  );
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [customerSuggestionsOpen, setCustomerSuggestionsOpen] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
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
  const updateBillState = useCallback(
    (updater: Partial<BillState> | ((current: BillState) => BillState)) => {
      setBillState((current) =>
        normalizeBillState(
          typeof updater === "function"
            ? updater(current)
            : { ...current, ...updater },
        ),
      );
    },
    [],
  );
  const {
    customer: selectedCustomer,
    items,
    totalAmount,
    paymentStatus,
    paidAmount,
    dueAmount,
    paymentMethod: payment,
    paymentDate,
    discount,
    discountMode,
    gstEnabled,
    taxMode: selectedTaxMode,
    gstRate,
    pricesInclusiveOfTax,
    notes,
    invoiceDate,
  } = billState;
  const selectedCustomerId = selectedCustomer?.id ?? null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedCustomerSearch(customerSearch.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [customerSearch]);

  const shouldSearchCustomers =
    debouncedCustomerSearch.length > 0 &&
    !matchesSelectedCustomerInput(selectedCustomer, debouncedCustomerSearch);
  const {
    data: customerSuggestions = [],
    isFetching: customerSuggestionsLoading,
    refetch: refetchCustomerSuggestions,
  } = useCustomerSearchQuery(
    shouldSearchCustomers ? debouncedCustomerSearch : "",
    {
      limit: 8,
    },
  );
  const { data: walkInSuggestions = [] } = useCustomerSearchQuery(
    copy.walkInCustomerName,
    {
      limit: 8,
    },
  );

  const walkInCustomer = useMemo(
    () =>
      walkInSuggestions.find((customer) => {
        const normalizedName = normalizeText(customer.name);
        return (
          normalizedName === "walk-in customer" ||
          normalizedName === "walk in customer" ||
          normalizedName === normalizeText(copy.walkInCustomerName)
        );
      }) ?? null,
    [copy.walkInCustomerName, walkInSuggestions],
  );

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
    hasSelectedCustomer || Boolean(customerSearch.trim());
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
        paymentStatus !== "PAID" ||
        paidAmount > 0 ||
        paymentDate.trim() !== (invoiceDate || "") ||
        gstEnabled ||
        (gstEnabled && selectedTaxMode !== "CGST_SGST") ||
        addingCustomer ||
        newCustomerName.trim() ||
        newCustomerPhone.trim() ||
        newCustomerEmail.trim() ||
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
      gstRate,
      invoiceDate,
      items,
      newCustomerEmail,
      newCustomerName,
      newCustomerPhone,
      notes,
      payment,
      paymentDate,
      paymentStatus,
      paidAmount,
      selectedTaxMode,
      selectedCustomerId,
      pricesInclusiveOfTax,
    ],
  );
  const isInitialLoading = productsLoading;
  const hasDataLoadError = productsError;
  const taxMode: TaxMode = gstEnabled ? selectedTaxMode : "NONE";
  const simpleTotals = useMemo(
    () =>
      calculateSimpleBillTotals({
        items,
        discountValue: discount || "0",
        discountType: discountMode,
        taxMode,
        pricesInclusiveOfTax,
      }),
    [items, discount, discountMode, taxMode, pricesInclusiveOfTax],
  );
  const totals = useMemo(
    () =>
      calculateInvoiceTotals({
        items: invoiceItems,
        discountValue: discount || "0",
        discountType,
        taxMode,
      }),
    [discount, discountType, invoiceItems, taxMode],
  );
  const discountValidationMessage = useMemo(
    () =>
      getDiscountValidationMessage({
        subtotal: totals.subtotal,
        discountValue: discount || "0",
        discountType,
      }),
    [discount, discountType, totals.subtotal],
  );
  const selectedPaymentMethod = toInvoicePaymentMethod(payment);
  const previewInvoiceDate = useMemo(
    () =>
      formatDate(invoiceDate ? `${invoiceDate}T00:00:00` : new Date(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [formatDate, invoiceDate],
  );
  const previewRefreshKey = useMemo(
    () =>
      JSON.stringify({
        customer: selectedCustomer
          ? {
              id: selectedCustomer.id,
              name: selectedCustomer.name,
              phone: selectedCustomer.phone ?? "",
            }
          : null,
        items: items.map((item) => ({
          id: item.id,
          productId: item.productId ?? null,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          gstRate: item.gstRate,
          gstType: item.gstType,
        })),
        totalAmount,
        paymentStatus,
        paidAmount,
        dueAmount,
        paymentMethod: payment,
        paymentDate,
        discount,
        discountMode,
        gstEnabled,
        taxMode,
        notes,
        invoiceDate,
        fallbackCustomerName:
          customerSearch.trim() || copy.walkInCustomerName,
        invoiceNumber:
          generatedInvoice?.invoice_number || t("invoice.invoicePreviewNumber"),
      }),
    [
      copy.walkInCustomerName,
      customerSearch,
      discount,
      discountMode,
      dueAmount,
      generatedInvoice?.invoice_number,
      gstEnabled,
      taxMode,
      invoiceDate,
      items,
      notes,
      paidAmount,
      payment,
      paymentDate,
      paymentStatus,
      selectedCustomer,
      t,
      totalAmount,
    ],
  );
  const invoicePreviewData = useMemo<InvoicePreviewData>(() => {
    const previewPaymentDate = paymentDate
      ? formatDate(`${paymentDate}T00:00:00`, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : previewInvoiceDate;

    return buildSimpleBillInvoicePreviewData({
      businessProfile,
      customer: selectedCustomer,
      fallbackCustomerName:
        selectedCustomer?.name || customerSearch.trim() || copy.walkInCustomerName,
      fallbackCustomerPhone: selectedCustomer?.phone ?? "",
      invoiceNumber:
        generatedInvoice?.invoice_number || t("invoice.invoicePreviewNumber"),
      invoiceDate: previewInvoiceDate,
      dueDate: previewInvoiceDate,
      totals,
      taxMode,
      discountType,
      discount,
      paymentStatus,
      paidAmount,
      paymentDate: previewPaymentDate,
      payment: selectedPaymentMethod,
      notes,
      previewCopy: {
        customerFallback: copy.customerFallback,
        discountLabel: copy.discountLabel,
        pendingLabel: copy.pendingLabel,
        paidLabel: copy.paidLabel,
        partiallyPaidLabel: copy.partiallyPaidLabel,
        awaitingPayment: copy.awaitingPayment,
        paymentMethodPrefix: copy.paymentMethodPrefix,
        closingNote: copy.closingNote,
        signatureLabel: copy.signatureLabel,
      },
    });
  }, [
    businessProfile,
    copy,
    customerSearch,
    discount,
    discountType,
    formatDate,
    generatedInvoice?.invoice_number,
    invoiceItems,
    notes,
    paidAmount,
    paymentDate,
    paymentStatus,
    previewInvoiceDate,
    selectedCustomer,
    selectedPaymentMethod,
    t,
    totals,
  ]);
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
  const templateRenderKey = useMemo(
    () =>
      [
        activeTemplate.templateId ?? "default",
        activeTemplate.templateName ?? "",
        activeSectionOrder.join(","),
        activeEnabledSections.join(","),
        activeTheme.primaryColor,
        activeTheme.fontFamily,
        activeTheme.tableStyle,
        JSON.stringify(activeDesignConfig),
      ].join("|"),
    [
      activeDesignConfig,
      activeEnabledSections,
      activeSectionOrder,
      activeTemplate.templateId,
      activeTemplate.templateName,
      activeTheme.fontFamily,
      activeTheme.primaryColor,
      activeTheme.tableStyle,
    ],
  );

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

    const storedDraft = window.localStorage.getItem(SIMPLE_BILL_DRAFT_KEY);
    if (!storedDraft) {
      const storedLastCustomer = window.localStorage.getItem(LAST_CUSTOMER_KEY);
      if (!storedLastCustomer) {
        return;
      }

      try {
        const lastCustomer = JSON.parse(storedLastCustomer) as Customer;
        if (typeof lastCustomer?.id === "number" && lastCustomer.id > 0) {
          updateBillState({ customer: lastCustomer });
          setCustomerSearch(customerLabel(lastCustomer));
        }
      } catch {
        window.localStorage.removeItem(LAST_CUSTOMER_KEY);
      }
      return;
    }

    try {
      const draft = JSON.parse(storedDraft) as Partial<SimpleBillDraft>;
      const nextBillPatch: Partial<BillState> = {};

      if (typeof draft.invoiceDate === "string" && draft.invoiceDate) {
        nextBillPatch.invoiceDate = draft.invoiceDate;
      }
      if (typeof draft.customerSearch === "string") {
        setCustomerSearch(draft.customerSearch);
      }
      if (
        draft.selectedCustomer &&
        typeof draft.selectedCustomer.id === "number" &&
        draft.selectedCustomer.id > 0
      ) {
        nextBillPatch.customer = draft.selectedCustomer;
        setCustomerSearch(customerLabel(draft.selectedCustomer));
      } else if (draft.selectedCustomerId === null) {
        nextBillPatch.customer = null;
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
      if (typeof draft.newCustomerEmail === "string") {
        setNewCustomerEmail(draft.newCustomerEmail);
      }
      if (typeof draft.discount === "string") {
        nextBillPatch.discount = draft.discount;
      }
      if (draft.discountMode === "AMOUNT" || draft.discountMode === "PERCENT") {
        nextBillPatch.discountMode = draft.discountMode;
      }
      if (typeof draft.gstEnabled === "boolean") {
        nextBillPatch.gstEnabled = draft.gstEnabled;
      }
      if (draft.taxMode === "IGST" || draft.taxMode === "CGST_SGST") {
        nextBillPatch.taxMode = draft.taxMode;
      }
      if (typeof draft.notes === "string") {
        nextBillPatch.notes = draft.notes;
      }
      if (
        draft.paymentMethod === "CASH" ||
        draft.paymentMethod === "UPI" ||
        draft.paymentMethod === "ONLINE"
      ) {
        nextBillPatch.paymentMethod = draft.paymentMethod;
      }
      if (
        draft.paymentStatus === "UNPAID" ||
        draft.paymentStatus === "PARTIALLY_PAID" ||
        draft.paymentStatus === "PAID"
      ) {
        nextBillPatch.paymentStatus = draft.paymentStatus;
      }
      if (typeof draft.paidAmount === "number" && Number.isFinite(draft.paidAmount)) {
        nextBillPatch.paidAmount = draft.paidAmount;
      }
      if (typeof draft.paymentDate === "string" && draft.paymentDate) {
        nextBillPatch.paymentDate = draft.paymentDate;
      }
      if (Array.isArray(draft.items) && draft.items.length > 0) {
        nextBillPatch.items = draft.items.map((item) => ({
            id: item.id || createItem().id,
            productId:
              typeof item.productId === "number" &&
              Number.isFinite(item.productId)
                ? item.productId
                : undefined,
            name: item.name ?? "",
            quantity: item.quantity ?? "1",
            price: item.price ?? "",
            gstRate: item.gstRate ?? "18",
            gstType: normalizeGstType(item.gstType),
          }));
      }
      updateBillState(nextBillPatch);
    } catch {
      window.localStorage.removeItem(SIMPLE_BILL_DRAFT_KEY);
    }
  }, [resetOnLoad, updateBillState]);

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
      selectedCustomer,
      addingCustomer,
      newCustomerName,
      newCustomerPhone,
      newCustomerEmail,
      customerId: selectedCustomerId ?? undefined,
      customerName: selectedCustomer?.name ?? customerSearch,
      paymentMethod: payment,
      paymentStatus,
      paidAmount,
      paymentDate,
      discount,
      discountMode,
      gstEnabled,
      taxMode: selectedTaxMode,
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
    selectedTaxMode,
    hasDraftContent,
    invoiceDate,
    items,
    newCustomerName,
    newCustomerPhone,
    newCustomerEmail,
    notes,
    payment,
    paymentDate,
    paymentStatus,
    paidAmount,
    selectedCustomer,
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
      updateBillState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }));
    },
    [updateBillState],
  );

  const selectCustomer = useCallback(
    (customer: Customer) => {
      updateBillState({ customer });
      setCustomerSearch(customerLabel(customer));
      setNewCustomerName("");
      setNewCustomerPhone("");
      setAddingCustomer(false);
      setCustomerSuggestionsOpen(false);
    },
    [updateBillState],
  );

  useEffect(() => {
    const pendingPrefill = pendingCustomerPrefillRef.current.trim();
    if (
      !pendingPrefill ||
      customerSuggestionsLoading ||
      selectedCustomerId ||
      normalizeText(debouncedCustomerSearch) !== normalizeText(pendingPrefill)
    ) {
      return;
    }

    const exactMatch = customerSuggestions.find((customer) =>
      matchesSelectedCustomerInput(customer, pendingPrefill),
    );

    if (exactMatch) {
      selectCustomer(exactMatch);
    }

    pendingCustomerPrefillRef.current = "";
  }, [
    customerSuggestions,
    customerSuggestionsLoading,
    debouncedCustomerSearch,
    selectCustomer,
    selectedCustomerId,
  ]);

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
        gstRate: String(Number(product.gst_rate) || 0),
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
    const nextItem = createItem(undefined, {
      gstRate: "18",
      gstType: normalizeGstType(selectedTaxMode),
    });
    updateBillState((current) => {
      if (!afterId) {
        return { ...current, items: [...current.items, nextItem] };
      }

      const index = current.items.findIndex((item) => item.id === afterId);
      if (index < 0) {
        return { ...current, items: [...current.items, nextItem] };
      }

      return {
        ...current,
        items: [
          ...current.items.slice(0, index + 1),
          nextItem,
          ...current.items.slice(index + 1),
        ],
      };
    });
    window.setTimeout(() => itemNameRefs.current[nextItem.id]?.focus(), 0);
  }, [selectedTaxMode, updateBillState]);

  const removeItem = (id: string) => {
    updateBillState((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [
              {
                ...createItem(id, {
                  gstRate: "18",
                  gstType: normalizeGstType(selectedTaxMode),
                }),
              },
            ]
          : current.items.filter((item) => item.id !== id),
    }));
  };

  const handleCustomerSearch = (value: string) => {
    setCustomerSearch(value);
    setCustomerSuggestionsOpen(true);
    setAddingCustomer(false);
    if (!matchesSelectedCustomerInput(selectedCustomer, value)) {
      updateBillState({ customer: null });
    }
  };

  const startAddCustomer = (nameToUse = customerSearch) => {
    const prefill = parseCustomerPrefill(nameToUse);

    setAddingCustomer(true);
    updateBillState({ customer: null });
    setNewCustomerName(prefill.name);
    setNewCustomerPhone(prefill.phone);
    setNewCustomerEmail("");
    setCustomerSuggestionsOpen(false);
    window.setTimeout(() => {
      if (prefill.phone) {
        document.getElementById("simple-new-customer-name")?.focus();
      } else if (prefill.name) {
        newCustomerPhoneRef.current?.focus();
      } else {
        document.getElementById("simple-new-customer-name")?.focus();
      }
    }, 0);
  };

  const handleQuickAddCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast.error(copy.toastEnterCustomerName);
      return;
    }

    if (!CUSTOMER_NAME_PATTERN.test(newCustomerName.trim())) {
      toast.error("Enter a valid customer name.");
      return;
    }

    const normalizedPhone = newCustomerPhone.replace(/\D/g, "");
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error(copy.toastCustomerPhoneMin);
      return;
    }

    const normalizedEmail = newCustomerEmail.trim().toLowerCase();
    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      toast.error("Enter a valid email address.");
      return;
    }

    try {
      const phoneMatches = await fetchCustomers({
        search: normalizedPhone,
        limit: 10,
      });

      if (
        phoneMatches.some(
          (customer) => customer.phone?.replace(/\D/g, "") === normalizedPhone,
        )
      ) {
        toast.error("A customer with this phone number already exists.");
        return;
      }

      const created = await createCustomer.mutateAsync({
        name: newCustomerName.trim(),
        phone: normalizedPhone,
        email: normalizedEmail || null,
      });

      selectCustomer(created);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setAddingCustomer(false);
      toast.success("Customer added.");
    } catch (error) {
      toast.error(parseApiErrorMessage(error, "Could not add customer."));
    }
  };

  const closeAddCustomerModal = useCallback(() => {
    setAddingCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
  }, []);

  const loadLastBill = () => {
    const stored = window.localStorage.getItem(LAST_BILL_KEY);
    if (!stored) {
      toast.info(copy.toastNoSavedBill);
      return;
    }

    try {
      const bill = JSON.parse(stored) as SavedSimpleBill;
      setAddingCustomer(false);
      setCustomerSearch(
        bill.selectedCustomer
          ? customerLabel(bill.selectedCustomer)
          : bill.customerName ?? "",
      );
      updateBillState({
        customer: bill.selectedCustomer ?? null,
        items:
          bill.items.length > 0
            ? bill.items.map((item) => ({
                ...item,
                id: createItem().id,
                gstRate: item.gstRate ?? "18",
                gstType: normalizeGstType(item.gstType),
              }))
            : [
                createItem(undefined, {
                  gstType: normalizeGstType(bill.taxMode),
                }),
              ],
        discount: bill.discount,
        discountMode: bill.discountMode ?? "AMOUNT",
        gstEnabled: Boolean(bill.gstEnabled),
        taxMode:
          bill.taxMode === "IGST" || bill.taxMode === "CGST_SGST"
            ? bill.taxMode
            : "CGST_SGST",
        notes: bill.notes ?? "",
        paymentMethod: bill.paymentMethod,
        paymentStatus: bill.paymentStatus ?? "PAID",
        paidAmount: bill.paidAmount ?? 0,
        paymentDate: bill.paymentDate ?? todayInputValue(),
        invoiceDate: todayInputValue(),
      });
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
      selectedCustomer: customer,
      paymentMethod: payment,
      paymentStatus,
      paidAmount,
      paymentDate,
      discount,
      discountMode,
      gstEnabled,
      taxMode,
      notes,
      items: billItems,
    };
    window.localStorage.setItem(LAST_CUSTOMER_KEY, JSON.stringify(customer));
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

    if (discountValidationMessage) {
      toast.error(discountValidationMessage);
      return;
    }

    if (paymentStatus !== "UNPAID" && !selectedPaymentMethod) {
      toast.error(copy.toastPaymentMethodRequired);
      return;
    }

    if (paymentStatus === "PARTIALLY_PAID") {
      if (!(paidAmount > 0)) {
        toast.error(copy.toastPartialPaidRequired);
        return;
      }

      if (paidAmount >= totalAmount) {
        toast.error(copy.toastPartialPaidTooHigh);
        return;
      }
    }

    try {
      submitLockRef.current = true;
      setIsSubmitting(true);

      let customer: Customer | null = selectedCustomer;

      if (!customer) {
        customer = await ensureWalkInCustomer();
      }

      if (!customer) {
        toast.error(copy.toastChooseCustomer);
        return;
      }

      const invoicePayload = mapSimpleBillToInvoice({
        customerId: customer.id,
        invoiceDate,
        discount,
        discountType,
        taxMode,
        paymentStatus,
        paidAmount,
        paymentDate: paymentDate || invoiceDate || todayInputValue(),
        paymentMethod: selectedPaymentMethod,
        totalAmount,
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
        gstRate: item.tax_rate ?? "0",
        gstType: normalizeGstType(item.gst_type),
      }));

      saveProductUsage(billItems);
      saveLastBill(customer, billItems);
      selectCustomer(customer);
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
    const today = todayInputValue();
    setCustomerSearch("");
    setDebouncedCustomerSearch("");
    setAddingCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setNewCustomerEmail("");
    setBillState(createInitialBillState(today));
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
    if (shouldSearchCustomers) {
      void Promise.all([refetchCustomerSuggestions(), refetchProducts()]);
      return;
    }

    void refetchProducts();
  }, [refetchCustomerSuggestions, refetchProducts, shouldSearchCustomers]);

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
                onChange={(event) => {
                  const nextDate = event.target.value;
                  const previousDate = invoiceDate;
                  updateBillState((current) => ({
                    ...current,
                    invoiceDate: nextDate,
                    paymentDate:
                      !current.paymentDate || current.paymentDate === previousDate
                        ? nextDate
                        : current.paymentDate,
                  }));
                }}
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
                } else if (
                  event.key === "Enter" &&
                  customerSearch.trim() &&
                  !customerSuggestionsLoading &&
                  customerSuggestions.length === 0
                ) {
                  event.preventDefault();
                  startAddCustomer(customerSearch);
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
                {customerSuggestionsLoading && customerSearch.trim() ? (
                  <div className="px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                    
                    {isHindi
                      ? "à¤—à¥à¤°à¤¾à¤¹à¤• à¤–à¥‹à¤œ à¤°à¤¹à¥‡ à¤¹à¥ˆà¤‚..."
                      : "Searching customers..."}
                  </p>
                  </div>
                ) : customerSearch.trim() ? (
                  customerSuggestions.length > 0 ? (
                  customerSuggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-accent/70"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectCustomer(customer)}
                    >
                      <span className="font-semibold text-foreground">
                        {customer.businessName ||
                          customer.business_name ||
                          customer.name}
                      </span>
                      {customer.phone ? (
                        <span className="text-muted-foreground">
                          {customer.phone}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="grid gap-1 border-t border-border/60 px-4 py-3">
                    <p className="px-4 py-3 text-sm text-muted-foreground">
                    {isHindi
                      ? "कोई सेव ग्राहक नहीं मिला"
                      : "No customer found"}
                    </p>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left text-sm font-semibold text-primary transition hover:opacity-80"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => startAddCustomer(customerSearch)}
                    >
                      <Plus size={16} />
                      {`Add "${customerSearch.trim()}" as new customer`}
                    </button>
                  </div>
                )
                ) : (
                  <div className="grid gap-1 border-t border-border/60 px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                    {isHindi
                      ? "à¤–à¥‹à¤œ à¤•à¥‡ à¤²à¤¿à¤ à¤¨à¤¾à¤® à¤¯à¤¾ à¤«à¥‹à¤¨ à¤²à¤¿à¤–à¥‡à¤‚"
                      : "Type name or phone to search"}
                  </p>
                  </div>
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
                const lineBaseAmount =
                  toQuantity(item.quantity) * toAmount(item.price);
                const lineGstRate = gstEnabled ? toGstRate(item.gstRate) : 0;
                const lineGstAmount =
                  gstEnabled ? (lineBaseAmount * lineGstRate) / 100 : 0;
                const lineCgst =
                  gstEnabled && item.gstType === "CGST_SGST"
                    ? lineGstAmount / 2
                    : 0;
                const lineSgst =
                  gstEnabled && item.gstType === "CGST_SGST"
                    ? lineGstAmount / 2
                    : 0;
                const lineIgst =
                  gstEnabled && item.gstType === "IGST" ? lineGstAmount : 0;
                const lineTotal = lineBaseAmount + lineGstAmount;
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
                    <div className="grid min-w-0 gap-3 sm:grid-cols-[7rem_8rem_11rem_10rem_minmax(0,1fr)_auto] sm:items-end">
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
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor={`simple-gst-type-${item.id}`}>
                          GST Type
                        </Label>
                        <select
                          id={`simple-gst-type-${item.id}`}
                          value={item.gstType}
                          disabled={!gstEnabled}
                          onChange={(event) =>
                            updateItem(item.id, {
                              gstType: normalizeGstType(event.target.value),
                            })
                          }
                          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="CGST_SGST">CGST + SGST</option>
                          <option value="IGST">IGST</option>
                        </select>
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <Label htmlFor={`simple-gst-rate-${item.id}`}>
                          GST Rate
                        </Label>
                        <select
                          id={`simple-gst-rate-${item.id}`}
                          value={item.gstRate}
                          disabled={!gstEnabled}
                          onChange={(event) =>
                            updateItem(item.id, { gstRate: event.target.value })
                          }
                          className="h-12 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {GST_RATE_OPTIONS.map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}%
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-0 rounded-lg bg-muted/45 px-3 py-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {isHindi ? "लाइन टोटल" : "Line Total"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Base {formatMoney(lineBaseAmount)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {gstEnabled
                            ? item.gstType === "IGST"
                              ? `IGST ${lineGstRate}% ${formatMoney(lineIgst)}`
                              : `CGST ${lineGstRate / 2}% ${formatMoney(lineCgst)} + SGST ${lineGstRate / 2}% ${formatMoney(lineSgst)}`
                            : "GST 0%"}
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
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {isHindi ? "लाइव सारांश" : "Live summary"}
                </p>
                <p className="mt-1 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  {formatMoney(simpleTotals.total)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("invoiceComposer.lineItemsCount", {
                    count: validItems.length,
                  })}
                </p>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {isHindi ? "उप-कुल" : "Subtotal"}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatMoney(simpleTotals.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {isHindi ? "छूट" : "Discount"}
                    </span>
                    <span className="font-medium text-foreground">
                      -{formatMoney(simpleTotals.discount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">
                      {isHindi ? "कर योग्य मूल्य" : "Taxable Value"}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatMoney(simpleTotals.taxableValue)}
                    </span>
                  </div>
                  {taxMode === "CGST_SGST" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          CGST
                        </span>
                        <span className="font-medium text-foreground">
                          +{formatMoney(simpleTotals.cgst)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          SGST
                        </span>
                        <span className="font-medium text-foreground">
                          +{formatMoney(simpleTotals.sgst)}
                        </span>
                      </div>
                    </>
                  ) : taxMode === "IGST" ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        IGST
                      </span>
                      <span className="font-medium text-foreground">
                        +{formatMoney(simpleTotals.igst)}
                      </span>
                    </div>
                  ) : null}
                  <div className="my-1 border-t border-dashed border-border/70" />
                  <div className="flex items-center justify-between gap-3 text-base font-semibold text-foreground">
                    <span>{isHindi ? "अंतिम कुल" : "Final Total"}</span>
                    <span>{formatMoney(simpleTotals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/70 p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div className="grid gap-1.5">
                    <Label htmlFor="simple-discount">
                      {isHindi ? "छूट" : "Discount"}
                    </Label>
                    <Input
                      id="simple-discount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={discount}
                      disabled={totals.subtotal <= 0}
                      onChange={(event) =>
                        updateBillState({ discount: event.target.value })
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          const nextField = document.getElementById(
                            gstEnabled
                              ? "simple-tax-mode"
                              : "simple-payment-method",
                          ) as HTMLElement | null;
                          nextField?.focus();
                        }
                      }}
                      placeholder="0"
                      className="h-11"
                    />
                  </div>
                  <div className="flex rounded-lg border border-border bg-background p-1">
                    {(["AMOUNT", "PERCENT"] as DiscountMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={totals.subtotal <= 0}
                        className={`h-10 min-w-11 rounded-md px-3 text-sm font-semibold transition ${
                          discountMode === mode
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        onClick={() => updateBillState({ discountMode: mode })}
                      >
                        {mode === "AMOUNT"
                          ? isHindi
                            ? "₹"
                            : "Rs"
                          : "%"}
                      </button>
                    ))}
                  </div>
                </div>

                {totals.subtotal <= 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isHindi
                      ? "छूट लगाने से पहले आइटम जोड़ें।"
                      : "Add items before applying a discount."}
                  </p>
                ) : null}

                {discountValidationMessage ? (
                  <p className="mt-2 text-sm text-destructive">
                    {discountValidationMessage}
                  </p>
                ) : null}

                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)]">
                  <label className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {isHindi ? "GST लागू करें" : "Enable GST"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isHindi
                          ? "टैक्स सारांश और प्रीव्यू में तुरंत दिखेगा"
                          : "Tax updates instantly in the summary and preview."}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={gstEnabled}
                      onChange={(event) =>
                        updateBillState({ gstEnabled: event.target.checked })
                      }
                      className="h-4 w-4"
                    />
                  </label>

                  <div className="grid gap-1.5">
                    <Label htmlFor="simple-tax-mode">
                      {isHindi ? "कर प्रकार" : "Tax mode"}
                    </Label>
                    <select
                      id="simple-tax-mode"
                      value={selectedTaxMode}
                      disabled={!gstEnabled}
                      onChange={(event) =>
                        updateBillState((current) => ({
                          ...current,
                          taxMode: event.target.value as TaxMode,
                          items: current.items.map((item) => ({
                            ...item,
                            gstType: normalizeGstType(event.target.value),
                          })),
                        }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="CGST_SGST">CGST + SGST</option>
                      <option value="IGST">IGST</option>
                    </select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="simple-gst-rate">
                      {isHindi ? "GST दर" : "GST Rate"}
                    </Label>
                    <select
                      id="simple-gst-rate"
                      value={gstRate}
                      disabled={!gstEnabled}
                      onChange={(event) =>
                        updateBillState((current) => ({
                          ...current,
                          gstRate: event.target.value,
                          items: current.items.map((item) => ({
                            ...item,
                            gstRate: event.target.value,
                          })),
                        }))
                      }
                      className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {GST_RATE_OPTIONS.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {isHindi ? "GST सम्मिलित" : "Prices incl. GST"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isHindi ? "कीमत में GST शामिल" : "GST included in price"}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={pricesInclusiveOfTax}
                      disabled={!gstEnabled}
                      onChange={(event) =>
                        updateBillState({
                          pricesInclusiveOfTax: event.target.checked,
                        })
                      }
                      className="h-4 w-4 disabled:opacity-50"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-lg border border-border/70 bg-background px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {isHindi ? "Intra-state" : "Intra-state"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isHindi ? "CGST + SGST" : "CGST + SGST"}
                      </p>
                    </div>
                    <input
                      type="radio"
                      checked={taxMode === "CGST_SGST"}
                      disabled={!gstEnabled}
                      onChange={() =>
                        updateBillState({ taxMode: "CGST_SGST" })
                      }
                      className="h-4 w-4 disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-sm font-semibold text-foreground">
                  {copy.paymentStatusTitle}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {copy.paymentStatusHint}
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant={paymentStatus === "PAID" ? "default" : "outline"}
                    className="h-10"
                    onClick={() => {
                      updateBillState((current) => ({
                        ...current,
                        paymentStatus: "PAID",
                        paidAmount: current.totalAmount,
                        paymentDate:
                          current.paymentDate ||
                          current.invoiceDate ||
                          todayInputValue(),
                      }));
                    }}
                  >
                    {copy.paymentStatusPaid}
                  </Button>
                  <Button
                    type="button"
                    variant={
                      paymentStatus === "PARTIALLY_PAID" ? "default" : "outline"
                    }
                    className="h-10"
                    onClick={() => {
                      updateBillState((current) => ({
                        ...current,
                        paymentStatus: "PARTIALLY_PAID",
                        paidAmount:
                          current.paymentStatus === "PARTIALLY_PAID"
                            ? current.paidAmount
                            : Math.min(current.totalAmount, current.paidAmount),
                        paymentDate:
                          current.paymentDate ||
                          current.invoiceDate ||
                          todayInputValue(),
                      }));
                    }}
                  >
                    {copy.paymentStatusPartial}
                  </Button>
                  <Button
                    type="button"
                    variant={paymentStatus === "UNPAID" ? "default" : "outline"}
                    className="h-10"
                    onClick={() => {
                      updateBillState({
                        paymentStatus: "UNPAID",
                        paidAmount: 0,
                      });
                    }}
                  >
                    {copy.paymentStatusUnpaid}
                  </Button>
                </div>

                {paymentStatus !== "UNPAID" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor="simple-payment-method">
                        {copy.paymentMethodLabel}
                      </Label>
                      <select
                        id="simple-payment-method"
                        value={payment}
                        onChange={(event) =>
                          updateBillState({
                            paymentMethod: event.target.value as PaymentChoice,
                          })
                        }
                        className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="ONLINE">Online</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="simple-payment-date">
                        {copy.paymentDateLabel}
                      </Label>
                      <Input
                        id="simple-payment-date"
                        type="date"
                        value={paymentDate}
                        onChange={(event) =>
                          updateBillState({ paymentDate: event.target.value })
                        }
                        className="h-10"
                      />
                    </div>
                  </div>
                ) : null}

                {paymentStatus === "PARTIALLY_PAID" ? (
                  <div className="mt-3 grid gap-1.5">
                    <Label htmlFor="simple-partial-paid-amount">
                      {copy.partialPaidAmountLabel}
                    </Label>
                    <Input
                      id="simple-partial-paid-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={paidAmount > 0 ? String(paidAmount) : ""}
                      onChange={(event) =>
                        updateBillState({
                          paidAmount: Math.max(
                            0,
                            Number(
                              event.target.value.replace(/[^\d.]/g, ""),
                            ) || 0,
                          ),
                        })
                      }
                      placeholder={copy.partialPaidAmountPlaceholder}
                      className="h-10"
                    />
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
                    {copy.paidAmountLabel}: {formatMoney(paidAmount)}
                  </div>
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800 dark:bg-rose-950/20 dark:text-rose-200">
                    {copy.dueAmountLabel}: {formatMoney(dueAmount)}
                  </div>
                </div>
              </div>

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
              previewKey={previewRefreshKey}
              templateRenderKey={templateRenderKey}
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

        <Modal
          open={addingCustomer}
          onOpenChange={(open) => {
            if (!open && !createCustomer.isPending) {
              closeAddCustomerModal();
            }
          }}
          title="Add customer"
          description="Create a customer without leaving Simple Bill."
        >
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleQuickAddCustomer();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="simple-new-customer-name">Name</Label>
              <Input
                id="simple-new-customer-name"
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="Customer name"
                autoComplete="name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="simple-new-customer-phone">Phone</Label>
              <Input
                id="simple-new-customer-phone"
                ref={newCustomerPhoneRef}
                value={newCustomerPhone}
                onChange={(event) =>
                  setNewCustomerPhone(event.target.value.replace(/\D/g, ""))
                }
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit phone number"
                autoComplete="tel"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="simple-new-customer-email">Email (optional)</Label>
              <Input
                id="simple-new-customer-email"
                type="email"
                value={newCustomerEmail}
                onChange={(event) => setNewCustomerEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeAddCustomerModal}
                disabled={createCustomer.isPending}
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

export default SimpleBillClient;
