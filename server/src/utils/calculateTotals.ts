export type InvoiceCalcItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
};

export type InvoiceCalcResultItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  total: number;
  lineSubtotal: number;
  lineTax: number;
};

export type InvoiceTotals = {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  items: InvoiceCalcResultItem[];
};

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const calculateTotals = (
  items: InvoiceCalcItem[],
  discount = 0,
  discountType: "PERCENTAGE" | "FIXED" = "FIXED",
): InvoiceTotals => {
  let subtotal = 0;
  let tax = 0;

  const computedItems = items.map((item) => {
    const lineSubtotal = item.quantity * item.price;
    const lineTax = item.tax_rate ? (lineSubtotal * item.tax_rate) / 100 : 0;
    subtotal += lineSubtotal;
    tax += lineTax;

    return {
      product_id: item.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      total: round2(lineSubtotal + lineTax),
      lineSubtotal: round2(lineSubtotal),
      lineTax: round2(lineTax),
    };
  });

  const safeDiscountValue = Math.max(0, discount);
  const safeDiscount =
    discountType === "PERCENTAGE"
      ? round2((subtotal * Math.min(100, safeDiscountValue)) / 100)
      : round2(Math.min(subtotal + tax, safeDiscountValue));
  const total = round2(subtotal + tax - safeDiscount);

  return {
    subtotal: round2(subtotal),
    tax: round2(tax),
    discount: round2(safeDiscount),
    total: Math.max(0, total),
    items: computedItems,
  };
};
