import type { InvoiceLineItem } from "@/types/invoice-template";
import { calculateInvoiceTotals } from "../../../../../shared/invoice-calculations";

const DEFAULT_CURRENCY_CODE = "INR";

const normalizeCurrencyCode = (currency: string) => {
  const normalized = currency.trim().toUpperCase();

  if (
    normalized === "IN" ||
    normalized === "RS" ||
    normalized === "RUPEE" ||
    normalized === "RUPEES" ||
    normalized === "₹"
  ) {
    return DEFAULT_CURRENCY_CODE;
  }

  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  return DEFAULT_CURRENCY_CODE;
};

export const formatCurrency = (value: number, currency: string) => {
  const currencyCode = normalizeCurrencyCode(currency);

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: DEFAULT_CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
};

const SMALL_NUMBER_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS_WORDS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

const roundCurrencyValue = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const numberToWordsBelowThousand = (value: number): string => {
  if (value < 20) {
    return SMALL_NUMBER_WORDS[value] ?? "Zero";
  }

  if (value < 100) {
    const tens = Math.floor(value / 10);
    const remainder = value % 10;
    return remainder
      ? `${TENS_WORDS[tens]} ${SMALL_NUMBER_WORDS[remainder]}`
      : TENS_WORDS[tens];
  }

  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  return remainder
    ? `${SMALL_NUMBER_WORDS[hundreds]} Hundred ${numberToWordsBelowThousand(remainder)}`
    : `${SMALL_NUMBER_WORDS[hundreds]} Hundred`;
};

const numberToIndianWords = (value: number): string => {
  const normalizedValue = Math.floor(Math.max(0, value));
  if (normalizedValue === 0) {
    return SMALL_NUMBER_WORDS[0];
  }

  const parts: string[] = [];
  const scales: Array<[number, string]> = [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ];
  let remainder = normalizedValue;

  scales.forEach(([scaleValue, label]) => {
    if (remainder < scaleValue) return;
    const unitValue = Math.floor(remainder / scaleValue);
    parts.push(`${numberToWordsBelowThousand(unitValue)} ${label}`);
    remainder %= scaleValue;
  });

  if (remainder > 0) {
    parts.push(numberToWordsBelowThousand(remainder));
  }

  return parts.join(" ").trim();
};

export const formatAmountInWords = (value: number, currency: string) => {
  const currencyCode = normalizeCurrencyCode(currency);
  const roundedValue = roundCurrencyValue(value);
  const wholeUnits = Math.floor(roundedValue);
  const minorUnits = Math.round((roundedValue - wholeUnits) * 100);
  const usesIndianCurrency = currencyCode === "INR";
  const mainUnitLabel = usesIndianCurrency
    ? wholeUnits === 1
      ? "Rupee"
      : "Rupees"
    : currencyCode;
  const minorUnitLabel = usesIndianCurrency ? "Paise" : "Cents";

  const amountParts = [`${numberToIndianWords(wholeUnits)} ${mainUnitLabel}`];

  if (minorUnits > 0) {
    amountParts.push(
      `and ${numberToIndianWords(minorUnits)} ${minorUnitLabel}`,
    );
  }

  return `${amountParts.join(" ")} Only`;
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

  return Array.from(grouped.values()).sort(
    (left, right) => left.rate - right.rate,
  );
};

export const calculateTotals = (items: InvoiceLineItem[]) => {
  const totals = calculateInvoiceTotals({
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: item.unitPrice,
      tax_rate: item.taxRate ?? 0,
    })),
  });

  return {
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: 0,
    total: totals.total,
  };
};
