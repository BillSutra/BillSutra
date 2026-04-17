"use client";

import type {
  BusinessProfileRecord,
  Customer,
  InvoiceInput,
} from "@/lib/apiClient";
import type {
  DiscountType,
  InvoiceFormState,
  InvoiceItemForm,
} from "@/types/invoice";
import type { InvoicePreviewData } from "@/types/invoice-template";
import {
  formatBusinessAddressFromRecord,
  formatCustomerAddressFromRecord,
} from "@/lib/indianAddress";
import { getStateFromGstin } from "@/lib/gstin";

export type SimpleBillMode = "simple" | "business";

export type SimpleBillItem = {
  id: string;
  productId?: number;
  name: string;
  quantity: number;
  price: number;
};

export type PaymentChoice = "CASH" | "UPI" | "ONLINE";
export type InvoicePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER";
export type DiscountMode = "AMOUNT" | "PERCENT";

export type SavedSimpleBillDraft = {
  mode: SimpleBillMode;
  customerId?: number | null;
  customerName?: string;
  customerType?: "B2C" | "B2B";
  customerGstin?: string;
  placeOfSupplyStateCode?: string;
  addingCustomer: boolean;
  newCustomerName: string;
  newCustomerPhone: string;
  payment: PaymentChoice;
  discount: string;
  discountMode: DiscountMode;
  gstEnabled: boolean;
  notes: string;
  invoiceDate: string;
  items: SimpleBillItem[];
};

export const SIMPLE_BILL_DRAFT_KEY = "billsutra.simple-bill.draft";
export const SIMPLE_BILL_MODE_KEY = "billsutra.simple-bill.mode";
export const LAST_CUSTOMER_KEY = "billsutra.simple-bill.last-customer";
export const LAST_BILL_KEY = "billsutra.simple-bill.last-bill";
export const PRODUCT_USAGE_KEY = "billsutra.simple-bill.product-usage";
export const INITIAL_ITEM_ID = "simple-bill-item-1";
export const GST_RATE = 18;
export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const createItemId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const createItem = (id?: string): SimpleBillItem => ({
  id: id ?? createItemId(),
  name: "",
  quantity: 1,
  price: 0,
});

export const toAmount = (value: number | string | null | undefined) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

export const toQuantity = (value: number | string | null | undefined) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, numberValue) : 1;
};

const toProductId = (value: unknown) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : undefined;
};

export const sanitizeSimpleBillItem = (
  item?: Partial<SimpleBillItem> | null,
  fallbackId?: string,
): SimpleBillItem => ({
  id:
    typeof item?.id === "string" && item.id.trim()
      ? item.id
      : (fallbackId ?? createItemId()),
  productId: toProductId(item?.productId),
  name: typeof item?.name === "string" ? item.name : "",
  quantity: toQuantity(item?.quantity),
  price: toAmount(item?.price),
});

export const isSimpleBillItemBlank = (item: SimpleBillItem) =>
  !item.name.trim() && !item.productId && toAmount(item.price) === 0;

export const ensureTrailingEmptyItem = (
  items: SimpleBillItem[],
): SimpleBillItem[] => {
  const normalized = items.length
    ? items.map((item, index) =>
        sanitizeSimpleBillItem(item, index === 0 ? INITIAL_ITEM_ID : undefined),
      )
    : [createItem(INITIAL_ITEM_ID)];

  return isSimpleBillItemBlank(normalized[normalized.length - 1])
    ? normalized
    : [...normalized, createItem()];
};

export const hydrateSimpleBillItems = (
  items?: Array<Partial<SimpleBillItem>> | null,
): SimpleBillItem[] => {
  const normalized = Array.isArray(items)
    ? items.map((item, index) =>
        sanitizeSimpleBillItem(item, index === 0 ? INITIAL_ITEM_ID : undefined),
      )
    : [];

  const filledItems = normalized.filter((item) => !isSimpleBillItemBlank(item));

  if (!filledItems.length) {
    return [createItem(INITIAL_ITEM_ID)];
  }

  return [...filledItems, createItem()];
};

export const calculateSimpleBillTotal = (items: SimpleBillItem[]) =>
  items.reduce(
    (sum, item) => sum + toQuantity(item.quantity) * toAmount(item.price),
    0,
  );

export const formatMoney = (value: number) => currencyFormatter.format(value);

export const customerLabel = (customer: Customer) =>
  customer.phone ? `${customer.name} (${customer.phone})` : customer.name;

export const paymentMethod = (payment: PaymentChoice): InvoicePaymentMethod => {
  if (payment === "UPI") return "UPI";
  if (payment === "ONLINE") return "BANK_TRANSFER";
  return "CASH";
};

export const paymentLabel = (payment: InvoicePaymentMethod) => {
  if (payment === "UPI") return "UPI";
  if (payment === "BANK_TRANSFER") return "Online";
  return "Cash";
};

export const containsText = (
  value: string | null | undefined,
  search: string,
) => value?.toLowerCase().includes(search.toLowerCase()) ?? false;

