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
  action?: React.ReactNode;
  className?: string;
};

const InvoiceTotals = ({
  totals,
  taxMode,
  discountValue = 0,
  discountType,
  action,
  className,
}: InvoiceTotalsProps) => {
  const { formatCurrency, t } = useI18n();
  const normalizedDiscountValue = Math.max(0, Number(discountValue) || 0);
  const discountLabel =
    discountType === "PERCENTAGE"
      ? t("invoiceTotals.discountPercentage", {
          value: Math.min(100, normalizedDiscountValue).toFixed(2),
        })
      : t("invoiceTotals.discountFixed");

  return (
    <div
      className={cn(
        "no-print rounded-[2rem] border border-[#dbe7ef] bg-[linear-gradient(180deg,#f8fcff_0%,#eef6ff_100%)] p-6 shadow-[0_26px_55px_-38px_rgba(37,99,235,0.35)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.96)_100%)] dark:shadow-[0_26px_55px_-38px_rgba(0,0,0,0.48)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700 dark:text-sky-200">
            Checkout
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Live bill summary
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Totals refresh instantly as the cart changes.
          </p>
        </div>
        <div className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-3 text-right shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Grand total
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {formatCurrency(totals.total)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
          <span className="text-slate-600 dark:text-slate-300">
            {t("invoiceTotals.subtotal")}
          </span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatCurrency(totals.subtotal)}
          </span>
        </div>

        {taxMode === "CGST_SGST" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
              <span className="text-slate-600 dark:text-slate-300">
                {t("invoiceTotals.cgst")}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(totals.cgst)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
              <span className="text-slate-600 dark:text-slate-300">
                {t("invoiceTotals.sgst")}
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(totals.sgst)}
              </span>
            </div>
          </div>
        ) : null}

        {taxMode === "IGST" ? (
          <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
            <span className="text-slate-600 dark:text-slate-300">
              {t("invoiceTotals.igst")}
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.igst)}
            </span>
          </div>
        ) : null}

        {taxMode !== "NONE" ? (
          <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
            <span className="text-slate-600 dark:text-slate-300">
              {t("invoiceTotals.totalGst")}
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(totals.tax)}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-slate-900/55">
          <span className="text-slate-600 dark:text-slate-300">{discountLabel}</span>
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {formatCurrency(totals.discount)}
          </span>
        </div>
      </div>

      {action ? action : null}
    </div>
  );
};

export default InvoiceTotals;
