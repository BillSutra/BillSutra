import type { Invoice } from "@/lib/apiClient";
import Env from "@/lib/env";

type PaymentRecord = Invoice["payments"][number];

export type InvoicePaymentSnapshot = {
  total: number;
  paid: number;
  remaining: number;
  progress: number;
  paymentStatus: "PAID" | "PARTIAL" | "PENDING";
  badgeVariant: "paid" | "pending" | "overdue";
  label: string;
  statusHint: string;
  lastPaymentAt: string | null;
};

const clampCurrency = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const sumPaymentAmount = (payments: PaymentRecord[]) =>
  clampCurrency(
    payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
  );

export const getLastPaymentDate = (payments: PaymentRecord[]) => {
  const sorted = [...payments]
    .filter((payment) => Boolean(payment.paid_at))
    .sort((left, right) => {
      const leftTime = new Date(left.paid_at ?? "").getTime();
      const rightTime = new Date(right.paid_at ?? "").getTime();
      return rightTime - leftTime;
    });

  return sorted[0]?.paid_at ?? null;
};

export const getInvoicePaymentSnapshot = (
  invoice: Pick<Invoice, "status" | "total" | "payments" | "computedStatus" | "totalPaid">,
): InvoicePaymentSnapshot => {
  const total = clampCurrency(Number(invoice.total ?? 0));
  const useDynamicStatus = Env.USE_DYNAMIC_STATUS === "true";
  const paidSource =
    useDynamicStatus && typeof invoice.totalPaid === "number"
      ? invoice.totalPaid
      : sumPaymentAmount(invoice.payments);
  const paid = Math.min(clampCurrency(paidSource), total);
  const remaining = Math.max(clampCurrency(total - paid), 0);
  const isOverdue = invoice.status === "OVERDUE";
  const computedStatus = useDynamicStatus ? invoice.computedStatus : undefined;

  if (computedStatus === "PAID" || (remaining <= 0 && total > 0)) {
    return {
      total,
      paid,
      remaining,
      progress: 100,
      paymentStatus: "PAID",
      badgeVariant: "paid",
      label: "Paid",
      statusHint: "Settled in full",
      lastPaymentAt: getLastPaymentDate(invoice.payments),
    };
  }

  if (
    computedStatus === "PARTIAL" ||
    paid > 0 ||
    invoice.status === "PARTIALLY_PAID"
  ) {
    return {
      total,
      paid,
      remaining,
      progress: total > 0 ? Math.min((paid / total) * 100, 100) : 0,
      paymentStatus: "PARTIAL",
      badgeVariant: isOverdue ? "overdue" : "pending",
      label: "Partial",
      statusHint: isOverdue ? "Follow-up needed" : "Partially collected",
      lastPaymentAt: getLastPaymentDate(invoice.payments),
    };
  }

  return {
    total,
    paid,
    remaining,
    progress: 0,
    paymentStatus: "PENDING",
    badgeVariant: isOverdue ? "overdue" : "pending",
    label: "Pending",
    statusHint:
      invoice.status === "DRAFT"
        ? "Draft invoice"
        : isOverdue
          ? "Payment overdue"
          : "Awaiting payment",
    lastPaymentAt: getLastPaymentDate(invoice.payments),
  };
};

export const formatPaymentMethodLabel = (
  method?: PaymentRecord["method"] | null,
) => {
  if (!method) return "Manual";

  return method
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};
