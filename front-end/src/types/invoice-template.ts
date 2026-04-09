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

export type TemplateLayout = "stacked" | "split";

export type InvoiceTemplateVariant =
  | "classic"
  | "modern"
  | "indianModern"
  | "gst"
  | "headerLeft"
  | "banner"
  | "split"
  | "compact"
  | "bold";

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

export type BusinessProfileInput = {
  businessName: string;
  address: string;
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
};

export type InvoicePreviewData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  business: BusinessProfileInput;
  client: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: InvoiceLineItem[];
  totals?: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
  };
  discount?: {
    type: "PERCENTAGE" | "FIXED";
    value: number;
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
  notes: string;
  paymentInfo: string;
  closingNote?: string;
  signatureLabel?: string;
};

export type InvoiceSectionProps = {
  data: InvoicePreviewData;
  theme: InvoiceTheme;
};
