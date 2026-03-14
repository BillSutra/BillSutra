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

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateLineTotals = (
  quantity: number,
  price: number,
  taxRate?: number | null,
  taxMode: TaxMode = "GST",
): LineTotals => {
  const lineSubtotal = round2(quantity * price);
  const rate = taxRate ?? 0;
  const lineTax = taxMode === "NONE" ? 0 : round2((lineSubtotal * rate) / 100);

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (taxMode === "CGST_SGST") {
    cgst = round2(lineTax / 2);
    sgst = round2(lineTax / 2);
  } else if (taxMode === "IGST") {
    igst = lineTax;
  }

  return {
    lineSubtotal,
    lineTax,
    lineTotal: round2(lineSubtotal + lineTax),
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
  let subtotal = 0;
  let tax = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  const computedItems = items.map((item) => {
    const totals = calculateLineTotals(
      item.quantity,
      item.price,
      item.tax_rate,
      taxMode,
    );

    subtotal += totals.lineSubtotal;
    tax += totals.lineTax;
    cgst += totals.cgst;
    sgst += totals.sgst;
    igst += totals.igst;

    return {
      product_id: item.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      ...totals,
    };
  });

  const safeDiscount = Math.max(0, discount);
  const total = round2(subtotal + tax - safeDiscount);

  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    discount: round2(safeDiscount),
    total: Math.max(0, total),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    items: computedItems,
  };
};
