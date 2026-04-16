"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { getStateFromGstin } from "@/lib/gstin";
import {
  buildBusinessAddressLines,
  normalizeIndianState,
  parseBusinessAddressText,
} from "@/lib/indianAddress";
import type {
  InvoiceLineItem,
  InvoiceTaxMode,
} from "@/types/invoice-template";
import { formatAmountInWords, formatCurrency } from "../sections/utils";

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const splitTextLines = (value?: string | null) =>
  String(value ?? "")
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean);

const buildCustomerAddressLines = (value?: string | null) => {
  const directLines = String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (directLines.length) return directLines;

  return buildBusinessAddressLines(parseBusinessAddressText(value));
};

const extractUpiId = (value?: string | null) => {
  const match = String(value ?? "").match(/\b[\w.-]{2,}@[a-zA-Z0-9]{2,}\b/);
  return match?.[0] ?? "";
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

const getBusinessState = (data: InvoiceSectionRendererProps["data"]) => {
  const gstState = getStateFromGstin(data.business.taxId);
  if (gstState) return gstState;
  return (
    normalizeIndianState(data.business.businessAddress?.state) ||
    parseBusinessAddressText(data.business.address).state ||
    ""
  );
};

const getCustomerState = (data: InvoiceSectionRendererProps["data"]) => {
  const gstState = getStateFromGstin(data.client.gstin);
  if (gstState) return gstState;
  return parseBusinessAddressText(data.client.address).state || "";
};

const resolvePlaceOfSupply = (
  data: InvoiceSectionRendererProps["data"],
  customerState: string,
  businessState: string,
) => {
  const explicitState =
    normalizeIndianState(data.placeOfSupply) ||
    parseBusinessAddressText(data.placeOfSupply).state;
  const label =
    explicitState ||
    data.placeOfSupply?.trim() ||
    customerState ||
    businessState ||
    "-";
  return {
    label,
    state: explicitState || customerState || businessState || "",
  };
};

const resolveTaxMode = (
  data: InvoiceSectionRendererProps["data"],
  businessState: string,
  placeOfSupplyState: string,
) => {
  const totalTax = Number(data.totals?.tax ?? 0);
  if (data.taxMode === "NONE" || totalTax <= 0) return "NONE" as InvoiceTaxMode;
  if (businessState && placeOfSupplyState) {
    return businessState === placeOfSupplyState ? "CGST_SGST" : "IGST";
  }
  if (data.taxMode) return data.taxMode;
  if ((data.totals?.igst ?? 0) > 0) return "IGST";
  if ((data.totals?.cgst ?? 0) > 0 || (data.totals?.sgst ?? 0) > 0) {
    return "CGST_SGST";
  }
  return "CGST_SGST";
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

const resolveTotals = (
  data: InvoiceSectionRendererProps["data"],
  businessState: string,
  placeOfSupplyState: string,
) => {
  const items = data.items.map(normalizeItem);
  const taxMode = resolveTaxMode(data, businessState, placeOfSupplyState);
  const subtotal = round2(
    data.totals?.subtotal ?? items.reduce((sum, item) => sum + item.baseAmount, 0),
  );
  const discount = round2(
    data.totals?.discount ??
      items.reduce((sum, item) => sum + item.discountAmount, 0),
  );
  const taxableSubtotal = round2(
    items.reduce((sum, item) => sum + item.taxableValue, 0),
  );
  const tax = round2(
    data.totals?.tax ?? items.reduce((sum, item) => sum + item.taxAmount, 0),
  );
  const computedBeforeRound = round2(taxableSubtotal + tax);
  const total = round2(
    typeof data.totals?.total === "number" ? data.totals.total : computedBeforeRound,
  );
  const roundOff = round2(data.totals?.roundOff ?? total - computedBeforeRound);
  const cgst = round2(data.totals?.cgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0));
  const sgst = round2(data.totals?.sgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0));
  const igst = round2(data.totals?.igst ?? (taxMode === "IGST" ? tax : 0));
  return {
    items,
    subtotal,
    discount,
    taxableSubtotal,
    tax,
    total,
    roundOff,
    cgst,
    sgst,
    igst,
    taxMode,
  };
};

const MetaRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
      {label}
    </span>
    <span className="text-right font-semibold text-neutral-950">
      {value?.trim() || "-"}
    </span>
  </div>
);

