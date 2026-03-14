import { PaymentMethod, PaymentStatus } from "@prisma/client";

export type PaymentInput = {
  totalAmount: number;
  paidAmount?: number;
  paymentStatus?: PaymentStatus;
  paymentDate?: Date;
  paymentMethod?: PaymentMethod;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const computePaymentState = ({
  totalAmount,
  paidAmount,
  paymentStatus,
  paymentDate,
  paymentMethod,
}: PaymentInput) => {
  const safeTotal = Number.isFinite(totalAmount) ? Math.max(totalAmount, 0) : 0;
  let safePaid = Number.isFinite(Number(paidAmount)) ? Number(paidAmount) : 0;

  if (paymentStatus === PaymentStatus.PAID) {
    safePaid = safeTotal;
  } else if (paymentStatus === PaymentStatus.UNPAID) {
    safePaid = 0;
  }

  safePaid = clamp(safePaid, 0, safeTotal);

  let resolvedStatus: PaymentStatus;
  if (safePaid === 0) {
    resolvedStatus = PaymentStatus.UNPAID;
  } else if (safePaid === safeTotal) {
    resolvedStatus = PaymentStatus.PAID;
  } else {
    resolvedStatus = PaymentStatus.PARTIALLY_PAID;
  }

  const pendingAmount = Math.max(safeTotal - safePaid, 0);

  const resolvedPaymentDate =
    resolvedStatus === PaymentStatus.UNPAID
      ? null
      : (paymentDate ?? new Date());

  const resolvedPaymentMethod =
    resolvedStatus === PaymentStatus.UNPAID ? null : (paymentMethod ?? null);

  return {
    totalAmount: safeTotal,
    paidAmount: safePaid,
    pendingAmount,
    paymentStatus: resolvedStatus,
    paymentDate: resolvedPaymentDate,
    paymentMethod: resolvedPaymentMethod,
  };
};
