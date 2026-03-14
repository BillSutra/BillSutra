import type { InvoiceTotals as Totals, TaxMode } from "@/types/invoice";

type InvoiceTotalsProps = {
  totals: Totals;
  taxMode: TaxMode;
  discountPercent?: string | number;
};

const formatCurrency = (value: number) => `Rs ${value.toFixed(2)}`;

const InvoiceTotals = ({
  totals,
  taxMode,
  discountPercent = 0,
}: InvoiceTotalsProps) => {
  const normalizedDiscountPercent = Math.min(
    100,
    Math.max(0, Number(discountPercent) || 0),
  );

  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <h3 className="text-lg font-semibold">Totals</h3>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        {taxMode === "CGST_SGST" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">CGST</span>
              <span>{formatCurrency(totals.cgst)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">SGST</span>
              <span>{formatCurrency(totals.sgst)}</span>
            </div>
          </>
        )}
        {taxMode === "IGST" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">IGST</span>
            <span>{formatCurrency(totals.igst)}</span>
          </div>
        )}
        {taxMode !== "NONE" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">Total GST</span>
            <span>{formatCurrency(totals.tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">
            Discount ({normalizedDiscountPercent.toFixed(2)}%)
          </span>
          <span>{formatCurrency(totals.discount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTotals;
