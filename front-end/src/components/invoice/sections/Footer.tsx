import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";

const Footer = ({ data }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("footer");
  return (
    <section
      className="rounded-[22px] border border-slate-200 bg-white text-[0.88em]"
      style={style}
    >
      <div className="grid gap-0 sm:grid-cols-[1fr_0.46fr]">
        <div className="min-h-24 border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Thank you
          </p>
          <p className="mt-2 font-semibold text-slate-950">
            For {data.business.businessName}
          </p>
          <p className="mt-2 text-[0.86em] text-slate-600">
            {data.closingNote ?? "Thank you for your business."}
          </p>
        </div>
        <div className="flex min-h-24 items-center justify-center px-5 py-4">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-5 text-center font-semibold text-slate-700">
            {data.signatureLabel ?? "Authorized signatory"}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Footer;
