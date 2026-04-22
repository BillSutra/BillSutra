import { calculateInvoiceTotals } from "./invoiceCalculations.js";

export type InvoiceCalcItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  gst_type?: "CGST_SGST" | "IGST" | "NONE" | null;
};

export type InvoiceCalcResultItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  gst_type: "CGST_SGST" | "IGST" | "NONE";
  baseAmount: number;
  total: number;
  lineSubtotal: number;
  lineTax: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type InvoiceTotals = {
  subtotal: number;
  totalBase: number;
  tax: number;
  cgst: number;
  sgst: number;
  igst: number;
  discount: number;
  total: number;
  items: InvoiceCalcResultItem[];
};

export const getDiscountAmount = (
  subtotal: number,
  discount = 0,
  discountType: "PERCENTAGE" | "FIXED" = "FIXED",
) => {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDiscount = Math.max(0, Number(discount) || 0);

  if (safeSubtotal <= 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    return (
      Math.round(
        (((safeSubtotal * Math.min(100, safeDiscount)) / 100) + Number.EPSILON) * 100,
      ) / 100
    );
  }

  return Math.min(safeSubtotal, safeDiscount);
};

export const calculateTotals = (
  items: InvoiceCalcItem[],
  discount = 0,
  discountType: "PERCENTAGE" | "FIXED" = "FIXED",
  taxMode: "CGST_SGST" | "IGST" | "NONE" = "CGST_SGST",
): InvoiceTotals => {
  const totals = calculateInvoiceTotals(items, discount, taxMode, discountType);

  return {
    subtotal: totals.subtotal,
    totalBase: totals.totalBase,
    tax: totals.tax,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    discount: totals.discount,
    total: totals.total,
    items: totals.items.map((item) => ({
      product_id: item.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      gst_type: item.gst_type,
      baseAmount: item.baseAmount,
      total: item.lineTotal,
      lineSubtotal: item.lineSubtotal,
      lineTax: item.lineTax,
      cgst: item.cgst,
      sgst: item.sgst,
      igst: item.igst,
    })),
  };
};
