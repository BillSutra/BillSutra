import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const ItemsTable = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("items");
  const totals = calculateTotals(data.items);

  return (
    <section
      className="invoice-section border border-slate-400 bg-white"
      style={style}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="px-2 pt-2 text-[0.82em] font-semibold uppercase tracking-[0.12em]">
          Line items
        </p>
        <p className="px-2 pt-2 text-[0.92em]">
          Subtotal: {formatCurrency(totals.subtotal, data.business.currency)}
        </p>
      </div>
      <div className="mt-2 overflow-hidden border-t border-slate-400">
        <table className="min-w-full text-[0.95em]">
          <thead className="text-[0.78em] uppercase tracking-[0.12em]">
            <tr>
              <th className="border-b border-r border-slate-300 px-3 py-2 text-left font-semibold">
                Item
              </th>
              <th className="border-b border-r border-slate-300 px-3 py-2 text-right font-semibold">
                Qty
              </th>
              <th className="border-b border-r border-slate-300 px-3 py-2 text-right font-semibold">
                Rate
              </th>
              <th className="border-b border-r border-slate-300 px-3 py-2 text-right font-semibold">
                Tax
              </th>
              <th className="border-b border-slate-300 px-3 py-2 text-right font-semibold">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => {
              const lineTotal = item.quantity * item.unitPrice;
              const taxAmount = lineTotal * ((item.taxRate ?? 0) / 100);
              return (
                <tr key={item.name} className="invoice-row">
                  <td className="border-b border-r border-slate-200 px-3 py-2">
                    <p className="font-medium">{item.name}</p>
                    {item.description ? (
                      <p className="text-[0.78em] opacity-70">
                        {item.description}
                      </p>
                    ) : null}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-right opacity-80">
                    {item.quantity}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-right opacity-80">
                    {formatCurrency(item.unitPrice, data.business.currency)}
                  </td>
                  <td className="border-b border-r border-slate-200 px-3 py-2 text-right opacity-80">
                    {item.taxRate ?? 0}%
                  </td>
                  <td
                    className="border-b border-slate-200 px-3 py-2 text-right font-semibold"
                    style={{ color: theme.primaryColor }}
                  >
                    {formatCurrency(
                      lineTotal + taxAmount,
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
