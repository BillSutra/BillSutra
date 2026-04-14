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
  totalAmount: number,
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
            paymentMethodRequired:
              "Paid या आंशिक भुगतान के लिए भुगतान तरीका चुनें।",
            partialPaidRequired:
              "आंशिक भुगतान के लिए 0 से अधिक भुगतान राशि दर्ज करें।",
            partialPaidTooHigh:
              "आंशिक भुगतान राशि कुल से कम होनी चाहिए।",
            totalRequired:
              "भुगतान स्थिति चुनने से पहले कम से कम एक सही आइटम जोड़ें।",
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
            paymentMethodRequired:
              "Payment method is required for paid or partial invoices.",
            partialPaidRequired:
              "Enter a paid amount greater than 0 for partial invoices.",
            partialPaidTooHigh:
              "Partial paid amount must be less than total.",
            totalRequired:
              "Add at least one valid line item before recording payment.",
          };
    const normalizedTotal = Math.max(0, Number(totalAmount) || 0);
    const errors: InvoiceItemError[] = items.map(() => ({}));
    const summary: string[] = [];
    let missingCustomer = false;
    let missingProduct = false;
    let invalidQuantity = false;
    let invalidPrice = false;
    let invalidTax = false;
    let missingPaymentMethod = false;
    let invalidPartialPaidAmount = false;
    let invalidPartialPaidTooHigh = false;
    let invalidPaymentWithoutTotal = false;

    const paymentStatus = form.payment_status;
    const requiresPaymentDetails =
      paymentStatus === "PAID" || paymentStatus === "PARTIALLY_PAID";

    if (!form.customer_id) {
      missingCustomer = true;
      summary.push(copy.chooseCustomer);
    }

    if (items.length === 0) {
      missingProduct = true;
    }

    items.forEach((item, index) => {
      if (!item.name.trim()) {
        errors[index].name = t("validation.invoiceEnterItemName");
        missingProduct = true;
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

    if (requiresPaymentDetails && normalizedTotal <= 0) {
      invalidPaymentWithoutTotal = true;
      summary.push(copy.totalRequired);
    }

    if (requiresPaymentDetails && !form.payment_method) {
      missingPaymentMethod = true;
      summary.push(copy.paymentMethodRequired);
    }

    if (paymentStatus === "PARTIALLY_PAID") {
      const paidAmount = Number(form.amount_paid);
      if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        invalidPartialPaidAmount = true;
        summary.push(copy.partialPaidRequired);
      } else if (normalizedTotal > 0 && paidAmount >= normalizedTotal) {
        invalidPartialPaidTooHigh = true;
        summary.push(copy.partialPaidTooHigh);
      }
    }

    if (
      missingCustomer ||
      missingProduct ||
      invalidQuantity ||
      invalidPrice ||
      invalidTax ||
      missingPaymentMethod ||
      invalidPartialPaidAmount ||
      invalidPartialPaidTooHigh ||
      invalidPaymentWithoutTotal
    ) {
      if (missingProduct) summary.push(copy.chooseProduct);
      if (invalidQuantity) summary.push(copy.quantitySummary);
      if (invalidPrice) summary.push(copy.priceSummary);
      if (invalidTax) summary.push(copy.taxSummary);
    }

    return { errors, summary };
  }, [form, items, language, t, totalAmount]);
};
