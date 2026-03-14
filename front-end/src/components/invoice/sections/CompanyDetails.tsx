import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";

const CompanyDetails = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("company_details");
  const business = data.business;

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <div className="grid gap-2 px-2 py-2 text-[0.9em] sm:grid-cols-[1.2fr_1fr] sm:items-start">
        <div>
          <p className="font-semibold" style={{ color: theme.primaryColor }}>
            {business.businessName}
          </p>
          <p>{business.address}</p>
          <p>{business.phone}</p>
          <p>{business.email}</p>
        </div>
        <div className="text-left sm:text-right">
          {business.website ? <p>{business.website}</p> : null}
          {business.showTaxNumber && business.taxId ? (
            <p className="mt-1 text-[0.8em] font-semibold uppercase tracking-[0.08em]">
              Tax ID: {business.taxId}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default CompanyDetails;
