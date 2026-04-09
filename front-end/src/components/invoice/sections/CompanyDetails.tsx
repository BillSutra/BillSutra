import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { useI18n } from "@/providers/LanguageProvider";

const CompanyDetails = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("company_details");
  const { t } = useI18n();
  const business = data.business;

  return (
    <section
      className="rounded-[20px] border border-slate-200 bg-white"
      style={style}
      data-template-block="company"
    >
      <div className="grid gap-4 px-5 py-4 text-[0.88em] sm:grid-cols-[1.15fr_0.85fr] sm:items-start">
        <div data-part="from-card">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t("invoiceLabels.from")}
          </p>
          <p className="mt-2 font-semibold" style={{ color: theme.primaryColor }}>
            {business.businessName}
          </p>
          {business.address ? <p className="mt-1 text-slate-700">{business.address}</p> : null}
          <div className="mt-2 grid gap-1 text-slate-600">
            {business.phone ? <p>{business.phone}</p> : null}
            {business.email ? <p>{business.email}</p> : null}
            {business.website ? <p>{business.website}</p> : null}
          </div>
        </div>

        <div
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left sm:text-right"
          data-part="business-meta-card"
        >
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            {t("invoiceLabels.businessDetails")}
          </p>
          <div className="mt-3 grid gap-2 text-slate-700">
            {business.showTaxNumber && business.taxId ? (
              <p>
                <span className="font-semibold text-slate-900">
                  {t("invoiceLabels.taxId")}:
                </span>{" "}
                {business.taxId}
              </p>
            ) : null}
            <p>
              <span className="font-semibold text-slate-900">
                {t("invoiceLabels.currency")}:
              </span>{" "}
              {business.currency}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompanyDetails;
