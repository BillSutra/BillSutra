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
  totalBase: number;
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
      gst_type: Exclude<TaxMode, "GST">;
      baseAmount: number;
    }
  >;
};

const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const normalizeTaxMode = (
  value?: string | null,
): Exclude<TaxMode, "GST"> =>
  value === "IGST" || value === "CGST_SGST" || value === "NONE"
    ? value
    : "CGST_SGST";

const getAppliedDiscountAmount = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: number;
  discountType: "PERCENTAGE" | "FIXED";
}) => {
  const safeSubtotal = Math.max(0, roundCurrency(subtotal));
  const safeDiscountValue = Math.max(0, Number(discountValue) || 0);

  if (safeSubtotal <= 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    return roundCurrency((safeSubtotal * Math.min(100, safeDiscountValue)) / 100);
  }

  return roundCurrency(Math.min(safeSubtotal, safeDiscountValue));
};

const toInvoiceTaxMode = (taxMode: TaxMode): Exclude<TaxMode, "GST"> =>
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
  discountType: "PERCENTAGE" | "FIXED" = "FIXED",
): InvoiceTotals => {
  const safeTaxMode = toInvoiceTaxMode(taxMode);
  const computedItems = items.map((item) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    const taxRate = Math.max(0, Number(item.tax_rate) || 0);
    const lineSubtotal = roundCurrency(quantity * price);
    const lineTax =
      safeTaxMode === "NONE" ? 0 : roundCurrency((lineSubtotal * taxRate) / 100);
    const cgst =
      safeTaxMode === "CGST_SGST" ? roundCurrency(lineTax / 2) : 0;
    const sgst =
      safeTaxMode === "CGST_SGST" ? roundCurrency(lineTax - cgst) : 0;
    const igst = safeTaxMode === "IGST" ? lineTax : 0;

    return {
      product_id: item.product_id ?? undefined,
      name: item.name,
      quantity,
      price,
      tax_rate: item.tax_rate ?? undefined,
      gst_type: safeTaxMode,
      baseAmount: lineSubtotal,
      lineSubtotal,
      lineTax,
      lineTotal: roundCurrency(lineSubtotal + lineTax),
      cgst,
      sgst,
      igst,
    };
  });

  const subtotal = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.lineSubtotal, 0),
  );
  const tax = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.lineTax, 0),
  );
  const discountAmount = getAppliedDiscountAmount({
    subtotal,
    discountValue: discount,
    discountType,
  });
  const total = roundCurrency(Math.max(0, subtotal - discountAmount + tax));
  const cgst = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.cgst, 0),
  );
  const sgst = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.sgst, 0),
  );
  const igst = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.igst, 0),
  );

  return {
    subtotal,
    totalBase: subtotal,
    tax,
    discount: discountAmount,
    total,
    cgst,
    sgst,
    igst,
    items: computedItems,
  };
};
