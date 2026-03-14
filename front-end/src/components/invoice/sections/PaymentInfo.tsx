import type { InvoiceSectionProps } from "@/types/invoice-template";
import { useSectionStyles } from "@/components/invoice/DesignConfigContext";
import { calculateTotals, formatCurrency } from "./utils";

const PaymentInfo = ({ data, theme }: InvoiceSectionProps) => {
  const { style } = useSectionStyles("payment_info");
  const totals = calculateTotals(data.items);
  const receivedAmount = 0;
  const balanceAmount = totals.total - receivedAmount;

  return (
    <section className="border border-slate-400 bg-white" style={style}>
      <p
        className="border-b border-slate-300 px-2 py-1 text-[0.82em] font-semibold"
        style={{ backgroundColor: `${theme.primaryColor}22` }}
      >
        Amounts
      </p>
      <div className="text-[0.92em]">
        <div
          className="grid grid-cols-2 border-b border-slate-300 px-2 py-1 font-semibold"
          style={{ backgroundColor: `${theme.primaryColor}22` }}
        >
          <span>Total</span>
          <span className="text-right">
            {formatCurrency(totals.total, data.business.currency)}
          </span>
        </div>
        <div className="grid grid-cols-2 border-b border-slate-300 px-2 py-1">
          <span>Received</span>
          <span className="text-right">
            {formatCurrency(receivedAmount, data.business.currency)}
          </span>
        </div>
        <div className="grid grid-cols-2 border-b border-slate-300 px-2 py-1">
          <span>Balance</span>
          <span className="text-right">
            {formatCurrency(balanceAmount, data.business.currency)}
          </span>
        </div>
        <div className="px-2 py-2 text-[0.82em] opacity-80">
          {data.paymentInfo}
        </div>
      </div>
    </section>
  );
};

export default PaymentInfo;
