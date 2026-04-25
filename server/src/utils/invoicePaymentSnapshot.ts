import { InvoiceStatus } from "@prisma/client";

const toNumber = (value: unknown) => Number(value ?? 0);

export type InvoiceComputedPaymentStatus =
  | "PAID"
  | "PARTIAL"
  | "UNPAID";

export const computeInvoiceStatus = (
  totalPaid: unknown,
  totalAmount: unknown,
): InvoiceComputedPaymentStatus => {
  const paid = Math.max(toNumber(totalPaid), 0);
  const total = Math.max(toNumber(totalAmount), 0);

  if (paid >= total && total > 0) {
    return "PAID";
  }

  if (paid > 0) {
    return "PARTIAL";
  }

  return "UNPAID";
};

export const mapStoredInvoiceStatus = (status?: string | null) => {
  if (status === InvoiceStatus.PAID) {
    return "PAID" as const;
  }

  if (status === InvoiceStatus.PARTIALLY_PAID) {
    return "PARTIAL" as const;
  }

  return "UNPAID" as const;
};

const isDynamicInvoiceStatusEnabled =
  process.env.USE_DYNAMIC_STATUS?.trim().toLowerCase() === "true";

export const isCollectibleInvoiceStatus = (status?: string | null) =>
  status !== InvoiceStatus.DRAFT && status !== InvoiceStatus.VOID;

export const roundInvoiceCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const clampInvoicePaidAmount = (
  total: unknown,
  paidAmount: unknown,
) => {
  const normalizedTotal = Math.max(toNumber(total), 0);
  const normalizedPaid = Math.max(toNumber(paidAmount), 0);

  return Math.min(normalizedPaid, normalizedTotal);
};

export const sumInvoicePaymentAmounts = (
  payments: Array<{ amount: unknown }>,
) =>
  roundInvoiceCurrency(
    payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0),
  );

export const computeInvoicePaymentSnapshot = (params: {
  total: unknown;
  status?: string | null;
  paidAmount: unknown;
  dueDate?: Date | string | null;
  now?: Date;
}) => {
  const { total, status, paidAmount, dueDate, now = new Date() } = params;
  const normalizedTotal = Math.max(toNumber(total), 0);
  const normalizedPaid = clampInvoicePaidAmount(normalizedTotal, paidAmount);
  const collectible = isCollectibleInvoiceStatus(status);
  const pendingAmount = collectible
    ? roundInvoiceCurrency(Math.max(normalizedTotal - normalizedPaid, 0))
    : 0;

  const paymentStatus = computeInvoiceStatus(normalizedPaid, normalizedTotal);

  const due =
    dueDate instanceof Date
      ? dueDate
      : typeof dueDate === "string" && dueDate.trim()
        ? new Date(dueDate)
        : null;

  const isOverdue =
    collectible &&
    pendingAmount > 0 &&
    due instanceof Date &&
    !Number.isNaN(due.getTime()) &&
    due.getTime() < now.getTime();

  return {
    totalAmount: roundInvoiceCurrency(normalizedTotal),
    paidAmount: roundInvoiceCurrency(normalizedPaid),
    pendingAmount,
    paymentStatus: isDynamicInvoiceStatusEnabled
      ? paymentStatus
      : mapStoredInvoiceStatus(status),
    dynamicPaymentStatus: paymentStatus,
    isCollectible: collectible,
    isOverdue,
  };
};

export const computeInvoicePaymentSnapshotFromPayments = (params: {
  total: unknown;
  status?: string | null;
  payments: Array<{ amount: unknown }>;
  dueDate?: Date | string | null;
  now?: Date;
}) =>
  computeInvoicePaymentSnapshot({
    total: params.total,
    status: params.status,
    dueDate: params.dueDate,
    now: params.now,
    paidAmount: sumInvoicePaymentAmounts(params.payments),
  });
