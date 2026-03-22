import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";

const ClientDetails = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("client_details");
  const client = data.client;

  return (
    <section
      className="rounded-[20px] border border-slate-200 bg-white"
      style={style}
    >
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Bill to
          </p>
          <div className="mt-3 grid gap-1 text-[0.9em] text-slate-700">
            <p className="font-semibold text-slate-950">{client.name}</p>
            {client.phone ? <p>{client.phone}</p> : null}
            {client.email ? <p>{client.email}</p> : null}
            {client.address ? <p>{client.address}</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
          <p className="text-[0.72em] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Invoice details
          </p>
          <div className="mt-3 grid gap-2 text-[0.9em] text-slate-700">
            <p>
              Invoice No.: <span className="font-semibold text-slate-950">{data.invoiceNumber}</span>
            </p>
            <p>Date: {data.invoiceDate}</p>
            <p>Due: {data.dueDate}</p>
            {data.paymentSummary ? (
              <p>
                Payment status:{" "}
                <span className="font-semibold" style={{ color: theme.primaryColor }}>
                  {data.paymentSummary.statusLabel}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientDetails;