const TemplateHalfPage = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const { logo: storedLogo } = useBusinessLogo();
  const businessState = getBusinessState(data);
  const customerState = getCustomerState(data);
  const placeOfSupply = resolvePlaceOfSupply(data, customerState, businessState);
  const totals = resolveTotals(data, businessState, placeOfSupply.state);
  const effectiveLogo = data.business.logoUrl || storedLogo;
  const showHeader =
    enabledSections.includes("header") ||
    enabledSections.includes("company_details");
  const showCustomer = enabledSections.includes("client_details");
  const showItems =
    enabledSections.includes("items") ||
    enabledSections.includes("service_items");
  const showTax =
    enabledSections.includes("tax") &&
    totals.taxMode !== "NONE" &&
    totals.tax > 0;
  const showPayment = enabledSections.includes("payment_info");
  const showFooter = enabledSections.includes("footer");
  const showHsnColumn = totals.items.some((item) => Boolean(item.hsnSac?.trim()));

  const businessLines = [
    ...buildBusinessAddressLines(
      data.business.businessAddress,
      data.business.address,
    ),
    data.business.phone ? `Ph: ${data.business.phone}` : "",
  ].filter(Boolean);

  const customerLines = [
    ...buildCustomerAddressLines(data.client.address),
    data.client.phone ? `Ph: ${data.client.phone}` : "",
  ].filter(Boolean);

  const invoiceTitle =
    totals.taxMode === "NONE"
      ? data.invoiceTitle?.trim().toUpperCase() || "INVOICE"
      : "TAX INVOICE";

  const paymentDetails = (() => {
    const mode =
      data.payment?.mode ||
      data.payment?.label ||
      data.paymentSummary?.history?.[0]?.method ||
      "";
    const upiId = data.payment?.upiId || extractUpiId(data.paymentInfo);
    const qrCodeUrl =
      data.payment?.qrCodeUrl ||
      (data.business.showPaymentQr && upiId
        ? buildQuickChartQrUrl(upiId, totals.total, data.business.businessName)
        : "");
    return { mode, upiId, qrCodeUrl };
  })();

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
        className="flex min-h-[530px] w-full flex-col bg-white px-6 py-5 text-[10px] leading-[1.4] print:min-h-0"
        style={{ maxHeight: 530 }}
      >
        {showHeader ? (
          <header className="border-b border-neutral-400 pb-3">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)]">
              <div className="flex items-start gap-3">
                {data.business.showLogoOnInvoice && effectiveLogo ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-neutral-300 bg-white p-1">
                    <img
                      src={effectiveLogo}
                      alt={`${data.business.businessName} logo`}
                      className="max-h-full max-w-full object-contain grayscale"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-[20px] font-bold uppercase tracking-[0.01em] text-neutral-950">
                    {data.business.businessName}
                  </h1>
                  <div className="mt-1.5 grid gap-0.5 text-[9px] text-neutral-700">
                    {businessLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {data.business.taxId ? (
                    <div className="mt-2 inline-flex items-center gap-1.5 border border-neutral-900 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-950">
                      <span>GSTIN</span>
                      <span>{data.business.taxId}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="md:justify-self-end md:w-full md:max-w-[220px]">
                <p className="text-right text-[18px] font-bold tracking-[0.06em] text-neutral-950">
                  {invoiceTitle}
                </p>
                <div className="mt-2 space-y-1 border-t border-b border-neutral-300 py-2">
                  <MetaRow label="Invoice No" value={data.invoiceNumber} />
                  <MetaRow label="Date" value={data.invoiceDate} />
                  <MetaRow label="Due Date" value={data.dueDate} />
                  <MetaRow label="Place of Supply" value={placeOfSupply.label} />
                </div>
              </div>
            </div>
          </header>
        ) : null}

        {showCustomer ? (
          <section className="border-b border-neutral-300 py-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  Bill To
                </p>
                <p className="mt-1 text-[14px] font-bold text-neutral-950">
                  {data.client.name || "Customer"}
                </p>
                {data.client.gstin ? (
                  <p className="mt-1 font-semibold text-neutral-950 text-[9px]">
                    GSTIN: {data.client.gstin}
                  </p>
                ) : null}
                <div className="mt-1 grid gap-0.5 text-[9px] text-neutral-700">
                  {customerLines.length ? (
                    customerLines.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>Customer details not provided.</p>
                  )}
                </div>
              </div>

              <div className="border-l border-neutral-300 pl-3 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  Supply Type
                </p>
                <p className="mt-1 text-[11px] font-semibold text-neutral-950">
                  {totals.taxMode === "IGST"
                    ? "Inter-state"
                    : totals.taxMode === "CGST_SGST"
                      ? "Intra-state"
                      : "No GST"}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {showItems ? (
          <section className="py-3">
            <table className="min-w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-t border-b border-neutral-400 text-neutral-700">
                  <th className="w-8 py-1.5 text-left font-semibold">#</th>
                  <th className="py-1.5 text-left font-semibold">Item</th>
                  {showHsnColumn ? (
                    <th className="w-20 py-1.5 text-left font-semibold">HSN</th>
                  ) : null}
                  <th className="w-16 py-1.5 text-right font-semibold">Qty</th>
                  <th className="w-24 py-1.5 text-right font-semibold">Taxable (₹)</th>
                  <th className="w-20 py-1.5 text-right font-semibold">Tax %</th>
                  <th className="w-28 py-1.5 text-right font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {totals.items.length ? (
                  totals.items.map((item, index) => (
                    <tr
                      key={`${item.name}-${index}`}
                      className="border-b border-neutral-200 align-top"
                    >
                      <td className="py-2 pr-2 text-neutral-600">{index + 1}</td>
                      <td className="py-2 pr-3">
                        <p className="font-semibold text-neutral-950">{item.name}</p>
                      </td>
                      {showHsnColumn ? (
                        <td className="py-2 pr-2 text-neutral-700">
                          {item.hsnSac?.trim() || "-"}
                        </td>
                      ) : null}
                      <td className="py-2 pr-2 text-right text-neutral-700">
                        {item.quantity}{item.unitLabel ? ` ${item.unitLabel}` : ""}
                      </td>
                      <td className="py-2 pr-2 text-right text-neutral-700">
                        {formatCurrency(item.taxableValue, data.business.currency)}
                      </td>
                      <td className="py-2 pr-2 text-right text-neutral-700">
                        {item.taxRate > 0 ? `${item.taxRate}%` : "-"}
                      </td>
                      <td className="py-2 text-right font-semibold text-neutral-950">
                        {formatCurrency(item.amount, data.business.currency)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={showHsnColumn ? 7 : 6}
                      className="py-6 text-center text-neutral-500"
                    >
                      No items added.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="grid gap-4 border-t border-neutral-300 pt-3 md:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)]">
          <div className="space-y-3">
            {showPayment && paymentDetails.mode ? (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                  Payment
                </p>
                <p className="mt-1 font-semibold text-neutral-950">
                  {paymentDetails.mode}
                  {paymentDetails.upiId ? ` — UPI: ${paymentDetails.upiId}` : ""}
                </p>
              </div>
            ) : null}
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                Amount in Words
              </p>
              <p className="mt-1 text-[10px] font-semibold text-neutral-950">
                {data.amountInWords ||
                  formatAmountInWords(totals.total, data.business.currency)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {showTax ? (
              <div className="border-t border-b border-neutral-300 py-2">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-neutral-600">Taxable</span>
                    <span className="text-[10px] font-semibold text-neutral-950">
                      {formatCurrency(totals.taxableSubtotal, data.business.currency)}
                    </span>
                  </div>
                  {totals.taxMode === "CGST_SGST" ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9px] text-neutral-600">CGST</span>
                        <span className="text-[10px] font-semibold text-neutral-950">
                          {formatCurrency(totals.cgst, data.business.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[9px] text-neutral-600">SGST</span>
                        <span className="text-[10px] font-semibold text-neutral-950">
                          {formatCurrency(totals.sgst, data.business.currency)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] text-neutral-600">IGST</span>
                      <span className="text-[10px] font-semibold text-neutral-950">
                        {formatCurrency(totals.igst, data.business.currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-neutral-600">Total Tax</span>
                    <span className="text-[10px] font-semibold text-neutral-950">
                      {formatCurrency(totals.tax, data.business.currency)}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="border-t border-b border-neutral-400 py-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] text-neutral-600">Subtotal</span>
                  <span className="text-[10px] font-semibold text-neutral-950">
                    {formatCurrency(totals.subtotal, data.business.currency)}
                  </span>
                </div>
                {showTax ? null : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-neutral-600">Tax</span>
                    <span className="text-[10px] font-semibold text-neutral-950">
                      {formatCurrency(totals.tax, data.business.currency)}
                    </span>
                  </div>
                )}
                {totals.roundOff !== 0 ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] text-neutral-600">Round Off</span>
                    <span className="text-[10px] font-semibold text-neutral-950">
                      {totals.roundOff > 0 ? "+" : ""}
                      {formatCurrency(totals.roundOff, data.business.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-end justify-between gap-3 border-t border-neutral-300 pt-2">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-neutral-700">
                    Grand Total
                  </span>
                  <span className="text-[18px] font-bold text-neutral-950">
                    {formatCurrency(totals.total, data.business.currency)}
                  </span>
                </div>
              </div>
            </div>

            {paymentDetails.qrCodeUrl ? (
              <div className="flex items-center gap-3">
                <div className="border border-neutral-300 p-1">
                  <img
                    src={paymentDetails.qrCodeUrl}
                    alt="UPI QR"
                    className="h-16 w-16 object-contain grayscale"
                  />
                </div>
                <p className="text-[9px] text-neutral-500">Scan to pay via UPI</p>
              </div>
            ) : null}
          </div>
        </section>

        {showFooter ? (
          <footer className="mt-auto border-t border-neutral-400 pt-3">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <div className="text-[9px] text-neutral-600">
                <p>
                  {data.closingNote || "Payment due within the stipulated period."}
                </p>
                <p className="mt-1">Computer generated invoice</p>
              </div>
              <div className="text-right">
                <div className="h-10" />
                <p className="border-t border-neutral-400 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-neutral-700">
                  {data.signatureLabel || "Authorized Signatory"}
                </p>
              </div>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateHalfPage;