export type SectionKey =
  | "header"
  | "company_details"
  | "client_details"
  | "items"
  | "service_items"
  | "tax"
  | "discount"
  | "payment_info"
  | "notes"
  | "footer";

export type InvoiceTheme = {
  primaryColor: string;
  fontFamily: string;
  tableStyle: "minimal" | "grid" | "modern";
};

export type InvoiceTaxMode = "CGST_SGST" | "IGST" | "NONE";

export type TemplateLayout = "stacked" | "split";

export type InvoiceTemplateVariant =
  | "classic"
  | "modern"
  | "indianGst"
  | "indianModern"
  | "gst"
  | "headerLeft"
  | "banner"
  | "split"
  | "compact"
  | "bold"
  | "halfPage"
  | "mini"
  | "thermal";

export type InvoiceTemplateConfig = {
  id: string;
  name: string;
  description: string;
  bestFor?: string;
  layout: TemplateLayout;
  defaultSections: SectionKey[];
  sectionOrder?: SectionKey[];
  theme: InvoiceTheme;
  variant?: InvoiceTemplateVariant;
};

export type BusinessTypeConfig = {
  id: string;
  label: string;
  defaultSections: SectionKey[];
};

export type BusinessAddressInput = {
  addressLine1: string;
  city: string;
  state: string;
  pincode: string;
};

export type BusinessProfileInput = {
  businessName: string;
  address: string;
  businessAddress?: BusinessAddressInput;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  taxId: string;
  currency: string;
  showLogoOnInvoice: boolean;
  showTaxNumber: boolean;
  showPaymentQr: boolean;
};

export type InvoiceLineItem = {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  gstType?: InvoiceTaxMode;
  baseAmount?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  hsnSac?: string;
  unitLabel?: string;
  discountAmount?: number;
  discountPercent?: number;
  taxableValue?: number;
  amount?: number;
};

export type InvoicePaymentDetails = {
  mode?: string;
  label?: string;
  upiId?: string;
  upiUrl?: string;
  qrCodeUrl?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  extraLines?: string[];
};

export type InvoicePreviewData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceTitle?: string;
  placeOfSupply?: string;
  taxMode?: InvoiceTaxMode;
  amountInWords?: string;
  watermarkText?: string;
  business: BusinessProfileInput;
  client: {
    name: string;
    type?: "individual" | "business";
    businessName?: string;
    gstin?: string;
    email: string;
    phone: string;
    address: string;
  };
  items: InvoiceLineItem[];
  totals?: {
    subtotal: number;
    totalBase?: number;
    tax: number;
    discount: number;
    total: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    grandTotal?: number;
    roundOff?: number;
  };
  discount?: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
    calculatedAmount?: number;
    label?: string;
  };
  paymentSummary?: {
    statusLabel: string;
    statusTone?: "paid" | "partial" | "pending";
    statusNote?: string;
    paidAmount: number;
    remainingAmount: number;
    history?: Array<{
      id?: number | string;
      amount: number;
      paidAt?: string | null;
      method?: string | null;
    }>;
  };
  payment?: InvoicePaymentDetails;
  notes: string;
  paymentInfo: string;
  closingNote?: string;
  signatureLabel?: string;
};

export type InvoiceSectionProps = {
  data: InvoicePreviewData;
  theme: InvoiceTheme;
};
