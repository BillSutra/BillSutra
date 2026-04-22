import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { buildBusinessAddressLines } from "@/lib/indianAddress";

const Header = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("header");

  // useBusinessLogo defers the localStorage read to useEffect,
  // so SSR and initial client render both see null → no hydration mismatch.
  const { logo: storedLogo } = useBusinessLogo();
  const effectiveLogo = data.business.logoUrl || storedLogo;
  const businessAddressLines = buildBusinessAddressLines(
    data.business.businessAddress,
    data.business.address,
  );
  const paymentToneClassName =
    data.paymentSummary?.statusTone === "paid"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : data.paymentSummary?.statusTone === "partial"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <section
      className="overflow-hidden rounded-[22px] border border-slate-200 bg-white"
      style={style}
      data-template-block="header"
    >
      <div
        className="flex items-center justify-between border-b border-slate-200 px-5 py-3"
        style={{ backgroundColor: `${theme.primaryColor}0f` }}
        data-part="header-ribbon"
      >
        <div>
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.26em] text-slate-500">
            {data.invoiceTitle || "Invoice"}
          </p>
          <h1 className="mt-1 text-[1.5em] font-semibold text-slate-950">
            {data.business.businessName}
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Invoice No.
          </p>
          <p className="mt-1 text-[1.05em] font-semibold text-slate-950">
            {data.invoiceNumber}
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[92px_minmax(0,1fr)_auto] sm:items-center">
        <div
          className="flex h-[74px] w-[74px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[0.78em] font-semibold text-slate-500"
          data-part="logo-lockup"
        >
          {data.business.showLogoOnInvoice && effectiveLogo ? (
            <img
              src={effectiveLogo}
              alt={`${data.business.businessName} logo`}
              className="h-12 w-12 object-contain"
            />
          ) : (
            "Logo"
          )}
        </div>

        <div className="min-w-0" data-part="business-overview">
          <p
            className="text-[0.9em] font-semibold"
            style={{ color: theme.primaryColor }}
          >
            {data.business.businessName}
          </p>
          <div className="mt-1 grid gap-0.5 text-[0.82em] text-slate-600">
            {businessAddressLines.length > 0 ? (
              businessAddressLines.map((line) => <p key={line}>{line}</p>)
            ) : (
              <p>Business address not added</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.78em] text-slate-500">
            {data.business.phone ? (
              <span>Phone: {data.business.phone}</span>
            ) : null}
            {data.business.email ? (
              <span>Email: {data.business.email}</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2 text-right" data-part="header-meta">
          <div
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            data-part="invoice-date-card"
          >
            <p className="text-[0.72em] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Invoice date
            </p>
            <p className="mt-1 text-[0.95em] font-semibold text-slate-950">
              {data.invoiceDate}
            </p>
          </div>
          {data.paymentSummary ? (
            <div
              className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[0.72em] font-semibold uppercase tracking-[0.18em] ${paymentToneClassName}`}
              data-part="status-pill"
            >
              {data.paymentSummary.statusLabel}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default Header;
