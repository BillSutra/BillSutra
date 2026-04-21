import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const ItemsTable = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("items");
  const totals = data.totals ?? calculateTotals(data.items);

  return (
    <section
      className="invoice-section overflow-hidden rounded-[22px] border border-slate-200 bg-white"
      style={style}
      data-template-block="items"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
        data-part="items-toolbar"
      >
        <div>
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Itemized billing
          </p>
          <p className="mt-1 text-[0.92em] text-slate-700">
            {data.items.length} item(s) on this invoice
          </p>
        </div>
        <p className="text-[0.95em] font-semibold text-slate-950" data-part="subtotal-text">
          Subtotal: {formatCurrency(totals.subtotal, data.business.currency)}
        </p>
      </div>
      <div className="overflow-hidden border-t border-slate-200">
        <table className="min-w-full text-[0.92em]" data-part="items-table">
          <thead className="bg-slate-50 text-[0.74em] uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold">
                Item
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                Qty
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                Rate
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => {
              const lineTotal = item.quantity * item.unitPrice;
              const taxAmount = lineTotal * ((item.taxRate ?? 0) / 100);
              const displayedAmount =
                typeof item.amount === "number"
                  ? item.amount
                  : lineTotal + taxAmount;
              return (
                <tr key={`${item.name}-${index}`} className="invoice-row">
                  <td className="border-b border-slate-200 px-4 py-3">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-[0.76em] text-slate-500">
                        {item.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[0.72em] uppercase tracking-[0.12em] text-slate-400">
                      Tax {item.taxRate ?? 0}%
                    </p>
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 text-right text-slate-600">
                    {item.quantity}
                  </td>
                  <td className="border-b border-slate-200 px-4 py-3 text-right text-slate-600">
                    {formatCurrency(item.unitPrice, data.business.currency)}
                  </td>
                  <td
                    className="border-b border-slate-200 px-4 py-3 text-right font-semibold"
                    style={{ color: theme.primaryColor }}
                    data-part="line-total-cell"
                  >
                    {formatCurrency(
                      displayedAmount,
                      data.business.currency,
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ItemsTable;
