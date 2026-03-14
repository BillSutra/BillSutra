import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const ServiceItemsTable = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("service_items");
  const totals = calculateTotals(data.items);

  return (
    <section
      className="invoice-section border border-slate-400 bg-white"
      style={style}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="px-2 pt-2 text-[0.82em] font-semibold uppercase tracking-[0.12em]">
          Service items
        </p>
        <p className="px-2 pt-2 text-[0.92em]">
          Subtotal: {formatCurrency(totals.subtotal, data.business.currency)}
        </p>
      </div>
      <div className="mt-2 grid gap-0 border-t border-slate-300">
        {data.items.map((item, index) => {
          const lineTotal = item.quantity * item.unitPrice;
          const taxAmount = lineTotal * ((item.taxRate ?? 0) / 100);
          return (
            <div
              key={`${item.name}-${index}`}
              className="invoice-row border-b border-slate-300 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  {item.description ? (
                    <p className="text-[0.78em] opacity-70">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-[0.95em] opacity-80">
                  <p>Qty: {item.quantity}</p>
                  <p>
                    Rate:{" "}
                    {formatCurrency(item.unitPrice, data.business.currency)}
                  </p>
                  <p>Tax: {item.taxRate ?? 0}%</p>
                  <p
                    className="mt-2 font-semibold"
                    style={{ color: theme.primaryColor }}
                  >
                    {formatCurrency(
                      lineTotal + taxAmount,
                      data.business.currency,
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ServiceItemsTable;
