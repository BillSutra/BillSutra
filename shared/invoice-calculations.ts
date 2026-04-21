export type InvoiceDiscountType = "PERCENTAGE" | "FIXED";
export type InvoiceTaxMode = "CGST_SGST" | "IGST" | "NONE";

type NumericInput = number | string | null | undefined;

export type InvoiceCalculationItemInput = {
  product_id?: number | string | null;
  name: string;
  quantity: NumericInput;
  price: NumericInput;
  tax_rate?: NumericInput;
};

export type InvoiceCalculatedItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
};

export type InvoiceCalculationResult = {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  cgst: number;
  sgst: number;
  igst: number;
  items: InvoiceCalculatedItem[];
};

export const roundCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const toFiniteNumber = (value: NumericInput) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const normalizeDiscountType = (
  value?: string | null,
): InvoiceDiscountType => (value === "PERCENTAGE" ? "PERCENTAGE" : "FIXED");

export const normalizeTaxMode = (value?: string | null): InvoiceTaxMode =>
  value === "IGST" || value === "CGST_SGST" || value === "NONE"
    ? value
    : "CGST_SGST";

export const normalizeDiscountValue = (value: NumericInput) =>
  Math.max(0, toFiniteNumber(value));

export const getAppliedDiscountAmount = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: NumericInput;
  discountType: InvoiceDiscountType;
}) => {
  const safeSubtotal = Math.max(0, roundCurrency(toFiniteNumber(subtotal)));
  const safeDiscountValue = normalizeDiscountValue(discountValue);

  if (safeSubtotal <= 0) {
    return 0;
  }

  if (discountType === "PERCENTAGE") {
    return roundCurrency((safeSubtotal * Math.min(100, safeDiscountValue)) / 100);
  }

  return roundCurrency(Math.min(safeSubtotal, safeDiscountValue));
};

export const getDiscountValidationMessage = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: NumericInput;
  discountType: InvoiceDiscountType;
}) => {
  const safeSubtotal = Math.max(0, roundCurrency(toFiniteNumber(subtotal)));
  const safeDiscountValue = normalizeDiscountValue(discountValue);

  if (safeSubtotal <= 0 && safeDiscountValue > 0) {
    return "Add items first to apply a discount.";
  }

  if (discountType === "PERCENTAGE" && safeDiscountValue > 100) {
    return "Discount percentage cannot exceed 100%.";
  }

  if (discountType === "FIXED" && safeDiscountValue > safeSubtotal) {
    return "Discount cannot exceed subtotal.";
  }

  return null;
};

export const calculateInvoiceTotals = ({
  items,
  discountValue = 0,
  discountType = "FIXED",
  taxMode = "CGST_SGST",
}: {
  items: InvoiceCalculationItemInput[];
  discountValue?: NumericInput;
  discountType?: InvoiceDiscountType;
  taxMode?: InvoiceTaxMode;
}): InvoiceCalculationResult => {
  const safeTaxMode = normalizeTaxMode(taxMode);
  const computedItems = items.map((item) => {
    const quantity = Math.max(0, toFiniteNumber(item.quantity));
    const price = Math.max(0, toFiniteNumber(item.price));
    const taxRate = Math.max(0, toFiniteNumber(item.tax_rate));
    const lineSubtotal = roundCurrency(quantity * price);
    const lineTax =
      safeTaxMode === "NONE"
        ? 0
        : roundCurrency((lineSubtotal * taxRate) / 100);

    return {
      product_id: item.product_id == null ? null : Number(item.product_id),
      name: item.name,
      quantity,
      price,
      tax_rate: item.tax_rate == null ? undefined : taxRate,
      lineSubtotal,
      lineTax,
      lineTotal: roundCurrency(lineSubtotal + lineTax),
    };
  });

  const subtotal = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.lineSubtotal, 0),
  );
  const tax = roundCurrency(
    computedItems.reduce((sum, item) => sum + item.lineTax, 0),
  );
  const safeDiscount = getAppliedDiscountAmount({
    subtotal,
    discountValue,
    discountType: normalizeDiscountType(discountType),
  });
  const total = roundCurrency(Math.max(0, subtotal - safeDiscount + tax));
  const igst = safeTaxMode === "IGST" ? tax : 0;
  const cgst =
    safeTaxMode === "CGST_SGST" ? roundCurrency(tax / 2) : 0;
  const sgst =
    safeTaxMode === "CGST_SGST" ? roundCurrency(tax - cgst) : 0;

  return {
    subtotal,
    tax,
    discount: safeDiscount,
    total,
    cgst,
    sgst,
    igst,
    items: computedItems,
  };
};
