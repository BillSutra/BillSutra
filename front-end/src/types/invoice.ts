import type {
  InvoicePreviewData,
  InvoiceTheme,
  SectionKey,
} from "@/types/invoice-template";
import type { DesignConfig } from "@/components/invoice/DesignConfigContext";

export type TaxMode = "CGST_SGST" | "IGST" | "NONE";

export type InvoiceFormState = {
  customer_id: string;
  date: string;
  due_date: string;
  discount: string;
  notes: string;
  sync_sales: boolean;
  warehouse_id?: string;
};

export type InvoiceItemForm = {
  product_id: string;
  name: string;
  quantity: string;
  price: string;
  tax_rate: string;
};

export type InvoiceItemError = {
  product_id?: string;
  name?: string;
  quantity?: string;
  price?: string;
  tax_rate?: string;
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  total: number;
};

export type InvoiceDraft = {
  id: string;
  savedAt: string;
  form: InvoiceFormState;
  taxMode: TaxMode;
  items: InvoiceItemForm[];
};

export type InvoiceTemplateItem = {
  id?: number;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  total: number;
};

export type InvoiceTemplateTotals = {
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
};

export type InvoicePdfItem = {
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  total: number;
};

export type InvoicePdfTotals = {
  subtotal: number;
  tax: number;
  discount?: number;
  total: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
};

export type InvoicePdfCustomer = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type InvoicePdfInput = {
  elementId?: string;
  selector?: string;
  element?: HTMLElement | null;
  previewPayload?: {
    templateId?: string | null;
    data: InvoicePreviewData;
    enabledSections: SectionKey[];
    sectionOrder?: SectionKey[];
    theme: InvoiceTheme;
    designConfig?: Partial<DesignConfig> | null;
  };
  fileName?: string;
  imageType?: "png" | "jpeg";
  quality?: number;
};
