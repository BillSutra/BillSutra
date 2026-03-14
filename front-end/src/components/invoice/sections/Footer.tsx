import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";

const Footer = ({ data }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("footer");
  return (
    <section
      className="border border-slate-400 bg-white text-[0.9em]"
      style={style}
    >
      <div className="grid gap-0 sm:grid-cols-[1fr_0.46fr]">
        <div className="min-h-20 border-b border-slate-300 px-2 py-2 sm:border-b-0 sm:border-r">
          <p className="font-semibold">For {data.business.businessName}:</p>
          <p className="mt-1 text-[0.88em] text-slate-700">
            Thanks for doing business with us!
          </p>
        </div>
        <div className="flex min-h-20 items-center justify-center border-b border-slate-300 px-2 py-3 sm:border-b-0">
          <div className="rounded border border-dashed border-slate-500 bg-[#eaf4ff] px-5 py-3 font-semibold">
            Authorized Signatory
          </div>
        </div>
      </div>
    </section>
  );
};

export default Footer;
