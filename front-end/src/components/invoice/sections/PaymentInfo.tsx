"use client";

import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";
import { useI18n } from "@/providers/LanguageProvider";

const PaymentInfo = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("payment_info");
  const { t } = useI18n();
  const totals = data.totals ?? calculateTotals(data.items);
  const paymentSummary = data.paymentSummary;
  const receivedAmount = paymentSummary?.paidAmount ?? 0;
  const balanceAmount = paymentSummary?.remainingAmount ?? totals.total - receivedAmount;

  return (
    <section
      className="rounded-[22px] border border-slate-200 bg-white"
      style={style}
    >
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t("invoicePreview.paymentTracking")}
          </p>
          <p className="mt-3 text-[1.02em] font-semibold text-slate-950">
            {paymentSummary?.statusLabel ?? t("invoicePreview.pending")}
          </p>
          <p className="mt-1 text-[0.82em] text-slate-500">
            {paymentSummary?.statusNote ?? data.paymentInfo}
          </p>

          <div className="mt-4 grid gap-2 text-[0.9em] text-slate-700">
            <div className="flex items-center justify-between">
              <span>{t("invoicePreview.paid")}</span>
              <span className="font-semibold">
                {formatCurrency(receivedAmount, data.business.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>{t("invoicePreview.balance")}</span>
              <span className="font-semibold">
                {formatCurrency(balanceAmount, data.business.currency)}
              </span>
            </div>
          </div>

          {paymentSummary?.history?.length ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
              <p className="text-[0.72em] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {t("invoicePreview.recentPayments")}
              </p>
              <div className="mt-3 grid gap-2 text-[0.78em] text-slate-600">
                {paymentSummary.history.slice(0, 3).map((payment, index) => (
                  <div
                    key={`${payment.amount}-${payment.paidAt ?? index}`}
                    className="flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatCurrency(payment.amount, data.business.currency)}
                      </p>
                      <p>{payment.method || t("invoicePreview.manualEntry")}</p>
                    </div>
                    <span>{payment.paidAt || "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t("invoicePreview.totals")}
          </p>
          <div className="mt-3 space-y-2 text-[0.9em]">
            <div className="flex items-center justify-between text-slate-700">
              <span>{t("invoicePreview.subtotal")}</span>
              <span>{formatCurrency(totals.subtotal, data.business.currency)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-700">
              <span>{t("invoicePreview.tax")}</span>
              <span>{formatCurrency(totals.tax, data.business.currency)}</span>
            </div>
            {totals.discount ? (
              <div className="flex items-center justify-between text-slate-700">
                <span>{t("invoicePreview.discount")}</span>
                <span>-{formatCurrency(totals.discount, data.business.currency)}</span>
              </div>
            ) : null}
            <div
              className="mt-3 flex items-center justify-between rounded-2xl px-4 py-3 font-semibold text-white"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <span>{t("invoicePreview.grandTotal")}</span>
              <span>{formatCurrency(totals.total, data.business.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaymentInfo;
