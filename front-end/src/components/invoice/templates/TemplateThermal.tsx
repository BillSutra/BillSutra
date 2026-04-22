"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { buildBusinessAddressLines } from "@/lib/indianAddress";
import type { InvoiceLineItem } from "@/types/invoice-template";
import { formatCurrency } from "../sections/utils";

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const splitTextLines = (value?: string | null) =>
  String(value ?? "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeItem = (item: InvoiceLineItem) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const lineSubtotal = round2(quantity * unitPrice);
  const lineDiscount = round2(
    item.discountAmount ??
      (item.discountPercent
        ? lineSubtotal * ((Number(item.discountPercent) || 0) / 100)
        : 0),
  );
  const taxableValue = round2(
    item.taxableValue ?? Math.max(lineSubtotal - lineDiscount, 0),
  );
  const taxRate = Number(item.taxRate) || 0;
  const taxAmount = round2(taxableValue * (taxRate / 100));

  return {
    ...item,
    quantity,
    unitPrice,
    lineSubtotal,
    lineDiscount,
    taxableValue,
    taxRate,
    taxAmount,
  };
};

const buildQuickChartQrUrl = (
  upiId: string,
  amount: number,
  payeeName: string,
) => {
  const trimmedUpiId = upiId.trim();
  if (!trimmedUpiId) return "";

  const upiLink = new URL("upi://pay");
  upiLink.searchParams.set("pa", trimmedUpiId);
  upiLink.searchParams.set("pn", payeeName.trim() || "BillSutra");
  if (amount > 0) {
    upiLink.searchParams.set("am", amount.toFixed(2));
  }
  upiLink.searchParams.set("cu", "INR");

  return `https://quickchart.io/qr?size=120&text=${encodeURIComponent(upiLink.toString())}`;
};

const getDiscountLabel = (
  data: InvoiceSectionRendererProps["data"],
  discountAmount: number,
) => {
  if (discountAmount <= 0) return "Discount";
  if (data.discount?.type === "PERCENTAGE") {
    return `Discount (${round2(data.discount.value)}%)`;
  }
  if (data.discount?.type === "FIXED") {
    return "Discount (Flat)";
  }
  return data.discount?.label ?? "Discount";
};

const getGstLabel = (items: ReturnType<typeof normalizeItem>[], tax: number) => {
  if (tax <= 0) return "GST";

  const rates = Array.from(
    new Set(
      items
        .map((item) => round2(item.taxRate))
        .filter((rate) => rate > 0),
    ),
  ).sort((left, right) => left - right);

  if (!rates.length) return "GST";
  if (rates.length === 1) return `GST (${rates[0]}%)`;
  return `GST (${rates.map((rate) => `${rate}%`).join(", ")})`;
};

