import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatAmountInWords } from "./utils";

const Notes = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("notes");
  const totals = data.totals ?? calculateTotals(data.items);
  return (
    <section
      className="border border-slate-400 bg-white"
      style={style}
      data-template-block="notes"
    >
      <div
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
        data-part="section-title"
      >
        Invoice Amount in Words
      </div>
      <p
        className="border-b border-slate-300 px-2 py-2 text-[0.9em]"
        data-part="amount-words"
      >
        {formatAmountInWords(totals.total, data.business.currency)}
      </p>
      <div
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
        data-part="section-title"
      >
        Terms and Conditions
      </div>
      <p className="px-2 py-2 text-[0.9em]" data-part="terms-copy">
        {data.notes || "No additional terms provided."}
      </p>
    </section>
  );
};

export default Notes;
