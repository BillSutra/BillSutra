import { useMemo } from "react";
import type {
  InvoiceFormState,
  InvoiceItemError,
  InvoiceItemForm,
} from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

export type InvoiceValidationResult = {
  errors: InvoiceItemError[];
  summary: string[];
};

export const useInvoiceValidation = (
  form: InvoiceFormState,
  items: InvoiceItemForm[],
) => {
  const { t } = useI18n();

  return useMemo<InvoiceValidationResult>(() => {
    const errors: InvoiceItemError[] = items.map(() => ({}));
    const summary: string[] = [];
    let missingCustomer = false;
    let missingProduct = false;
    let missingWarehouse = false;
    let invalidQuantity = false;
    let invalidPrice = false;
    let invalidTax = false;

    if (!form.customer_id) {
      missingCustomer = true;
      summary.push(t("validation.invoiceSelectCustomer"));
    }

    if (form.sync_sales && !form.warehouse_id) {
      missingWarehouse = true;
      summary.push(t("validation.invoiceSelectWarehouse"));
    }

    if (items.length === 0) {
      missingProduct = true;
    }

    items.forEach((item, index) => {
      if (!item.product_id) {
        errors[index].product_id = t("validation.invoiceSelectProduct");
        missingProduct = true;
      }
      if (!item.name.trim()) {
        errors[index].name = t("validation.invoiceEnterItemName");
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = t("validation.invoiceQuantityPositive");
        invalidQuantity = true;
      }

      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) {
        errors[index].price = t("validation.invoicePricePositive");
        invalidPrice = true;
      }

      if (item.tax_rate) {
        const taxRate = Number(item.tax_rate);
        if (!Number.isFinite(taxRate) || taxRate < 0) {
          errors[index].tax_rate = t("validation.invoiceTaxPositive");
          invalidTax = true;
        }
      }
    });

    if (
      missingCustomer ||
      missingProduct ||
      missingWarehouse ||
      invalidQuantity ||
      invalidPrice ||
      invalidTax
    ) {
      if (missingProduct) summary.push(t("validation.invoiceEachLineItem"));
      if (missingWarehouse)
        summary.push(t("validation.invoiceWarehouseSync"));
      if (invalidQuantity)
        summary.push(t("validation.invoiceQuantitySummary"));
      if (invalidPrice) summary.push(t("validation.invoicePriceSummary"));
      if (invalidTax)
        summary.push(t("validation.invoiceTaxSummary"));
    }

    return { errors, summary };
  }, [form, items, t]);
};
