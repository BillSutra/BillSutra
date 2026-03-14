import { useMemo } from "react";
import type {
  InvoiceFormState,
  InvoiceItemError,
  InvoiceItemForm,
} from "@/types/invoice";

export type InvoiceValidationResult = {
  errors: InvoiceItemError[];
  summary: string[];
};

export const useInvoiceValidation = (
  form: InvoiceFormState,
  items: InvoiceItemForm[],
) =>
  useMemo<InvoiceValidationResult>(() => {
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
      summary.push("Select a customer.");
    }

    if (form.sync_sales && !form.warehouse_id) {
      missingWarehouse = true;
      summary.push("Select a warehouse to sync inventory.");
    }

    items.forEach((item, index) => {
      if (!item.product_id) {
        errors[index].product_id = "Select a product.";
        missingProduct = true;
      }
      if (!item.name.trim()) {
        errors[index].name = "Enter an item name.";
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors[index].quantity = "Quantity must be greater than 0.";
        invalidQuantity = true;
      }

      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) {
        errors[index].price = "Price must be greater than 0.";
        invalidPrice = true;
      }

      if (item.tax_rate) {
        const taxRate = Number(item.tax_rate);
        if (!Number.isFinite(taxRate) || taxRate < 0) {
          errors[index].tax_rate = "Tax rate must be 0 or higher.";
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
      if (missingProduct) summary.push("Select a product for each line item.");
      if (missingWarehouse)
        summary.push("Choose a warehouse when syncing inventory.");
      if (invalidQuantity)
        summary.push("Ensure quantities are valid numbers greater than 0.");
      if (invalidPrice) summary.push("Enter a valid price for each item.");
      if (invalidTax)
        summary.push("Tax rates must be 0 or higher when provided.");
    }

    return { errors, summary };
  }, [form, items]);
