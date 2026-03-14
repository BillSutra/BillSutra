import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const TaxSection = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("tax");
  const totals = calculateTotals(data.items);

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <p
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Tax summary
      </p>
      <div className="flex items-center justify-between px-2 py-2 text-[0.92em]">
        <span>Total tax</span>
        <span className="font-semibold">
          {formatCurrency(totals.tax, data.business.currency)}
        </span>
      </div>
    </section>
  );
};

export default TaxSection;
