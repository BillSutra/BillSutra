import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";

const ClientDetails = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("client_details");
  const client = data.client;

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <div className="grid gap-0 sm:grid-cols-2">
        <div
          className="border-b border-slate-300 px-2 py-1 text-[0.8em] font-semibold sm:border-r"
          style={{ backgroundColor: `${theme.primaryColor}22` }}
        >
          Bill To
        </div>
        <div
          className="border-b border-slate-300 px-2 py-1 text-[0.8em] font-semibold text-left sm:text-right"
          style={{ backgroundColor: `${theme.primaryColor}22` }}
        >
          Invoice Details
        </div>
        <div className="min-h-14 border-b border-slate-300 px-2 py-2 text-[0.92em] sm:border-r">
          <p className="font-semibold">{client.name}</p>
          {client.address ? <p>{client.address}</p> : null}
          {client.phone ? <p>{client.phone}</p> : null}
          {client.email ? <p>{client.email}</p> : null}
        </div>
        <div className="min-h-14 border-b border-slate-300 px-2 py-2 text-[0.92em] text-left sm:text-right">
          <p>
            Invoice No. :{" "}
            <span className="font-semibold">{data.invoiceNumber}</span>
          </p>
          <p>Date : {data.invoiceDate}</p>
          <p>Due : {data.dueDate}</p>
        </div>
      </div>
    </section>
  );
};

export default ClientDetails;
