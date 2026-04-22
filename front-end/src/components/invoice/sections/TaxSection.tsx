"use client";

import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import {
  calculateTaxBreakdown,
  calculateTotals,
  formatCurrency,
} from "./utils";
import { useI18n } from "@/providers/LanguageProvider";

const TaxSection = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("tax");
  const { t } = useI18n();
  const totals = data.totals ?? calculateTotals(data.items);
  const taxBreakdown = calculateTaxBreakdown(data.items).filter(
    (entry) => entry.rate > 0 || entry.taxAmount > 0,
  );
  const subtotal = totals.subtotal ?? calculateTotals(data.items).subtotal;
  const totalTax = totals.tax ?? calculateTotals(data.items).tax;
  const discount = totals.discount ?? 0;
  const grandTotal = totals.total ?? subtotal + totalTax - discount;

  return (
    <section
      className="border border-slate-400 bg-white"
      style={style}
      data-template-block="tax"
    >
      <p
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
        data-part="section-title"
      >
        {t("invoicePreview.taxSummary")}
      </p>

      <div className="grid gap-3 px-2 py-3 text-[0.9em]">
        <div className="grid gap-2 sm:grid-cols-2">
          <div
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
            data-part="tax-summary-card"
          >
            <p className="text-[0.78em] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {t("invoicePreview.subtotalBeforeTax")}
            </p>
            <p className="mt-1 text-[1.05em] font-semibold text-slate-900">
              {formatCurrency(subtotal, data.business.currency)}
            </p>
          </div>
          <div
            className="rounded-md border px-3 py-2"
            style={{
              borderColor: `${theme.primaryColor}55`,
              backgroundColor: `${theme.primaryColor}12`,
            }}
            data-part="tax-summary-card"
          >
            <p className="text-[0.78em] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {t("invoicePreview.totalTaxAmount")}
            </p>
            <p className="mt-1 text-[1.05em] font-semibold text-slate-900">
              {formatCurrency(totalTax, data.business.currency)}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table
            className="min-w-full text-left text-[0.9em]"
            data-part="tax-breakdown-table"
          >
            <thead
              className="text-[0.76em] uppercase tracking-[0.12em] text-slate-600"
              style={{ backgroundColor: `${theme.primaryColor}14` }}
            >
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                  {t("invoicePreview.taxRate")}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                  {t("invoicePreview.taxableSubtotal")}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                  {t("invoicePreview.calculation")}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                  {t("invoicePreview.taxAmount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {taxBreakdown.length ? (
                taxBreakdown.map((entry) => (
                  <tr key={entry.rate}>
                    <td className="border-b border-slate-200 px-3 py-2 font-medium text-slate-900">
                      {entry.rate.toFixed(2)}%
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-right text-slate-700">
                      {formatCurrency(entry.taxableSubtotal, data.business.currency)}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-slate-600">
                      {t("invoicePreview.taxFormula", {
                        subtotal: formatCurrency(
                          entry.taxableSubtotal,
                          data.business.currency,
                        ),
                        rate: `${entry.rate.toFixed(2)}%`,
                      })}
                    </td>
                    <td className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-900">
                      {formatCurrency(entry.taxAmount, data.business.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-center text-slate-500"
                  >
                    {t("invoicePreview.noTaxApplied")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3"
          data-part="tax-total-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{t("invoicePreview.subtotal")}</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(subtotal, data.business.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">{t("invoicePreview.totalTaxAmount")}</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(totalTax, data.business.currency)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                {data.discount?.label ?? t("invoicePreview.discount")}
              </span>
              <span className="font-medium text-slate-900">
                -{formatCurrency(discount, data.business.currency)}
              </span>
            </div>
          ) : null}
          <div
            className="flex items-center justify-between rounded-md px-3 py-2 text-[1em] font-semibold"
            style={{ backgroundColor: `${theme.primaryColor}18` }}
          >
            <span>{t("invoicePreview.grandTotalIncludingTax")}</span>
            <span>{formatCurrency(grandTotal, data.business.currency)}</span>
          </div>
        </div>

        <p className="text-[0.78em] text-slate-500">
          {t("invoicePreview.calculationNote")}
        </p>
      </div>
    </section>
  );
};

export default TaxSection;
