import {
  calculateInvoiceTotals as calculateSharedInvoiceTotals,
  normalizeTaxMode,
  roundCurrency,
  type InvoiceTaxMode,
} from "../../../shared/invoice-calculations.js";

export type InvoiceCalcItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
};

export type TaxMode = "GST" | "IGST" | "CGST_SGST" | "NONE";

export type LineTotals = {
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  cgst: number;
  sgst: number;
  igst: number;
  items: Array<
    LineTotals & {
      product_id?: number | null;
      name: string;
      quantity: number;
      price: number;
      tax_rate?: number | null;
    }
  >;
};

const toInvoiceTaxMode = (taxMode: TaxMode): InvoiceTaxMode =>
  taxMode === "GST" ? "CGST_SGST" : normalizeTaxMode(taxMode);

export const calculateLineTotals = (
  quantity: number,
  price: number,
  taxRate?: number | null,
  taxMode: TaxMode = "GST",
): LineTotals => {
  const safeTaxMode = toInvoiceTaxMode(taxMode);
  const lineSubtotal = roundCurrency(quantity * price);
  const rate = taxRate ?? 0;
  const lineTax =
    safeTaxMode === "NONE"
      ? 0
      : roundCurrency((lineSubtotal * rate) / 100);
  const igst = safeTaxMode === "IGST" ? lineTax : 0;
  const cgst =
    safeTaxMode === "CGST_SGST" ? roundCurrency(lineTax / 2) : 0;
  const sgst =
    safeTaxMode === "CGST_SGST" ? roundCurrency(lineTax - cgst) : 0;

  return {
    lineSubtotal,
    lineTax,
    lineTotal: roundCurrency(lineSubtotal + lineTax),
    cgst,
    sgst,
    igst,
  };
};

export const calculateInvoiceTotals = (
  items: InvoiceCalcItem[],
  discount = 0,
  taxMode: TaxMode = "GST",
): InvoiceTotals => {
  const totals = calculateSharedInvoiceTotals({
    items,
    discountValue: discount,
    taxMode: toInvoiceTaxMode(taxMode),
  });
  const safeTaxMode = toInvoiceTaxMode(taxMode);

  return {
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: totals.discount,
    total: totals.total,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    items: totals.items.map((item) => {
      const lineCgst =
        safeTaxMode === "CGST_SGST" ? roundCurrency(item.lineTax / 2) : 0;
      const lineSgst =
        safeTaxMode === "CGST_SGST"
          ? roundCurrency(item.lineTax - lineCgst)
          : 0;

      return {
        product_id: item.product_id ?? undefined,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.tax_rate ?? undefined,
        lineSubtotal: item.lineSubtotal,
        lineTax: item.lineTax,
        lineTotal: item.lineTotal,
        cgst: lineCgst,
        sgst: lineSgst,
        igst: safeTaxMode === "IGST" ? item.lineTax : 0,
      };
    }),
  };
};
