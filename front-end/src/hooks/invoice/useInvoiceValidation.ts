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
  const { language, t } = useI18n();

  return useMemo<InvoiceValidationResult>(() => {
    const copy =
      language === "hi"
        ? {
            chooseCustomer: "बिल बनाने से पहले ग्राहक चुनें।",
            chooseWarehouse:
              "अगर आप स्टॉक सिंक करना चाहते हैं, तो वेयरहाउस चुनें।",
            chooseProduct: "बिल बनाने के लिए कम से कम एक प्रोडक्ट जोड़ें।",
            warehouseSummary: "वेयरहाउस चुनने के बाद ही स्टॉक अपडेट होगा।",
            quantitySummary: "हर प्रोडक्ट की मात्रा सही रखें।",
            priceSummary: "हर प्रोडक्ट की सही कीमत भरें।",
            taxSummary: "जहां टैक्स हो, वहां सही टैक्स रेट भरें।",
          }
        : {
            chooseCustomer:
              "Please choose a customer before creating the bill.",
            chooseWarehouse:
              "Please choose a warehouse if you want stock to update automatically.",
            chooseProduct:
              "Please add at least one product to create the bill.",
            warehouseSummary: "Pick a warehouse before syncing stock.",
            quantitySummary: "Please check the quantity for each product.",
            priceSummary: "Please enter a valid price for each product.",
            taxSummary: "Please enter a valid tax rate wherever tax is used.",
          };
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
      summary.push(copy.chooseCustomer);
    }

    if (form.sync_sales && !form.warehouse_id) {
      missingWarehouse = true;
      summary.push(copy.chooseWarehouse);
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
      if (missingProduct) summary.push(copy.chooseProduct);
      if (missingWarehouse) summary.push(copy.warehouseSummary);
      if (invalidQuantity) summary.push(copy.quantitySummary);
      if (invalidPrice) summary.push(copy.priceSummary);
      if (invalidTax) summary.push(copy.taxSummary);
    }

    return { errors, summary };
  }, [form, items, language, t]);
};
