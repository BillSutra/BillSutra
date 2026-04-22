import type { DiscountType } from "@/types/invoice";
import {
  getAppliedDiscountAmount as getSharedAppliedDiscountAmount,
  getDiscountValidationMessage as getSharedDiscountValidationMessage,
  normalizeDiscountValue,
} from "../../../shared/invoice-calculations";

export const parseDiscountInput = (value: string | number) =>
  normalizeDiscountValue(value);

export const getAppliedDiscountAmount = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: string | number;
  discountType: DiscountType;
}) =>
  getSharedAppliedDiscountAmount({
    subtotal,
    discountValue,
    discountType,
  });

export const getDiscountValidationMessage = ({
  subtotal,
  discountValue,
  discountType,
}: {
  subtotal: number;
  discountValue: string | number;
  discountType: DiscountType;
}) =>
  getSharedDiscountValidationMessage({
    subtotal,
    discountValue,
    discountType,
  });

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
