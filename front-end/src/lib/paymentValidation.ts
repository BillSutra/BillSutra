import type { PaymentInput } from "@/lib/apiClient";

export type PaymentMethodValue = PaymentInput["method"];
export type PaymentStatusValue = PaymentInput["status"];

export const PAYMENT_METHOD_OPTIONS: PaymentMethodValue[] = [
  "UPI",
  "BANK_TRANSFER",
  "NEFT",
  "RTGS",
  "IMPS",
  "CARD",
  "CASH",
  "CHEQUE",
  "WALLET",
  "OTHER",
];

export const PAYMENT_STATUS_OPTIONS: PaymentStatusValue[] = [
  "PAID",
  "PARTIAL",
];

export const DIGITAL_PAYMENT_METHODS = new Set<PaymentMethodValue>([
  "UPI",
  "BANK_TRANSFER",
  "NEFT",
  "RTGS",
  "IMPS",
  "CARD",
  "WALLET",
]);

export const normalizeTransactionReference = (value: string) =>
  value.trim().toUpperCase();

export const isDigitalPaymentMethod = (method?: PaymentMethodValue | "") =>
  Boolean(method && DIGITAL_PAYMENT_METHODS.has(method));

export type PaymentFormValues = {
  amount: string;
  status: PaymentStatusValue | "";
  method: PaymentMethodValue | "";
  paymentDate: string;
  transactionId: string;
  notes: string;
  chequeNumber: string;
  bankName: string;
  depositDate: string;
};

export type PaymentFormErrors = Partial<Record<keyof PaymentFormValues, string>>;

export const createEmptyPaymentFormValues = (
  defaults?: Partial<PaymentFormValues>,
): PaymentFormValues => ({
  amount: defaults?.amount ?? "",
  status: defaults?.status ?? "PAID",
  method: defaults?.method ?? "CASH",
  paymentDate:
    defaults?.paymentDate ?? new Date().toISOString().slice(0, 10),
  transactionId: defaults?.transactionId ?? "",
  notes: defaults?.notes ?? "",
  chequeNumber: defaults?.chequeNumber ?? "",
  bankName: defaults?.bankName ?? "",
  depositDate: defaults?.depositDate ?? "",
});

export const validatePaymentForm = (
  values: PaymentFormValues,
  context: {
    dueAmount: number;
    customerName?: string | null;
    invoiceReference?: string | null;
  },
): PaymentFormErrors => {
  const errors: PaymentFormErrors = {};
  const amount = Number(values.amount);

  if (!context.customerName?.trim()) {
    errors.amount = "Customer is required before recording a payment.";
  }

  if (!context.invoiceReference?.trim()) {
    errors.amount = "Invoice reference is required before recording a payment.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = "Enter a valid payment amount.";
  } else {
    const scaled = Math.round(amount * 100);
    if (Math.abs(amount * 100 - scaled) > 1e-6) {
      errors.amount = "Amount can have at most 2 decimal places.";
    } else if (amount > context.dueAmount + 0.009) {
      errors.amount = "Amount exceeds due balance.";
    } else if (values.status === "PARTIAL" && amount >= context.dueAmount - 0.009) {
      errors.amount = "Partial amount must be less than the due balance.";
    } else if (
      values.status === "PAID" &&
      amount < context.dueAmount - 0.009
    ) {
      errors.amount = "Use Partial status when amount is less than due balance.";
    }
  }

  if (!values.method) {
    errors.method = "Select payment method.";
  }

  if (!values.status) {
    errors.status = "Select payment status.";
  }

  const parsedPaymentDate = new Date(values.paymentDate);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const oldestAllowedDate = new Date("2000-01-01T00:00:00.000Z");

  if (!values.paymentDate || Number.isNaN(parsedPaymentDate.getTime())) {
    errors.paymentDate = "Payment date invalid.";
  } else if (parsedPaymentDate.getTime() > today.getTime()) {
    errors.paymentDate = "Payment date invalid.";
  } else if (parsedPaymentDate.getTime() < oldestAllowedDate.getTime()) {
    errors.paymentDate = "Payment date invalid.";
  }

  const normalizedTransactionId = normalizeTransactionReference(
    values.transactionId,
  );
  if (isDigitalPaymentMethod(values.method)) {
    if (!normalizedTransactionId) {
      errors.transactionId = "Enter valid UTR number.";
    } else if (
      normalizedTransactionId.length < 6 ||
      normalizedTransactionId.length > 30 ||
      !/^[A-Z0-9-]+$/.test(normalizedTransactionId)
    ) {
      errors.transactionId = "Enter valid UTR number.";
    }
  }

  if (values.method === "CHEQUE") {
    if (!values.chequeNumber.trim()) {
      errors.chequeNumber = "Cheque number is required.";
    }
    if (!values.bankName.trim()) {
      errors.bankName = "Bank name is required.";
    }

    const parsedDepositDate = new Date(values.depositDate);
    if (!values.depositDate || Number.isNaN(parsedDepositDate.getTime())) {
      errors.depositDate = "Deposit date invalid.";
    } else if (parsedDepositDate.getTime() > today.getTime()) {
      errors.depositDate = "Deposit date invalid.";
    } else if (parsedDepositDate.getTime() < oldestAllowedDate.getTime()) {
      errors.depositDate = "Deposit date invalid.";
    }
  }

  return errors;
};
