import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const Notes = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("notes");
  const totals = data.totals ?? calculateTotals(data.items);
  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <div
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Invoice Amount in Words
      </div>
      <p className="border-b border-slate-300 px-2 py-2 text-[0.9em]">
        Total amount: {formatCurrency(totals.total, data.business.currency)}
      </p>
      <div
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Terms and Conditions
      </div>
      <p className="px-2 py-2 text-[0.9em]">{data.notes}</p>
    </section>
  );
};

export default Notes;
