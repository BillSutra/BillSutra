import { useMemo } from "react";
import type {
  DiscountType,
  InvoiceItemForm,
  InvoiceTotals,
  TaxMode,
} from "@/types/invoice";
import { calculateInvoiceTotals } from "../../../../shared/invoice-calculations";

export const useInvoiceTotals = (
  items: InvoiceItemForm[],
  discountValue: string | number,
  discountType: DiscountType,
  taxMode: TaxMode,
) =>
  useMemo<InvoiceTotals>(() => {
    const totals = calculateInvoiceTotals({
      items,
      discountValue,
      discountType,
      taxMode,
    });

    return {
      subtotal: totals.subtotal,
      tax: totals.tax,
      cgst: totals.cgst,
      sgst: totals.sgst,
      igst: totals.igst,
      discount: totals.discount,
      total: totals.total,
      items: totals.items,
    };
  }, [discountType, items, discountValue, taxMode]);
