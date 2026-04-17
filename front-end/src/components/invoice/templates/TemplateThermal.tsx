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

const pad = (str: string, width: number): string => {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s.padEnd(width);
};

const rpad = (str: string, width: number): string => {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s.padStart(width);
};

const wrapText = (text: string, maxWidth: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
};

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

/**
 * Thermal Receipt template — designed for 58mm / 80mm POS thermal printers.
 * Center-aligned, monospace layout, dashed dividers, no heavy borders.
 * Width is constrained to simulate narrow thermal paper.
 *
 * Uses a 38-character line width (suitable for 58mm paper at 12pt monospace).
 * Configurable to 48 chars for 80mm paper via the `lineWidth` prop.
 */
const TemplateThermal = ({
  data,
  enabledSections,
  theme,
  lineWidth = 38,
}: InvoiceSectionRendererProps & { lineWidth?: number }) => {
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
  const roundOff = round2(data.totals?.roundOff ?? total - computedTotal);
  const igst = round2(data.totals?.igst ?? 0);
  const cgst = round2(data.totals?.cgst ?? 0);
  const sgst = round2(data.totals?.sgst ?? 0);

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

  const divider = "─".repeat(lineWidth);
  const halfDivider = "─".repeat(Math.floor(lineWidth / 2));

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

  const center = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.length >= lineWidth) return trimmed.slice(0, lineWidth);
    const padEach = Math.floor((lineWidth - trimmed.length) / 2);
    return " ".repeat(padEach) + trimmed;
  };

  const formatLine = (
    label: string,
    value: string,
  ): { label: string; value: string } => {
    const labelLen = label.length;
    const valueLen = value.length;
    const valueStart = lineWidth - valueLen;
    return {
      label: pad(label, valueStart - 1),
      value: rpad(value, lineWidth - valueStart),
    };
  };

  const fmt = (amount: number) =>
    formatCurrency(amount, data.business.currency);

  return (
    <div
      className="invoice-content-root bg-white"
      style={
        {
          fontFamily: "var(--font-geist-mono)",
          color: "#111111",
        } as CSSProperties
      }
    >
      <section
        className="flex w-full flex-col bg-white px-3 py-4 text-[10px] leading-[1.5] print:min-h-0"
        style={{ maxWidth: lineWidth + 16 }}
      >
        {showHeader ? (
          <header className="text-center">
            {data.business.showLogoOnInvoice && effectiveLogo ? (
              <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center border border-neutral-300 bg-white p-1">
                <img
                  src={effectiveLogo}
                  alt={`${data.business.businessName} logo`}
                  className="max-h-full max-w-full object-contain grayscale"
                />
              </div>
            ) : null}
            <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-neutral-950">
              {data.business.businessName}
            </p>
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

        <div className="mt-1.5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-950">
            {data.invoiceTitle?.trim().toUpperCase() || "RECEIPT"}
          </p>
          <p className="mt-1 text-[9px] text-neutral-700">
            {center(
              `${data.invoiceNumber} | ${data.invoiceDate}${
                data.dueDate ? ` | Due: ${data.dueDate}` : ""
              }`,
            )}
          </p>
          {data.placeOfSupply ? (
            <p className="mt-0.5 text-[9px] text-neutral-700">
              {center(`Supply: ${data.placeOfSupply}`)}
            </p>
          ) : null}
        </div>

        <div className="mt-1.5 text-center">
          <p className="text-[9px] text-neutral-700">
            {center(
              `Customer: ${data.client.name || "Customer"}${
                data.client.phone ? ` | ${data.client.phone}` : ""
              }`,
            )}
          </p>
          {data.client.gstin ? (
            <p className="text-[9px] text-neutral-700">
              {center(`GSTIN: ${data.client.gstin}`)}
            </p>
          ) : null}
        </div>

        <div className="mt-1.5 text-center text-[9px] text-neutral-500">
          <p>{center(divider)}</p>
        </div>

        {showItems ? (
          <section className="mt-1">
            <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-600">
              <div className="flex justify-between">
                <span>Item</span>
                <span>Amount</span>
              </div>
            </div>
            <div className="text-[10px]">
              <p className="text-center text-[9px] text-neutral-500">
                {center(halfDivider + " " + halfDivider)}
              </p>
              {items.length ? (
                items.map((item, index) => {
                  const nameLines = wrapText(item.name, lineWidth - 14);
                  return (
                    <div
                      key={`${item.name}-${index}`}
                      className="flex justify-between gap-1 py-0.5"
                    >
                      <span className="flex-1 font-semibold text-neutral-950 leading-5">
                        {nameLines[0]}
                      </span>
                      <span className="shrink-0 font-semibold text-neutral-950 leading-5">
                        {fmt(item.amount)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="py-2 text-center text-[9px] text-neutral-500">
                  No items
                </p>
              )}
            </div>
          </section>
        ) : null}

        <div className="mt-1 text-[10px]">
          <p className="text-center text-[9px] text-neutral-500">
            {center(divider)}
          </p>
          <div className="mt-1 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-neutral-700">Subtotal</span>
              <span className="font-semibold text-neutral-950">{fmt(subtotal)}</span>
            </div>
            {discount > 0 ? (
              <div className="flex justify-between">
                <span className="text-neutral-700">Discount</span>
                <span className="font-semibold text-neutral-950">
                  -{fmt(discount)}
                </span>
              </div>
            ) : null}
            {showTax ? (
              <>
                {igst > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-neutral-700">IGST</span>
                    <span className="font-semibold text-neutral-950">
                      {fmt(igst)}
                    </span>
                  </div>
                ) : (
                  <>
                    {cgst > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-neutral-700">CGST</span>
                        <span className="font-semibold text-neutral-950">
                          {fmt(cgst)}
                        </span>
                      </div>
                    ) : null}
                    {sgst > 0 ? (
                      <div className="flex justify-between">
                        <span className="text-neutral-700">SGST</span>
                        <span className="font-semibold text-neutral-950">
                          {fmt(sgst)}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-700">Total Tax</span>
                  <span className="font-semibold text-neutral-950">{fmt(tax)}</span>
                </div>
              </>
            ) : null}
            {roundOff !== 0 ? (
              <div className="flex justify-between">
                <span className="text-neutral-700">Round Off</span>
                <span className="font-semibold text-neutral-950">
                  {roundOff > 0 ? "+" : ""}
                  {fmt(roundOff)}
                </span>
              </div>
            ) : null}
          </div>
          <div className="mt-1 border-t border-neutral-400 pt-1">
            <div className="flex justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-950">
                TOTAL
              </span>
              <span className="text-[14px] font-bold text-neutral-950">
                {fmt(total)}
              </span>
            </div>
          </div>
          <p className="mt-1 text-center text-[9px] italic text-neutral-700">
            {center(
              data.amountInWords ||
                formatAmountInWords(total, data.business.currency),
            )}
          </p>
        </div>

        {showPayment ? (
          <div className="mt-1 text-center">
            <p className="text-center text-[9px] text-neutral-500">
              {center(divider)}
            </p>
            {paymentMode ? (
              <p className="mt-1 text-[10px] font-semibold text-neutral-950">
                Payment: {paymentMode}
              </p>
            ) : null}
            {upiId ? (
              <p className="mt-0.5 text-[9px] text-neutral-700">UPI: {upiId}</p>
            ) : null}
            {qrCodeUrl ? (
              <div className="mt-1 flex justify-center">
                <img
                  src={qrCodeUrl}
                  alt="UPI QR"
                  className="h-20 w-20 object-contain grayscale"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {showFooter ? (
          <footer className="mt-1 text-center">
            <p className="text-center text-[9px] text-neutral-500">
              {center(divider)}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-neutral-950">
              Thank You!
            </p>
            <p className="mt-0.5 text-[9px] text-neutral-700">Visit Again</p>
            {data.closingNote ? (
              <p className="mt-1 text-[9px] text-neutral-600">
                {data.closingNote}
              </p>
            ) : null}
            <p className="mt-1 text-[9px] text-neutral-500">
              Computer Generated Invoice
            </p>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateThermal;