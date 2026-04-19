"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { getStateFromGstin } from "@/lib/gstin";
import {
  buildBusinessAddressLines,
  parseBusinessAddressText,
} from "@/lib/indianAddress";
import type {
  InvoiceLineItem,
  InvoiceTaxMode,
} from "@/types/invoice-template";
import {
  formatAmountInWords,
  formatCurrency,
} from "../sections/utils";

type ProductionVariant = "standard" | "compact" | "premium";

const round2 = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(" ");

const splitTextLines = (value?: string | null) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const buildCustomerAddressLines = (value?: string | null) => {
  const directLines = splitTextLines(value);
  if (directLines.length) return directLines;

  const parsed = parseBusinessAddressText(value);
  return buildBusinessAddressLines(parsed);
};

const extractUpiId = (value?: string | null) => {
  const match = String(value ?? "").match(/\b[\w.-]{2,}@[a-zA-Z0-9]{2,}\b/);
  return match?.[0] ?? "";
};

const buildQuickChartQrUrl = (upiId: string, amount: number) => {
  const trimmedUpiId = upiId.trim();
  if (!trimmedUpiId) return "";

  const upiLink = new URL("upi://pay");
  upiLink.searchParams.set("pa", trimmedUpiId);
  upiLink.searchParams.set("pn", "BillSutra");
  if (amount > 0) {
    upiLink.searchParams.set("am", amount.toFixed(2));
  }
  upiLink.searchParams.set("cu", "INR");

  return `https://quickchart.io/qr?size=160&text=${encodeURIComponent(upiLink.toString())}`;
};

const getBusinessState = (data: InvoiceSectionRendererProps["data"]) => {
  const gstState = getStateFromGstin(data.business.taxId);
  if (gstState) return gstState;

  return (
    data.business.businessAddress?.state ||
    parseBusinessAddressText(data.business.address).state ||
    ""
  );
};

const getCustomerState = (data: InvoiceSectionRendererProps["data"]) => {
  const gstState = getStateFromGstin(data.client.gstin);
  if (gstState) return gstState;

  return parseBusinessAddressText(data.client.address).state || "";
};

