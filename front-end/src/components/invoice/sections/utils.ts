import type { InvoiceLineItem } from "@/types/invoice-template";

export const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const roundCurrencyValue = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

export type TaxBreakdownEntry = {
  rate: number;
  taxableSubtotal: number;
  taxAmount: number;
};

export const calculateTaxBreakdown = (
  items: InvoiceLineItem[],
): TaxBreakdownEntry[] => {
  const grouped = new Map<number, TaxBreakdownEntry>();

  items.forEach((item) => {
    const taxableSubtotal = roundCurrencyValue(item.quantity * item.unitPrice);
    const rate = roundCurrencyValue(item.taxRate ?? 0);
    const taxAmount = roundCurrencyValue(taxableSubtotal * (rate / 100));
    const current = grouped.get(rate);

    if (current) {
      current.taxableSubtotal = roundCurrencyValue(
        current.taxableSubtotal + taxableSubtotal,
      );
      current.taxAmount = roundCurrencyValue(current.taxAmount + taxAmount);
      return;
    }

    grouped.set(rate, {
      rate,
      taxableSubtotal,
      taxAmount,
    });
  });

  return Array.from(grouped.values()).sort((left, right) => left.rate - right.rate);
};

export const calculateTotals = (items: InvoiceLineItem[]) => {
  const subtotal = roundCurrencyValue(
    items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    ),
  );
  const tax = roundCurrencyValue(
    items.reduce((sum, item) => {
      const rate = item.taxRate ?? 0;
      return sum + item.quantity * item.unitPrice * (rate / 100);
    }, 0),
  );
  return {
    subtotal,
    tax,
    discount: 0,
    total: roundCurrencyValue(subtotal + tax),
  };
};
