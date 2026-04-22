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

  if (directLines.length) {
    return directLines;
  }

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

  return `https://quickchart.io/qr?size=180&text=${encodeURIComponent(upiLink.toString())}`;
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
  if (data.taxMode === "NONE" || totalTax <= 0) {
    return "NONE" as InvoiceTaxMode;
  }

  if (businessState && placeOfSupplyState) {
    return businessState === placeOfSupplyState ? "CGST_SGST" : "IGST";
  }

  if (data.taxMode) {
    return data.taxMode;
  }

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

type TaxBreakdownRow = {
  rate: number;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
};

const buildTaxBreakdown = (
  items: Array<ReturnType<typeof normalizeItem>>,
  taxMode: InvoiceTaxMode,
) => {
  const grouped = new Map<number, TaxBreakdownRow>();

  items.forEach((item) => {
    const rate = round2(item.taxRate);
    const current = grouped.get(rate) ?? {
      rate,
      taxableValue: 0,
      cgstRate: 0,
      sgstRate: 0,
      igstRate: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalTax: 0,
    };

    current.taxableValue = round2(current.taxableValue + item.taxableValue);
    current.totalTax = round2(current.totalTax + item.taxAmount);

    if (taxMode === "CGST_SGST" && rate > 0) {
      current.cgstRate = round2(rate / 2);
      current.sgstRate = round2(rate / 2);
      current.cgstAmount = round2(current.cgstAmount + item.taxAmount / 2);
      current.sgstAmount = round2(current.sgstAmount + item.taxAmount / 2);
    }

    if (taxMode === "IGST" && rate > 0) {
      current.igstRate = rate;
      current.igstAmount = round2(current.igstAmount + item.taxAmount);
    }

    grouped.set(rate, current);
  });

  return Array.from(grouped.values()).sort((left, right) => left.rate - right.rate);
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
  const total =
    typeof data.totals?.total === "number"
      ? round2(data.totals.total)
      : computedBeforeRound;
  const roundOff = round2(
    data.totals?.roundOff ?? total - computedBeforeRound,
  );
  const cgst = round2(
    data.totals?.cgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );
  const sgst = round2(
    data.totals?.sgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );
  const igst = round2(
    data.totals?.igst ?? (taxMode === "IGST" ? tax : 0),
  );

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
    taxBreakdown: buildTaxBreakdown(items, taxMode),
  };
};

const parsePaymentInfo = (
  data: InvoiceSectionRendererProps["data"],
  grandTotal: number,
) => {
  const lines = data.payment?.extraLines?.length
    ? data.payment.extraLines
    : splitTextLines(data.paymentInfo);
  const mode =
    data.payment?.mode ||
    data.payment?.label ||
    data.paymentSummary?.history?.[0]?.method ||
    "";
  const upiId = data.payment?.upiId || extractUpiId(data.paymentInfo);
  const qrCodeUrl =
    data.payment?.qrCodeUrl ||
    (data.business.showPaymentQr && upiId
      ? buildQuickChartQrUrl(upiId, grandTotal, data.business.businessName)
      : "");

  return {
    mode,
    upiId,
    qrCodeUrl,
    lines,
    bankLines: [
      data.payment?.accountName ? `Account Name: ${data.payment.accountName}` : "",
      data.payment?.bankName ? `Bank: ${data.payment.bankName}` : "",
      data.payment?.accountNumber
        ? `Account No: ${data.payment.accountNumber}`
        : "",
      data.payment?.ifsc ? `IFSC: ${data.payment.ifsc}` : "",
      data.payment?.branch ? `Branch: ${data.payment.branch}` : "",
    ].filter(Boolean),
  };
};

const MetaRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
      {label}
    </span>
    <span className="text-right font-semibold text-neutral-950">
      {value?.trim() || "-"}
    </span>
  </div>
);

