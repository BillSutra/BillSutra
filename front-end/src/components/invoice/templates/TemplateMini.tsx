"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import {
  buildBusinessAddressLines,
  parseBusinessAddressText,
} from "@/lib/indianAddress";
import type { InvoiceLineItem } from "@/types/invoice-template";
import { formatAmountInWords, formatCurrency } from "../sections/utils";

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
  const baseAmount = round2(quantity * unitPrice);
  const discountAmount = round2(
    item.discountAmount ??
      (item.discountPercent
        ? baseAmount * ((Number(item.discountPercent) || 0) / 100)
        : 0),
  );
  const taxableValue = round2(
    item.taxableValue ?? Math.max(baseAmount - discountAmount, 0),
  );
  const taxRate = Number(item.taxRate) || 0;
  const taxAmount = round2(taxableValue * (taxRate / 100));
  const amount = round2(
    item.amount ?? taxableValue + (taxRate > 0 ? taxAmount : 0),
  );
  return {
    ...item,
    quantity,
    unitPrice,
    baseAmount,
    discountAmount,
    taxableValue,
    taxRate,
    taxAmount,
    amount,
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

  return `https://quickchart.io/qr?size=100&text=${encodeURIComponent(upiLink.toString())}`;
};

const TemplateMini = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const { logo: storedLogo } = useBusinessLogo();
  const effectiveLogo = data.business.logoUrl || storedLogo;

  const items = data.items.map(normalizeItem);
  const subtotal = round2(
    data.totals?.subtotal ?? items.reduce((sum, item) => sum + item.baseAmount, 0),
  );
  const discount = round2(
    data.totals?.discount ??
      items.reduce((sum, item) => sum + item.discountAmount, 0),
  );
  const tax = round2(
    data.totals?.tax ?? items.reduce((sum, item) => sum + item.taxAmount, 0),
  );
  const computedTotal = round2(subtotal + tax - discount);
  const total = round2(
    typeof data.totals?.total === "number" ? data.totals.total : computedTotal,
  );

  const showItems =
    enabledSections.includes("items") ||
    enabledSections.includes("service_items");
  const showPayment = enabledSections.includes("payment_info");
  const showTax = enabledSections.includes("tax") && tax > 0;
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

  const amountInWords =
    data.amountInWords || formatAmountInWords(total, data.business.currency);

  const divider = "─".repeat(32);

  return (
    <div
      className="invoice-content-root bg-white"
      style={
        {
          fontFamily: theme.fontFamily,
          color: "#111111",
        } as CSSProperties
      }
    >
      <section
        className="flex min-h-[320px] w-full flex-col bg-white px-4 py-4 text-[10px] leading-[1.4] print:min-h-0"
        style={{ maxHeight: 380 }}
      >
        {showHeader ? (
          <header className="text-center">
            {data.business.showLogoOnInvoice && effectiveLogo ? (
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white p-1">
                <img
                  src={effectiveLogo}
                  alt={`${data.business.businessName} logo`}
                  className="max-h-full max-w-full object-contain grayscale"
                />
              </div>
            ) : null}
            <h1 className="text-[16px] font-bold uppercase tracking-[0.05em] text-neutral-950">
              {data.business.businessName}
            </h1>
            {businessLines.length ? (
              <p className="mt-1 text-[9px] text-neutral-700">
                {businessLines.join(", ")}
              </p>
            ) : null}
            {data.business.phone ? (
              <p className="mt-0.5 text-[9px] text-neutral-700">
                Ph: {data.business.phone}
              </p>
            ) : null}
            {data.business.taxId ? (
              <p className="mt-0.5 text-[9px] font-semibold text-neutral-950">
                GSTIN: {data.business.taxId}
              </p>
            ) : null}
          </header>
        ) : null}

        <div className="mt-2 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-950">
            {data.invoiceTitle?.trim().toUpperCase() || "INVOICE"}
          </p>
          <p className="mt-1 text-[9px] text-neutral-700">
            {data.invoiceNumber} | {data.invoiceDate}
            {data.dueDate ? ` | Due: ${data.dueDate}` : ""}
          </p>
        </div>

        <div className="mt-2 border-dashed border-t border-neutral-300 pt-2">
          <p className="text-[9px] text-neutral-600">
            Bill To: {data.client.name || "Customer"}
            {data.client.phone ? ` | ${data.client.phone}` : ""}
            {data.client.gstin ? ` | GSTIN: ${data.client.gstin}` : ""}
          </p>
        </div>

        {showItems ? (
          <section className="mt-2">
            <div className="border-dashed border-t border-b border-neutral-300 py-1.5">
              <div className="grid grid-cols-[1fr_60px_80px] gap-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
                <span>Item</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Amount</span>
              </div>
            </div>

            <div className="divide-dashed divide-y divide-neutral-200">
              {items.length ? (
                items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="grid grid-cols-[1fr_60px_80px] gap-1 py-1.5 text-[10px]"
                  >
                    <span className="font-semibold text-neutral-950 leading-4">
                      {item.name}
                    </span>
                    <span className="text-right text-neutral-700">
                      {item.quantity}{item.unitLabel ? ` ${item.unitLabel}` : ""}
                    </span>
                    <span className="text-right font-semibold text-neutral-950">
                      {formatCurrency(item.amount, data.business.currency)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-3 text-center text-[9px] text-neutral-500">
                  No items
                </p>
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-auto space-y-1 border-t border-neutral-300 pt-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-neutral-600">Subtotal</span>
            <span className="font-semibold text-neutral-950">
              {formatCurrency(subtotal, data.business.currency)}
            </span>
          </div>
          {discount > 0 ? (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-neutral-600">
                {data.discount?.label ?? "Discount"}
              </span>
              <span className="font-semibold text-neutral-950">
                -{formatCurrency(discount, data.business.currency)}
              </span>
            </div>
          ) : null}
          {showTax ? (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-neutral-600">Tax</span>
              <span className="font-semibold text-neutral-950">
                {formatCurrency(tax, data.business.currency)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-neutral-400 pt-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-950">
              Total
            </span>
            <span className="text-[16px] font-bold text-neutral-950">
              {formatCurrency(total, data.business.currency)}
            </span>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-[9px] italic text-neutral-700">{amountInWords}</p>
        </div>

        {showPayment ? (
          <div className="mt-2 flex items-center justify-between border-t border-dashed border-neutral-300 pt-2 text-[9px]">
            <span className="text-neutral-600">
              {paymentMode ? `Payment: ${paymentMode}` : ""}
              {upiId ? ` | UPI: ${upiId}` : ""}
            </span>
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt="UPI QR"
                className="h-12 w-12 object-contain grayscale"
              />
            ) : null}
          </div>
        ) : null}

        {showFooter ? (
          <footer className="mt-2 border-t border-dashed border-neutral-300 pt-2 text-center">
            <p className="text-[9px] text-neutral-600">
              {data.closingNote || "Thank you for your business!"}
            </p>
            {data.signatureLabel ? (
              <p className="mt-1 text-[9px] font-semibold text-neutral-700">
                {data.signatureLabel}
              </p>
            ) : null}
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateMini;
