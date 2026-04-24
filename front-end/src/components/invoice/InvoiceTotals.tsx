"use client";

import type {
  DiscountType,
  InvoiceTotals as Totals,
  TaxMode,
} from "@/types/invoice";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceTotalsProps = {
  totals: Totals;
  taxMode: TaxMode;
  discountValue?: string | number;
  discountType: DiscountType;
  discountLabel?: string;
  paidAmount?: number;
  remainingAmount?: number;
  action?: React.ReactNode;
  topSlot?: React.ReactNode;
  eyebrow?: string;
  title?: string;
  description?: string;
  statusLabel?: string;
  className?: string;
};

const InvoiceTotals = ({
  totals,
  taxMode,
  discountValue = 0,
  discountType,
  discountLabel,
  paidAmount,
  remainingAmount,
  action,
  topSlot,
  eyebrow = "Checkout",
  title = "Bill summary",
  description = "Review totals, GST, and payment status before generating the bill.",
  statusLabel = "Live",
  className,
}: InvoiceTotalsProps) => {
  const { formatCurrency, t } = useI18n();
  const normalizedDiscountValue = Math.max(0, Number(discountValue) || 0);
  const resolvedDiscountLabel =
    discountLabel ??
    (discountType === "PERCENTAGE"
      ? t("invoiceTotals.discountPercentage", {
          value: Math.min(100, normalizedDiscountValue).toFixed(2),
        })
      : t("invoiceTotals.discountFixed"));

  return (
    <div
      className={cn(
        "no-print rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-5 shadow-[0_28px_58px_-42px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(15,23,42,0.94)_100%)] dark:shadow-[0_26px_55px_-38px_rgba(0,0,0,0.48)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {description}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {statusLabel}
        </div>
      </div>

      <div className="mt-4 rounded-[1.45rem] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.45)] dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
          Bill total
        </p>
        <p className="mt-2 text-4xl font-semibold tracking-tight">
          {formatCurrency(totals.total)}
        </p>
      </div>

      {topSlot ? <div className="mt-4">{topSlot}</div> : null}

      <div className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
          <span className="text-slate-600 dark:text-slate-300">
            {t("invoiceTotals.subtotal")}
          </span>
          <span className="font-medium text-slate-950 dark:text-slate-100">
            {formatCurrency(totals.subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
          <span className="text-slate-600 dark:text-slate-300">
            {resolvedDiscountLabel}
          </span>
          <span className="font-medium text-slate-950 dark:text-slate-100">
            -{formatCurrency(totals.discount)}
          </span>
        </div>

        {taxMode === "CGST_SGST" ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
              <span className="text-slate-600 dark:text-slate-300">
                {t("invoiceTotals.cgst")}
              </span>
              <span className="font-medium text-slate-950 dark:text-slate-100">
                {formatCurrency(totals.cgst)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
              <span className="text-slate-600 dark:text-slate-300">
                {t("invoiceTotals.sgst")}
              </span>
              <span className="font-medium text-slate-950 dark:text-slate-100">
                {formatCurrency(totals.sgst)}
              </span>
            </div>
          </div>
        ) : null}

        {taxMode === "IGST" ? (
          <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
            <span className="text-slate-600 dark:text-slate-300">
              {t("invoiceTotals.igst")}
            </span>
            <span className="font-medium text-slate-950 dark:text-slate-100">
              {formatCurrency(totals.igst)}
            </span>
          </div>
        ) : null}

        {taxMode !== "NONE" ? (
          <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
            <span className="text-slate-600 dark:text-slate-300">
              {t("invoiceTotals.totalGst")}
            </span>
            <span className="font-medium text-slate-950 dark:text-slate-100">
              {formatCurrency(totals.tax)}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-[1.15rem] bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
          <span className="text-slate-600 dark:text-slate-300">
            {t("invoiceTotals.total")}
          </span>
          <span className="font-medium text-slate-950 dark:text-slate-100">
            {formatCurrency(totals.total)}
          </span>
        </div>

        {typeof paidAmount === "number" &&
        typeof remainingAmount === "number" ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-[1.15rem] bg-emerald-50 px-4 py-3 ring-1 ring-emerald-200/80 dark:bg-emerald-950/30 dark:ring-emerald-900/60">
              <span className="text-emerald-700 dark:text-emerald-200">
                {t("invoicePreview.paid")}
              </span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-200">
                {formatCurrency(paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[1.15rem] bg-rose-50 px-4 py-3 ring-1 ring-rose-200/80 dark:bg-rose-950/30 dark:ring-rose-900/60">
              <span className="text-rose-700 dark:text-rose-200">
                {t("invoicePreview.balance")}
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-200">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {action ? action : null}
    </div>
  );
};

export default InvoiceTotals;