const TemplateIndianGst = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const { logo: storedLogo } = useBusinessLogo();
  const businessState = getBusinessState(data);
  const customerState = getCustomerState(data);
  const placeOfSupply = resolvePlaceOfSupply(data, customerState, businessState);
  const totals = resolveTotals(data, businessState, placeOfSupply.state);
  const amountInWords =
    data.amountInWords || formatAmountInWords(totals.total, data.business.currency);
  const paymentDetails = parsePaymentInfo(data, totals.total);
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
    totals.taxBreakdown.length > 0;
  const showPayment = enabledSections.includes("payment_info");
  const showNotes = enabledSections.includes("notes");
  const showFooter = enabledSections.includes("footer");
  const showHsnColumn = totals.items.some((item) => Boolean(item.hsnSac?.trim()));
  const businessLines = [
    ...buildBusinessAddressLines(
      data.business.businessAddress,
      data.business.address,
    ),
    data.business.phone ? `Phone: ${data.business.phone}` : "",
    data.business.email ? `Email: ${data.business.email}` : "",
  ].filter(Boolean);
  const customerLines = [
    ...buildCustomerAddressLines(data.client.address),
    data.client.phone ? `Phone: ${data.client.phone}` : "",
    data.client.email ? `Email: ${data.client.email}` : "",
  ].filter(Boolean);
  const invoiceTitle =
    totals.taxMode === "NONE"
      ? (data.invoiceTitle?.trim().toUpperCase() || "INVOICE")
      : "TAX INVOICE";
  const signatureLabel = data.signatureLabel || "Authorized Signatory";

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
      <section className="flex min-h-[1067px] w-full flex-col bg-white px-8 py-8 text-[11px] leading-[1.45] print:min-h-0">
        {showHeader ? (
          <header className="border-b border-neutral-400 pb-5">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <div className="flex items-start gap-4">
                {data.business.showLogoOnInvoice && effectiveLogo ? (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-neutral-300 bg-white p-2">
                    <img
                      src={effectiveLogo}
                      alt={`${data.business.businessName} logo`}
                      className="max-h-full max-w-full object-contain grayscale"
                    />
                  </div>
                ) : null}
                <div className="min-w-0">
                  <h1 className="text-[28px] font-bold uppercase tracking-[0.01em] text-neutral-950">
                    {data.business.businessName}
                  </h1>
                  <div className="mt-2 grid gap-1 text-neutral-700">
                    {businessLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {data.business.taxId ? (
                    <div className="mt-4 inline-flex items-center gap-2 border border-neutral-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-950">
                      <span>GSTIN</span>
                      <span>{data.business.taxId}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="md:justify-self-end md:w-full md:max-w-[300px]">
                <p className="text-right text-[26px] font-bold tracking-[0.08em] text-neutral-950">
                  {invoiceTitle}
                </p>
                <div className="mt-4 space-y-2 border-t border-b border-neutral-300 py-3">
                  <MetaRow label="Invoice Number" value={data.invoiceNumber} />
                  <MetaRow label="Invoice Date" value={data.invoiceDate} />
                  <MetaRow label="Due Date" value={data.dueDate} />
                  <MetaRow label="Place of Supply" value={placeOfSupply.label} />
                </div>
              </div>
            </div>
          </header>
        ) : null}

        {showCustomer ? (
          <section className="border-b border-neutral-300 py-5">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Bill To
                </p>
                <p className="mt-2 text-[18px] font-bold text-neutral-950">
                  {data.client.name || "Customer"}
                </p>
                {data.client.gstin ? (
                  <p className="mt-2 font-semibold text-neutral-950">
                    GSTIN: {data.client.gstin}
                  </p>
                ) : null}
                <div className="mt-2 grid gap-1 text-neutral-700">
                  {customerLines.length ? (
                    customerLines.map((line) => <p key={line}>{line}</p>)
                  ) : (
                    <p>Customer details not provided.</p>
                  )}
                </div>
              </div>

              <div className="border-l border-neutral-300 pl-4 text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  GST Mode
                </p>
                <p className="mt-2 text-base font-semibold text-neutral-950">
                  {totals.taxMode === "IGST"
                    ? "Inter-state Supply"
                    : totals.taxMode === "CGST_SGST"
                      ? "Intra-state Supply"
                      : "GST Not Applied"}
                </p>
                {businessState ? (
                  <p className="mt-2 text-neutral-700">Business State: {businessState}</p>
                ) : null}
                {placeOfSupply.label !== "-" ? (
                  <p className="mt-1 text-neutral-700">
                    Supply State: {placeOfSupply.label}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {showItems ? (
          <section className="py-5">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-t border-b border-neutral-400 text-neutral-700">
                  <th className="w-10 py-2 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">Item Description</th>
                  {showHsnColumn ? (
                    <th className="w-24 py-2 text-left font-semibold">HSN/SAC</th>
                  ) : null}
                  <th className="w-20 py-2 text-right font-semibold">Qty</th>
                  <th className="w-28 py-2 text-right font-semibold">Taxable Value (₹)</th>
                  <th className="w-20 py-2 text-right font-semibold">Tax %</th>
                  <th className="w-32 py-2 text-right font-semibold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {totals.items.length ? (
                  totals.items.map((item, index) => {
                    const detailLines = [
                      item.description?.trim() || "",
                      item.discountPercent && item.discountPercent > 0
                        ? `Discount: ${item.discountPercent}%`
                        : item.discountAmount > 0
                          ? `Discount: ${formatCurrency(item.discountAmount, data.business.currency)}`
                          : "",
                    ].filter(Boolean);

                    return (
                      <tr key={`${item.name}-${index}`} className="border-b border-neutral-200 align-top">
                        <td className="py-3 pr-3 text-neutral-600">{index + 1}</td>
                        <td className="py-3 pr-4">
                          <p className="font-semibold text-neutral-950">{item.name}</p>
                          {detailLines.map((line) => (
                            <p key={line} className="mt-1 text-[10px] text-neutral-500">
                              {line}
                            </p>
                          ))}
                        </td>
                        {showHsnColumn ? (
                          <td className="py-3 pr-3 text-neutral-700">
                            {item.hsnSac?.trim() || "-"}
                          </td>
                        ) : null}
                        <td className="py-3 pr-3 text-right text-neutral-700">
                          {item.quantity}{item.unitLabel ? ` ${item.unitLabel}` : ""}
                        </td>
                        <td className="py-3 pr-3 text-right text-neutral-700">
                          {formatCurrency(
                            item.quantity > 0
                              ? item.taxableValue / item.quantity
                              : item.taxableValue,
                            data.business.currency,
                          )}
                        </td>
                        <td className="py-3 pr-3 text-right text-neutral-700">
                          {item.taxRate > 0 ? `${item.taxRate}%` : "-"}
                        </td>
                        <td className="py-3 text-right font-semibold text-neutral-950">
                          {formatCurrency(item.amount, data.business.currency)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={showHsnColumn ? 7 : 6}
                      className="py-10 text-center text-neutral-500"
                    >
                      No items added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="grid gap-8 border-t border-neutral-300 pt-5 md:grid-cols-[minmax(0,1.06fr)_minmax(260px,0.94fr)]">
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                Amount in Words
              </p>
              <p className="mt-2 text-[13px] font-semibold text-neutral-950">
                {amountInWords}
              </p>
            </div>

            {showPayment ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Payment Section
                </p>
                <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="space-y-1.5 text-neutral-700">
                    {paymentDetails.mode ? (
                      <p className="font-semibold text-neutral-950">
                        Payment Mode: {paymentDetails.mode}
                      </p>
                    ) : null}
                    {paymentDetails.upiId ? (
                      <p>
                        <span className="font-semibold text-neutral-950">UPI ID:</span>{" "}
                        {paymentDetails.upiId}
                      </p>
                    ) : null}
                    {paymentDetails.lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {paymentDetails.bankLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>

                  {paymentDetails.qrCodeUrl ? (
                    <div className="w-[136px] border border-neutral-300 p-2 text-center">
                      <img
                        src={paymentDetails.qrCodeUrl}
                        alt="UPI QR code"
                        className="mx-auto h-[112px] w-[112px] object-contain grayscale"
                      />
                      <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        Scan to Pay
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showNotes ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  Notes / Terms
                </p>
                <div className="mt-2 space-y-1.5 text-neutral-700">
                  {splitTextLines(data.notes).length ? (
                    splitTextLines(data.notes).map((line) => (
                      <p key={line}>{line}</p>
                    ))
                  ) : (
                    <p>Payment due as per agreed terms.</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-5">
            {showTax ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                  GST Breakdown
                </p>
                <table className="mt-3 min-w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="border-t border-b border-neutral-400 text-neutral-700">
                      <th className="py-2 text-left font-semibold">Taxable Value</th>
                      <th className="py-2 text-right font-semibold">CGST %</th>
                      <th className="py-2 text-right font-semibold">SGST %</th>
                      <th className="py-2 text-right font-semibold">IGST %</th>
                      <th className="py-2 text-right font-semibold">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {totals.taxBreakdown.map((row) => (
                      <tr key={row.rate} className="border-b border-neutral-200">
                        <td className="py-2 text-neutral-700">
                          {formatCurrency(row.taxableValue, data.business.currency)}
                        </td>
                        <td className="py-2 text-right text-neutral-700">
                          {row.cgstRate > 0 ? `${row.cgstRate}%` : "-"}
                        </td>
                        <td className="py-2 text-right text-neutral-700">
                          {row.sgstRate > 0 ? `${row.sgstRate}%` : "-"}
                        </td>
                        <td className="py-2 text-right text-neutral-700">
                          {row.igstRate > 0 ? `${row.igstRate}%` : "-"}
                        </td>
                        <td className="py-2 text-right font-semibold text-neutral-950">
                          {formatCurrency(row.totalTax, data.business.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="border-t border-b border-neutral-400 py-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-neutral-600">Subtotal</span>
                  <span className="font-semibold text-neutral-950">
                    {formatCurrency(totals.subtotal, data.business.currency)}
                  </span>
                </div>
                {totals.discount > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-600">
                      {data.discount?.label ?? "Discount"}
                    </span>
                    <span className="font-semibold text-neutral-950">
                      -{formatCurrency(totals.discount, data.business.currency)}
                    </span>
                  </div>
                ) : null}
                {totals.taxableSubtotal > 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-600">Taxable Value</span>
                    <span className="font-semibold text-neutral-950">
                      {formatCurrency(
                        totals.taxableSubtotal,
                        data.business.currency,
                      )}
                    </span>
                  </div>
                ) : null}
                {showTax ? (
                  <>
                    {totals.taxMode === "CGST_SGST" ? (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-neutral-600">CGST</span>
                          <span className="font-semibold text-neutral-950">
                            {formatCurrency(totals.cgst, data.business.currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-neutral-600">SGST</span>
                          <span className="font-semibold text-neutral-950">
                            {formatCurrency(totals.sgst, data.business.currency)}
                          </span>
                        </div>
                      </>
                    ) : null}
                    {totals.taxMode === "IGST" ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-neutral-600">IGST</span>
                        <span className="font-semibold text-neutral-950">
                          {formatCurrency(totals.igst, data.business.currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-neutral-600">Total GST</span>
                      <span className="font-semibold text-neutral-950">
                        {formatCurrency(totals.tax, data.business.currency)}
                      </span>
                    </div>
                  </>
                ) : null}
                {totals.roundOff !== 0 ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-neutral-600">Round Off</span>
                    <span className="font-semibold text-neutral-950">
                      {totals.roundOff > 0 ? "+" : ""}
                      {formatCurrency(totals.roundOff, data.business.currency)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-end justify-between gap-4 border-t border-neutral-300 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
                    Grand Total
                  </span>
                  <span className="text-[24px] font-bold text-neutral-950">
                    {formatCurrency(totals.total, data.business.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showFooter ? (
          <footer className="mt-auto border-t border-neutral-400 pt-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="text-[10px] text-neutral-600">
                <p>This is a computer generated invoice</p>
                {data.closingNote ? <p className="mt-2">{data.closingNote}</p> : null}
              </div>
              <div className="text-right">
                <div className="h-14" />
                <p className="border-t border-neutral-400 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-700">
                  {signatureLabel}
                </p>
                <p className="mt-1 text-[10px] text-neutral-600">
                  For {data.business.businessName}
                </p>
              </div>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateIndianGst;