const TemplateThermal = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const { logo: storedLogo } = useBusinessLogo();
  const effectiveLogo = data.business.logoUrl || storedLogo;

  const items = data.items.map(normalizeItem);
  const subtotal = round2(
    data.totals?.subtotal ??
      items.reduce((sum, item) => sum + item.lineSubtotal, 0),
  );
  const discount = round2(
    data.totals?.discount ??
      data.discount?.calculatedAmount ??
      items.reduce((sum, item) => sum + item.lineDiscount, 0),
  );
  const discountedSubtotal = round2(
    items.reduce((sum, item) => sum + item.taxableValue, 0) ||
      Math.max(subtotal - discount, 0),
  );
  const tax = round2(
    data.totals?.tax ?? items.reduce((sum, item) => sum + item.taxAmount, 0),
  );
  const computedTotal = round2(discountedSubtotal + tax);
  const total = round2(
    typeof data.totals?.total === "number" ? data.totals.total : computedTotal,
  );

  const showItems =
    enabledSections.includes("items") ||
    enabledSections.includes("service_items");
  const showPayment = enabledSections.includes("payment_info");
  const showFooter = enabledSections.includes("footer");
  const showHeader =
    enabledSections.includes("header") ||
    enabledSections.includes("company_details");

  const businessLines = [
    ...buildBusinessAddressLines(
      data.business.businessAddress,
      data.business.address,
    ),
  ].filter(Boolean);

  const paymentMode =
    data.payment?.mode ||
    data.payment?.label ||
    data.paymentSummary?.history?.[0]?.method ||
    "";
  const upiId = data.payment?.upiId || "";
  const qrCodeUrl =
    data.payment?.qrCodeUrl ||
    (data.business.showPaymentQr && upiId
      ? buildQuickChartQrUrl(upiId, total, data.business.businessName)
      : "");

  const footerLines = [
    data.closingNote || "Thank you for your business!",
    ...splitTextLines(data.notes).slice(0, 1),
  ].filter(Boolean);

  const receiptStyle = {
    fontFamily: theme.fontFamily || "ui-monospace, SFMono-Regular, monospace",
    color: "#111111",
    width: "100%",
    maxWidth: "360px",
    margin: "0 auto",
  } as CSSProperties;

  return (
    <div className="invoice-content-root bg-white" style={receiptStyle}>
      <section className="thermal-receipt mx-auto w-full bg-white px-3 py-3 text-[10px] leading-[1.35] print:px-2 print:py-2">
        <style>{`
          .thermal-receipt {
            width: min(100%, 360px);
          }

          @media print {
            .thermal-receipt {
              width: 76mm;
              max-width: 76mm;
            }
          }
        `}</style>

        {showHeader ? (
          <header className="text-center">
            {data.business.showLogoOnInvoice && effectiveLogo ? (
              <div className="mx-auto mb-1 flex h-10 w-10 items-center justify-center overflow-hidden border border-neutral-300 bg-white p-1">
                <img
                  src={effectiveLogo}
                  alt={`${data.business.businessName} logo`}
                  className="max-h-full max-w-full object-contain grayscale"
                />
              </div>
            ) : null}
            <h1 className="text-[15px] font-bold uppercase tracking-[0.06em] text-neutral-950">
              {data.business.businessName}
            </h1>
            {businessLines.length ? (
              <p className="mt-1 text-[9px] text-neutral-700">
                {businessLines.join(", ")}
              </p>
            ) : null}
            {data.business.phone || data.business.email ? (
              <p className="mt-0.5 text-[9px] text-neutral-700">
                {[data.business.phone, data.business.email].filter(Boolean).join(" | ")}
              </p>
            ) : null}
            {data.business.taxId ? (
              <p className="mt-0.5 text-[9px] font-semibold text-neutral-950">
                GST No: {data.business.taxId}
              </p>
            ) : null}
          </header>
        ) : null}

        <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
          --------------------------------
        </div>

        <section className="space-y-0.5 text-[9px]">
          <div className="flex items-start justify-between gap-3">
            <span className="text-neutral-600">Invoice #</span>
            <span className="text-right font-semibold text-neutral-950">
              {data.invoiceNumber || "-"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-neutral-600">Date &amp; Time</span>
            <span className="text-right font-semibold text-neutral-950">
              {data.invoiceDate || "-"}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="text-neutral-600">Payment</span>
            <span className="text-right font-semibold text-neutral-950">
              {paymentMode || "Cash"}
            </span>
          </div>
        </section>

        <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
          --------------------------------
        </div>

        <section className="space-y-0.5 text-[9px]">
          <div className="flex items-start justify-between gap-3">
            <span className="text-neutral-600">Customer</span>
            <span className="text-right font-semibold text-neutral-950">
              {data.client.name || "Walk-in Customer"}
            </span>
          </div>
          {data.client.phone ? (
            <div className="flex items-start justify-between gap-3">
              <span className="text-neutral-600">Phone</span>
              <span className="text-right text-neutral-950">{data.client.phone}</span>
            </div>
          ) : null}
        </section>

        {showItems ? (
          <>
            <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
              --------------------------------
            </div>
            <section>
              <div className="grid grid-cols-[minmax(0,1fr)_32px_58px_70px] gap-1 text-[8px] font-bold uppercase tracking-[0.08em] text-neutral-600">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>
              <div className="mt-1 space-y-1">
                {items.length ? (
                  items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="border-b border-dashed border-neutral-200 pb-1">
                      <div className="grid grid-cols-[minmax(0,1fr)_32px_58px_70px] gap-1 text-[9px]">
                        <span className="min-w-0 break-words font-semibold text-neutral-950">
                          {item.name}
                        </span>
                        <span className="text-right text-neutral-900">
                          {item.quantity}
                        </span>
                        <span className="text-right text-neutral-900">
                          {formatCurrency(item.unitPrice, data.business.currency)}
                        </span>
                        <span className="text-right font-semibold text-neutral-950">
                          {formatCurrency(item.lineSubtotal, data.business.currency)}
                        </span>
                      </div>
                      {item.description ? (
                        <p className="mt-0.5 pr-1 text-[8px] leading-4 text-neutral-500">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-center text-[9px] text-neutral-500">
                    No items
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}

        <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
          --------------------------------
        </div>

        <section className="space-y-1 text-[9px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-600">Subtotal</span>
            <span className="text-right font-semibold text-neutral-950">
              {formatCurrency(subtotal, data.business.currency)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">
                {getDiscountLabel(data, discount)}
              </span>
              <span className="text-right font-semibold text-neutral-950">
                -{formatCurrency(discount, data.business.currency)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-neutral-600">Taxable Amount</span>
            <span className="text-right font-semibold text-neutral-950">
              {formatCurrency(discountedSubtotal, data.business.currency)}
            </span>
          </div>
          {tax > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">{getGstLabel(items, tax)}</span>
              <span className="text-right font-semibold text-neutral-950">
                {formatCurrency(tax, data.business.currency)}
              </span>
            </div>
          ) : null}
          <div className="rounded-sm border border-neutral-900 px-2 py-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-950">
                Grand Total
              </span>
              <span className="text-[13px] font-bold text-neutral-950">
                {formatCurrency(total, data.business.currency)}
              </span>
            </div>
          </div>
        </section>

        {(showPayment && (upiId || qrCodeUrl)) ? (
          <>
            <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
              --------------------------------
            </div>
            <section className="text-center">
              {upiId ? (
                <p className="text-[9px] text-neutral-700">UPI: {upiId}</p>
              ) : null}
              {qrCodeUrl ? (
                <div className="mt-1 flex justify-center">
                  <img
                    src={qrCodeUrl}
                    alt="Payment QR"
                    className="h-20 w-20 object-contain grayscale"
                  />
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {showFooter ? (
          <>
            <div className="my-2 text-center text-[9px] tracking-[0.08em] text-neutral-500">
              --------------------------------
            </div>
            <footer className="space-y-0.5 text-center text-[9px] text-neutral-700">
              <p className="font-semibold text-neutral-950">
                {footerLines[0] || "Thank you!"}
              </p>
              {footerLines[1] ? <p>{footerLines[1]}</p> : null}
              <p>Returns accepted within 3 days with bill.</p>
              <p className="text-[8px] uppercase tracking-[0.08em] text-neutral-500">
                Powered by BillSutra
              </p>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateThermal;
