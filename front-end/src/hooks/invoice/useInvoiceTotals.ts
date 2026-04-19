import { useMemo } from "react";
import type {
  DiscountType,
  InvoiceItemForm,
  InvoiceTotals,
  TaxMode,
} from "@/types/invoice";
import { getAppliedDiscountAmount } from "@/lib/invoiceDiscount";

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const useInvoiceTotals = (
  items: InvoiceItemForm[],
  discountValue: string | number,
  discountType: DiscountType,
  taxMode: TaxMode,
) =>
  useMemo<InvoiceTotals>(() => {
    let subtotal = 0;
    let tax = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    items.forEach((item) => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const taxRate = Number(item.tax_rate) || 0;
      const lineSubtotal = quantity * price;
      const lineTax = taxMode === "NONE" ? 0 : (lineSubtotal * taxRate) / 100;

      subtotal += lineSubtotal;
      tax += lineTax;

      if (taxMode === "CGST_SGST") {
        cgst += lineTax / 2;
        sgst += lineTax / 2;
      } else if (taxMode === "IGST") {
        igst += lineTax;
      }
    });

    const discount = getAppliedDiscountAmount({
      subtotal,
      discountValue,
      discountType,
    });
    const total = subtotal + tax - discount;

    return {
      subtotal: round2(subtotal),
      tax: round2(tax),
      cgst: round2(cgst),
      sgst: round2(sgst),
      igst: round2(igst),
      discount: round2(discount),
      total: round2(Math.max(0, total)),
    };
  }, [discountType, items, discountValue, taxMode]);
