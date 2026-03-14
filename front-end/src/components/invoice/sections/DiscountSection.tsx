import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { formatCurrency } from "./utils";

const DiscountSection = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("discount");
  const discountAmount = 0;

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <p
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Discounts
      </p>
      <div className="flex items-center justify-between px-2 py-2 text-[0.92em]">
        <span>Discount applied</span>
        <span className="font-semibold">
          {formatCurrency(discountAmount, data.business.currency)}
        </span>
      </div>
    </section>
  );
};

export default DiscountSection;
