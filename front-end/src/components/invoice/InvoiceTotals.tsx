import type { InvoiceTotals as Totals, TaxMode } from "@/types/invoice";

type InvoiceTotalsProps = {
  totals: Totals;
  taxMode: TaxMode;
};

const InvoiceTotals = ({ totals, taxMode }: InvoiceTotalsProps) => {
  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <h3 className="text-lg font-semibold">Totals</h3>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">Subtotal</span>
          <span>₹{totals.subtotal.toFixed(2)}</span>
        </div>
        {taxMode === "CGST_SGST" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">CGST</span>
              <span>₹{totals.cgst.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">SGST</span>
              <span>₹{totals.sgst.toFixed(2)}</span>
            </div>
          </>
        )}
        {taxMode === "IGST" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">IGST</span>
            <span>₹{totals.igst.toFixed(2)}</span>
          </div>
        )}
        {taxMode !== "NONE" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">Total GST</span>
            <span>₹{totals.tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">Discount</span>
          <span>₹{totals.discount.toFixed(2)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>₹{totals.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTotals;
