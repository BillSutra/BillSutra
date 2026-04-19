import type { DiscountType } from "@/types/invoice";

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const parseDiscountInput = (value: string | number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
};

export const getAppliedDiscountAmount = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: string | number;
  discountType: DiscountType;
}) => {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDiscountValue = parseDiscountInput(discountValue);

  if (discountType === "PERCENTAGE") {
    return round2((safeSubtotal * Math.min(100, safeDiscountValue)) / 100);
  }

  return round2(Math.min(safeSubtotal, safeDiscountValue));
};

export const getDiscountValidationMessage = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: string | number;
  discountType: DiscountType;
}) => {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  const safeDiscountValue = parseDiscountInput(discountValue);

  if (safeSubtotal <= 0 && safeDiscountValue > 0) {
    return "Add items first to apply a discount.";
  }

  if (discountType === "PERCENTAGE" && safeDiscountValue > 100) {
    return "Discount percentage cannot exceed 100%.";
  }

  if (discountType === "FIXED" && safeDiscountValue > safeSubtotal) {
    return "Discount cannot exceed total amount.";
  }

  return null;
};

export const buildDiscountLabel = ({
  discountType,
  discountValue,
  formatCurrency,
}: {
  discountType: DiscountType;
  discountValue: string | number;
  formatCurrency: (value: number) => string;
}) => {
  const safeDiscountValue = parseDiscountInput(discountValue);

  if (discountType === "PERCENTAGE") {
    return `Discount (${Math.min(100, safeDiscountValue).toFixed(2)}%)`;
  }

  return `Discount (${formatCurrency(safeDiscountValue)})`;
};
