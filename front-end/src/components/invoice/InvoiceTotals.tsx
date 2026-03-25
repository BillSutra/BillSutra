"use client";

import type {
  DiscountType,
  InvoiceTotals as Totals,
  TaxMode,
} from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceTotalsProps = {
  totals: Totals;
  taxMode: TaxMode;
  discountValue?: string | number;
  discountType: DiscountType;
};

const InvoiceTotals = ({
  totals,
  taxMode,
  discountValue = 0,
  discountType,
}: InvoiceTotalsProps) => {
  const { formatCurrency, t } = useI18n();
  const normalizedDiscountValue = Math.max(0, Number(discountValue) || 0);
  const discountLabel =
    discountType === "PERCENTAGE"
      ? t("invoiceTotals.discountPercentage", {
          value: Math.min(100, normalizedDiscountValue).toFixed(2),
        })
      : t("invoiceTotals.discountFixed");

  return (
    <div className="no-print rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <h3 className="text-lg font-semibold">{t("invoiceTotals.title")}</h3>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">{t("invoiceTotals.subtotal")}</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        {taxMode === "CGST_SGST" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">{t("invoiceTotals.cgst")}</span>
              <span>{formatCurrency(totals.cgst)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">{t("invoiceTotals.sgst")}</span>
              <span>{formatCurrency(totals.sgst)}</span>
            </div>
          </>
        )}
        {taxMode === "IGST" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">{t("invoiceTotals.igst")}</span>
            <span>{formatCurrency(totals.igst)}</span>
          </div>
        )}
        {taxMode !== "NONE" && (
          <div className="flex items-center justify-between">
            <span className="text-[#8a6d56]">{t("invoiceTotals.totalGst")}</span>
            <span>{formatCurrency(totals.tax)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-[#8a6d56]">{discountLabel}</span>
          <span>{formatCurrency(totals.discount)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-base font-semibold">
          <span>{t("invoiceTotals.total")}</span>
          <span>{formatCurrency(totals.total)}</span>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTotals;
