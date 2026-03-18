import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import {
  calculateTaxBreakdown,
  calculateTotals,
  formatCurrency,
} from "./utils";

const TaxSection = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("tax");
  const totals = data.totals ?? calculateTotals(data.items);
  const taxBreakdown = calculateTaxBreakdown(data.items).filter(
    (entry) => entry.rate > 0 || entry.taxAmount > 0,
  );
  const subtotal = totals.subtotal ?? calculateTotals(data.items).subtotal;
  const totalTax = totals.tax ?? calculateTotals(data.items).tax;
  const discount = totals.discount ?? 0;
  const grandTotal = totals.total ?? subtotal + totalTax - discount;

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <p
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Tax Summary
      </p>

      <div className="grid gap-3 px-2 py-3 text-[0.9em]">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[0.78em] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Subtotal Before Tax
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
          >
            <p className="text-[0.78em] font-semibold uppercase tracking-[0.12em] text-slate-600">
              Total Tax Amount
            </p>
            <p className="mt-1 text-[1.05em] font-semibold text-slate-900">
              {formatCurrency(totalTax, data.business.currency)}
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full text-left text-[0.9em]">
            <thead
              className="text-[0.76em] uppercase tracking-[0.12em] text-slate-600"
              style={{ backgroundColor: `${theme.primaryColor}14` }}
            >
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                  Tax Rate
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                  Taxable Subtotal
                </th>
                <th className="border-b border-slate-200 px-3 py-2 font-semibold">
                  Calculation
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right font-semibold">
                  Tax Amount
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
                      Tax Amount = {formatCurrency(entry.taxableSubtotal, data.business.currency)} x{" "}
                      {entry.rate.toFixed(2)}%
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
                    No tax rates applied. Tax amount is calculated as 0.00.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(subtotal, data.business.currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Total Tax</span>
            <span className="font-medium text-slate-900">
              {formatCurrency(totalTax, data.business.currency)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Discount</span>
              <span className="font-medium text-slate-900">
                -{formatCurrency(discount, data.business.currency)}
              </span>
            </div>
          ) : null}
          <div
            className="flex items-center justify-between rounded-md px-3 py-2 text-[1em] font-semibold"
            style={{ backgroundColor: `${theme.primaryColor}18` }}
          >
            <span>Grand Total (Including Tax)</span>
            <span>{formatCurrency(grandTotal, data.business.currency)}</span>
          </div>
        </div>

        <p className="text-[0.78em] text-slate-500">
          Calculation note: Tax Amount = Subtotal x Tax Rate. All values are
          rounded to 2 decimal places for invoice display.
        </p>
      </div>
    </section>
  );
};

export default TaxSection;