const resolveTaxMode = (data: InvoiceSectionRendererProps["data"]) => {
  if (data.taxMode) return data.taxMode;
  if ((data.totals?.tax ?? 0) <= 0) return "NONE" as InvoiceTaxMode;
  if ((data.totals?.igst ?? 0) > 0) return "IGST" as InvoiceTaxMode;
  if ((data.totals?.cgst ?? 0) > 0 || (data.totals?.sgst ?? 0) > 0) {
    return "CGST_SGST" as InvoiceTaxMode;
  }

  const businessState = getBusinessState(data);
  const customerState = getCustomerState(data);
  if (businessState && customerState && businessState !== customerState) {
    return "IGST";
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
  const amount = round2(item.amount ?? taxableValue + taxAmount);

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

const resolveTotals = (data: InvoiceSectionRendererProps["data"]) => {
  const items = data.items.map(normalizeItem);
  const taxMode = resolveTaxMode(data);
  const subtotal = round2(
    data.totals?.subtotal ??
      items.reduce((sum, item) => sum + item.baseAmount, 0),
  );
  const discount = round2(
    data.totals?.discount ??
      items.reduce((sum, item) => sum + item.discountAmount, 0),
  );
  const taxableSubtotal = round2(
    items.reduce((sum, item) => sum + item.taxableValue, 0),
  );
  const tax = round2(
    data.totals?.tax ??
      items.reduce((sum, item) => sum + item.taxAmount, 0),
  );
  const computedBeforeRound = round2(taxableSubtotal + tax);
  const total =
    typeof data.totals?.total === "number"
      ? round2(data.totals.total)
      : computedBeforeRound;
  const roundOff = round2(
    data.totals?.roundOff ?? total - computedBeforeRound,
  );
  const igst = round2(data.totals?.igst ?? (taxMode === "IGST" ? tax : 0));
  const cgst = round2(
    data.totals?.cgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );
  const sgst = round2(
    data.totals?.sgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );

  return {
    items,
    subtotal,
    discount,
    tax,
    total,
    igst,
    cgst,
    sgst,
    roundOff,
    taxMode,
  };
};

const parsePaymentInfo = (
  data: InvoiceSectionRendererProps["data"],
  grandTotal: number,
) => {
  const lines = data.payment?.extraLines?.length
    ? data.payment.extraLines
    : String(data.paymentInfo ?? "")
        .split(/\r?\n|\|/)
        .map((line) => line.trim())
        .filter(Boolean);

  const upiId = data.payment?.upiId || extractUpiId(data.paymentInfo);
  const qrCodeUrl =
    data.payment?.qrCodeUrl ||
    (data.business.showPaymentQr && upiId
      ? buildQuickChartQrUrl(upiId, grandTotal)
      : "");

  return {
    mode:
      data.payment?.mode ||
      data.payment?.label ||
      data.paymentSummary?.history?.[0]?.method ||
      "",
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

const variantConfig = {
  standard: {
    sheetClass: "px-8 py-8 text-[11px] leading-[1.45]",
    accentSoftClass: "bg-slate-100",
    totalCardClass: "bg-slate-950 text-white",
    invoiceTitleClass: "text-[30px] font-black tracking-[-0.03em]",
    businessTitleClass: "text-[28px] font-black tracking-[-0.03em]",
    headerMetaWidth: "max-w-[260px]",
    metaCardClass: "bg-slate-50",
    summaryCardClass: "bg-slate-50",
    tableHeadClass: "bg-slate-100 text-slate-700",
    bodyTextClass: "text-[11px]",
    labelClass:
      "text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500",
    footerNoteClass: "text-[10px] leading-5 text-slate-600",
  },
  compact: {
    sheetClass: "px-6 py-6 text-[10px] leading-[1.35]",
    accentSoftClass: "bg-stone-100",
    totalCardClass: "bg-stone-950 text-white",
    invoiceTitleClass: "text-[25px] font-black tracking-[-0.03em]",
    businessTitleClass: "text-[23px] font-black tracking-[-0.03em]",
    headerMetaWidth: "max-w-[230px]",
    metaCardClass: "bg-stone-50",
    summaryCardClass: "bg-stone-50",
    tableHeadClass: "bg-stone-100 text-stone-700",
    bodyTextClass: "text-[10px]",
    labelClass:
      "text-[9px] font-semibold uppercase tracking-[0.18em] text-stone-500",
    footerNoteClass: "text-[9px] leading-4 text-stone-600",
  },
  premium: {
    sheetClass: "px-10 py-9 text-[11px] leading-[1.55]",
    accentSoftClass: "bg-slate-100/70",
    totalCardClass: "bg-slate-900 text-white",
    invoiceTitleClass: "text-[34px] font-black tracking-[-0.04em]",
    businessTitleClass: "text-[30px] font-black tracking-[-0.04em]",
    headerMetaWidth: "max-w-[280px]",
    metaCardClass: "bg-slate-50/80",
    summaryCardClass: "bg-slate-50/80",
    tableHeadClass: "bg-slate-100/80 text-slate-700",
    bodyTextClass: "text-[11px]",
    labelClass:
      "text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500",
    footerNoteClass: "text-[10px] leading-5 text-slate-600",
  },
} as const;

const SectionLabel = ({
  className,
  children,
}: {
  className: string;
  children: string;
}) => <p className={className}>{children}</p>;

const ProductionInvoiceTemplate = ({
  data,
  enabledSections,
  theme,
  variant,
}: InvoiceSectionRendererProps & { variant: ProductionVariant }) => {
  const { logo: storedLogo } = useBusinessLogo();
  const config = variantConfig[variant];
  const accentColor = theme.primaryColor || "#1f2937";
  const effectiveLogo = data.business.logoUrl || storedLogo;
  const totals = resolveTotals(data);
  const businessState = getBusinessState(data);
  const customerState = getCustomerState(data);
  const placeOfSupply =
    data.placeOfSupply || customerState || businessState || "-";
  const customerLines = [
    ...(data.client.address ? buildCustomerAddressLines(data.client.address) : []),
    data.client.phone ? `Phone: ${data.client.phone}` : "",
    data.client.email ? `Email: ${data.client.email}` : "",
  ].filter(Boolean);
  const businessLines = [
    ...buildBusinessAddressLines(
      data.business.businessAddress,
      data.business.address,
    ),
    data.business.phone ? `Phone: ${data.business.phone}` : "",
    data.business.email ? `Email: ${data.business.email}` : "",
    data.business.website ? `Website: ${data.business.website}` : "",
  ].filter(Boolean);
  const paymentStatus =
    data.paymentSummary?.statusLabel || (totals.total <= 0 ? "Draft" : "Due");
  const amountInWords =
    data.amountInWords || formatAmountInWords(totals.total, data.business.currency);
  const paymentDetails = parsePaymentInfo(data, totals.total);
  const showHeader =
    enabledSections.includes("header") ||
    enabledSections.includes("company_details");
  const showCustomer = enabledSections.includes("client_details");
  const showItems =
    enabledSections.includes("items") ||
    enabledSections.includes("service_items");
  const showNotes = enabledSections.includes("notes");
  const showPayment = enabledSections.includes("payment_info");
  const showFooter = enabledSections.includes("footer");
  const showTax = enabledSections.includes("tax");
  const showTaxColumns = showTax && totals.taxMode !== "NONE" && totals.tax > 0;
  const showHsnColumn = data.items.some((item) => Boolean(item.hsnSac?.trim()));
  const showDiscountColumn = data.items.some(
    (item) =>
      (Number(item.discountAmount) || 0) > 0 ||
      (Number(item.discountPercent) || 0) > 0,
  );
  const dueAmount = Math.max(
    round2(data.paymentSummary?.remainingAmount ?? totals.total),
    0,
  );
  const paidAmount = round2(data.paymentSummary?.paidAmount ?? 0);
  const isPaid = dueAmount <= 0;
  const watermarkText = data.watermarkText?.trim() || "";
  const itemColumnCount =
    5 +
    Number(showHsnColumn) +
    Number(showDiscountColumn) +
    Number(showTaxColumns) * 2;
  const metaRows = [
    ["Invoice No", data.invoiceNumber],
    ["Date", data.invoiceDate],
    ["Due Date", data.dueDate],
    ["Place of Supply", placeOfSupply],
    ["Payment Status", paymentStatus],
  ];
  const signatureLabel = data.signatureLabel || "Authorized Signature";

  return (
    <div
      className="invoice-content-root"
      style={
        {
          fontFamily: theme.fontFamily,
          color: "#111827",
          "--invoice-accent": accentColor,
        } as CSSProperties
      }
    >
      <section
        className={cn(
          "relative flex min-h-[1067px] w-full flex-col overflow-hidden bg-white print:min-h-0",
          config.sheetClass,
        )}
      >
        {watermarkText ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.045]">
            <div className="translate-y-20 rotate-[-30deg] select-none whitespace-nowrap text-[88px] font-black uppercase tracking-[0.12em] text-slate-900">
              {Array.from({ length: 7 }, () => watermarkText).join("  ")}
            </div>
          </div>
        ) : null}

        {showHeader ? (
          <header className="relative z-10 border-b border-slate-200 pb-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(250px,0.85fr)]">
              <div className="flex items-start gap-4">
                {data.business.showLogoOnInvoice && effectiveLogo ? (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2">
                    <img
                      src={effectiveLogo}
                      alt={`${data.business.businessName} logo`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : null}

                <div className="min-w-0">
                  <SectionLabel className={config.labelClass}>
                    {data.invoiceTitle || (showTaxColumns ? "Tax Invoice" : "Bill")}
                  </SectionLabel>
                  <h1 className={cn("mt-2 text-slate-950", config.businessTitleClass)}>
                    {data.business.businessName}
                  </h1>
                  <div className={cn("mt-3 grid gap-1.5 text-slate-600", config.bodyTextClass)}>
                    {businessLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                  {data.business.showTaxNumber && data.business.taxId ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] text-slate-700">
                      <span>GSTIN</span>
                      <span className="text-slate-950">{data.business.taxId}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={cn("md:justify-self-end md:w-full", config.headerMetaWidth)}>
                <div className="text-right">
                  <p className={cn("text-slate-950", config.invoiceTitleClass)}>
                    {showTaxColumns ? "INVOICE" : "BILL"}
                  </p>
                </div>
                <div className={cn("mt-4 rounded-2xl border border-slate-200 p-4", config.metaCardClass)}>
                  <div className="grid gap-2.5">
                    {metaRows.map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-4 text-right"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {label}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-950">
                          {value || "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </header>
        ) : null}

        {showCustomer ? (
          <section className="relative z-10 grid gap-5 border-b border-slate-200 py-6 md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
            <div>
              <SectionLabel className={config.labelClass}>Bill To</SectionLabel>
              <p className="mt-2 text-[20px] font-bold tracking-[-0.03em] text-slate-950">
                {data.client.name}
              </p>
              <div className={cn("mt-3 grid gap-1.5 text-slate-600", config.bodyTextClass)}>
                {data.client.type === "business" && data.client.gstin ? (
                  <p className="font-semibold text-slate-950">
                    GSTIN: {data.client.gstin}
                  </p>
                ) : null}
                {customerLines.length ? (
                  customerLines.map((line) => <p key={line}>{line}</p>)
                ) : (
                  <p>Customer details not provided.</p>
                )}
              </div>
            </div>

            <div className="md:justify-self-end md:w-full md:max-w-[260px]">
              <div
                className={cn(
                  "rounded-[24px] px-5 py-4",
                  isPaid ? config.accentSoftClass : config.totalCardClass,
                )}
                style={
                  isPaid
                    ? { border: `1px solid ${accentColor}20` }
                    : { backgroundColor: accentColor }
                }
              >
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-[0.18em]",
                    isPaid ? "text-slate-600" : "text-white/70",
                  )}
                >
                  {isPaid ? "Amount Paid" : "Amount Due"}
                </p>
                <p
                  className={cn(
                    "mt-2 text-[28px] font-black tracking-[-0.04em]",
                    isPaid ? "text-slate-950" : "text-white",
                  )}
                >
                  {formatCurrency(
                    isPaid ? paidAmount || totals.total : dueAmount,
                    data.business.currency,
                  )}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                      isPaid
                        ? "bg-white text-slate-700"
                        : "bg-white/10 text-white",
                    )}
                  >
                    {paymentStatus}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.14em]",
                      isPaid ? "text-slate-500" : "text-white/70",
                    )}
                  >
                    {data.dueDate}
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {showItems ? (
          <section className="relative z-10 py-6">
            <div className="overflow-hidden rounded-[24px] border border-slate-200">
              <table className="min-w-full table-fixed border-collapse text-slate-900">
                <thead className={config.tableHeadClass}>
                  <tr>
                    <th className="w-10 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em]">
                      #
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Item Name / Description
                    </th>
                    {showHsnColumn ? (
                      <th className="w-20 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.16em]">
                        HSN/SAC
                      </th>
                    ) : null}
                    <th className="w-16 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Qty
                    </th>
                    <th className="w-24 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Rate
                    </th>
                    {showDiscountColumn ? (
                      <th className="w-24 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                        Discount
                      </th>
                    ) : null}
                    {showTaxColumns ? (
                      <th className="w-28 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                        Taxable Value
                      </th>
                    ) : null}
                    {showTaxColumns ? (
                      <th className="w-20 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                        GST %
                      </th>
                    ) : null}
                    <th className="w-28 px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-[0.16em]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {totals.items.length ? (
                    totals.items.map((item, index) => {
                      const discountLabel =
                        item.discountPercent && item.discountPercent > 0
                          ? `${item.discountPercent}%`
                          : item.discountAmount > 0
                            ? formatCurrency(
                                item.discountAmount,
                                data.business.currency,
                              )
                            : "-";

                      return (
                        <tr key={`${item.name}-${index}`} className="align-top">
                          <td className="border-b border-slate-200 px-3 py-3 text-slate-500">
                            {index + 1}
                          </td>
                          <td className="border-b border-slate-200 px-3 py-3">
                            <p className="font-semibold text-slate-950">
                              {item.name}
                            </p>
                            {item.description ? (
                              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                                {item.description}
                              </p>
                            ) : null}
                          </td>
                          {showHsnColumn ? (
                            <td className="border-b border-slate-200 px-3 py-3 text-slate-600">
                              {item.hsnSac || "-"}
                            </td>
                          ) : null}
                          <td className="border-b border-slate-200 px-3 py-3 text-right text-slate-700">
                            {item.quantity}
                          </td>
                          <td className="border-b border-slate-200 px-3 py-3 text-right text-slate-700">
                            {formatCurrency(item.unitPrice, data.business.currency)}
                          </td>
                          {showDiscountColumn ? (
                            <td className="border-b border-slate-200 px-3 py-3 text-right text-slate-700">
                              {discountLabel}
                            </td>
                          ) : null}
                          {showTaxColumns ? (
                            <td className="border-b border-slate-200 px-3 py-3 text-right text-slate-700">
                              {formatCurrency(
                                item.taxableValue,
                                data.business.currency,
                              )}
                            </td>
                          ) : null}
                          {showTaxColumns ? (
                            <td className="border-b border-slate-200 px-3 py-3 text-right text-slate-700">
                              {item.taxRate > 0 ? `${item.taxRate}%` : "-"}
                            </td>
                          ) : null}
                          <td className="border-b border-slate-200 px-3 py-3 text-right font-semibold text-slate-950">
                            {formatCurrency(item.amount, data.business.currency)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={itemColumnCount}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No items added yet. Add products or services to generate
                        the invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="relative z-10 grid gap-6 pb-6 md:grid-cols-[minmax(0,1.12fr)_minmax(260px,0.88fr)]">
          <div className="grid gap-5">
            <div>
              <SectionLabel className={config.labelClass}>Amount in Words</SectionLabel>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-950">
                {amountInWords}
              </p>
            </div>

            {showPayment ? (
              <div className={cn("rounded-[24px] border border-slate-200 p-4", config.summaryCardClass)}>
                <SectionLabel className={config.labelClass}>Payment Section</SectionLabel>
                <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                  <div className="grid gap-1.5 text-slate-600">
                    {paymentDetails.mode ? (
                      <p className="font-semibold text-slate-950">
                        Payment Mode: {paymentDetails.mode}
                      </p>
                    ) : null}
                    {paymentDetails.upiId ? (
                      <p>
                        <span className="font-semibold text-slate-950">UPI ID:</span>{" "}
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
                    <div className="w-[128px] shrink-0 rounded-2xl border border-slate-200 bg-white p-3 text-center">
                      <img
                        src={paymentDetails.qrCodeUrl}
                        alt="UPI QR code"
                        className="h-[102px] w-[102px] object-contain"
                      />
                      <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Scan to Pay
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className={cn("rounded-[24px] border border-slate-200 p-4", config.summaryCardClass)}>
            <SectionLabel className={config.labelClass}>Tax Summary</SectionLabel>
            <div className="mt-3 grid gap-2 text-[11px]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-950">
                  {formatCurrency(totals.subtotal, data.business.currency)}
                </span>
              </div>
              {totals.discount > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">
                    {data.discount?.label ?? "Discount"}
                  </span>
                  <span className="font-semibold text-slate-950">
                    -{formatCurrency(totals.discount, data.business.currency)}
                  </span>
                </div>
              ) : null}
              {showTax && totals.taxMode === "IGST" && totals.igst > 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">IGST</span>
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(totals.igst, data.business.currency)}
                  </span>
                </div>
              ) : null}
              {showTax && totals.taxMode === "CGST_SGST" && totals.tax > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">CGST</span>
                    <span className="font-semibold text-slate-950">
                      {formatCurrency(totals.cgst, data.business.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500">SGST</span>
                    <span className="font-semibold text-slate-950">
                      {formatCurrency(totals.sgst, data.business.currency)}
                    </span>
                  </div>
                </>
              ) : null}
              {totals.roundOff !== 0 ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-500">Round Off</span>
                  <span className="font-semibold text-slate-950">
                    {totals.roundOff > 0 ? "+" : ""}
                    {formatCurrency(totals.roundOff, data.business.currency)}
                  </span>
                </div>
              ) : null}
              <div className="mt-2 border-t border-slate-300 pt-3">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                    Grand Total
                  </span>
                  <span className="text-[22px] font-black tracking-[-0.04em] text-slate-950">
                    {formatCurrency(totals.total, data.business.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showFooter ? (
          <footer className="relative z-10 mt-auto border-t border-slate-200 pt-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(220px,0.8fr)]">
              <div>
                {showNotes ? (
                  <>
                    <SectionLabel className={config.labelClass}>Notes / Terms</SectionLabel>
                    <div className={cn("mt-2 grid gap-1.5", config.footerNoteClass)}>
                      {splitTextLines(data.notes).length ? (
                        splitTextLines(data.notes).map((line) => (
                          <p key={line}>{line}</p>
                        ))
                      ) : (
                        <p>Payment due as per the invoice due date.</p>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              <div className="md:justify-self-end md:text-right">
                <div className="h-14" />
                <p className="border-t border-slate-300 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {signatureLabel}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  For {data.business.businessName}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-3 text-[10px] text-slate-500">
              <p>{data.closingNote || "Thank you for your business."}</p>
              <p className="font-semibold uppercase tracking-[0.14em]">
                Computer Generated Invoice
              </p>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default ProductionInvoiceTemplate;
