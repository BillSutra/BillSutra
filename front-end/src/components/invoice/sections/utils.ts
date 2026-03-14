import type { InvoiceLineItem } from "@/types/invoice-template";

export const formatCurrency = (value: number, currency: string) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

export const calculateTotals = (items: InvoiceLineItem[]) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const tax = items.reduce((sum, item) => {
    const rate = item.taxRate ?? 0;
    return sum + item.quantity * item.unitPrice * (rate / 100);
  }, 0);
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
};