export const toDiscountType = (mode: DiscountMode): DiscountType =>
  mode === "PERCENT" ? "PERCENTAGE" : "FIXED";

export const mapSimpleBillItemsToInvoiceItems = (
  billItems: SimpleBillItem[],
  gstEnabled: boolean,
  gstRate = GST_RATE,
): InvoiceItemForm[] =>
  billItems.map((item) => ({
    product_id: item.productId ? String(item.productId) : "",
    name: item.name.trim(),
    quantity: String(toQuantity(item.quantity)),
    price: String(toAmount(item.price)),
    tax_rate: gstEnabled
      ? String(Math.max(0, Number(gstRate) || GST_RATE))
      : "",
  }));

export const isInvoiceItemReady = (item: InvoiceItemForm) =>
  Boolean(
    item.name.trim() && Number(item.quantity) > 0 && Number(item.price) > 0,
  );

export const mapSimpleBillToInvoice = ({
  customerId,
  invoiceDate,
  discount,
  discountType,
  notes,
  taxMode,
  customerType,
  customerGstin,
  placeOfSupplyStateCode,
  isTaxInclusive,
  items,
}: {
  customerId: number;
  invoiceDate: string;
  discount: string;
  discountType: DiscountType;
  notes: string;
  taxMode: "AUTO" | "CGST_SGST" | "IGST" | "NONE";
  customerType: "B2C" | "B2B";
  customerGstin?: string;
  placeOfSupplyStateCode?: string;
  isTaxInclusive: boolean;
  items: InvoiceItemForm[];
}): InvoiceInput => ({
  customer_id: customerId,
  date: invoiceDate,
  due_date: invoiceDate,
  discount: Number(discount) || undefined,
  discount_type: discountType,
  tax_mode: taxMode,
  customer_type: customerType,
  customer_gstin: customerGstin?.trim() || undefined,
  place_of_supply_state_code: placeOfSupplyStateCode?.trim() || undefined,
  is_tax_inclusive: isTaxInclusive,
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

export const buildSimpleBillInvoicePreviewData = ({
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
  const taxMode =
    (totals.tax ?? 0) <= 0
      ? "NONE"
      : businessState && customerState && businessState !== customerState
        ? "IGST"
        : "CGST_SGST";

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
          ? customer.businessName || customer.business_name || customer.name
          : customer?.name) ??
        (fallbackCustomerName || WALK_IN_CUSTOMER_NAME),
      type: customer?.type,
      businessName: customer?.businessName ?? customer?.business_name ?? "",
      gstin: customer?.gstin ?? "",
      email: customer?.email ?? "",
      phone: customer?.phone ?? fallbackCustomerPhone,
      address: formatCustomerAddressFromRecord(customer) || "",
    },
    items: items.filter(isInvoiceItemReady).map((item) => ({
      name: item.name.trim(),
      description: "",
      quantity: Number(item.quantity),
      unitPrice: Number(item.price),
      taxRate: item.tax_rate ? Number(item.tax_rate) : 0,
      amount:
        Number(item.quantity) * Number(item.price) +
        ((taxMode === "NONE"
          ? 0
          : (Number(item.quantity) *
              Number(item.price) *
              (item.tax_rate ? Number(item.tax_rate) : 0)) /
            100) || 0),
    })),
    totals: {
      ...totals,
      cgst: taxMode === "CGST_SGST" ? totals.tax / 2 : 0,
      sgst: taxMode === "CGST_SGST" ? totals.tax / 2 : 0,
      igst: taxMode === "IGST" ? totals.tax : 0,
      roundOff: 0,
    },
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
    payment: {
      mode: selectedPaymentLabel,
    },
    notes: notes.trim(),
    paymentInfo: `Payment method: ${selectedPaymentLabel}`,
    closingNote: "Thank you for your business.",
    signatureLabel: "Authorized Signature",
  };
};

export const createSimpleBillDraft = ({
  mode,
  customerId,
  customerName,
  addingCustomer,
  newCustomerName,
  newCustomerPhone,
  payment,
  discount,
  discountMode,
  gstEnabled,
  notes,
  invoiceDate,
  items,
}: SavedSimpleBillDraft) => ({
  mode,
  customerId,
  customerName,
  addingCustomer,
  newCustomerName,
  newCustomerPhone,
  payment,
  discount,
  discountMode,
  gstEnabled,
  notes,
  invoiceDate,
  items,
});

export const buildInvoiceFormState = ({
  customerId,
  invoiceDate,
  discount,
  discountType,
  notes,
}: {
  customerId?: number | null;
  invoiceDate: string;
  discount: string;
  discountType: DiscountType;
  notes: string;
}): InvoiceFormState => ({
  customer_id: customerId ? String(customerId) : "",
  date: invoiceDate,
  due_date: invoiceDate,
  discount: discount || "0",
  discount_type: discountType,
  payment_status: "UNPAID",
  amount_paid: "0",
  payment_method: "",
  payment_date: invoiceDate,
  notes,
  sync_sales: false,
  warehouse_id: "",
});
