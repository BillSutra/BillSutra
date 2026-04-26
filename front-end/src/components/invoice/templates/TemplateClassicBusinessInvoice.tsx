"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import {
  buildBusinessAddressLines,
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

const buildCustomerLines = (value?: string | null) => {
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

const detectTransactionId = (lines: string[]) => {
  const match = lines.find((line) =>
    /transaction|txn|utr|reference/i.test(line),
  );
  return match ?? "";
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
  const taxAmount = round2(item.gstAmount ?? taxableValue * (taxRate / 100));
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

const resolveTaxMode = (data: InvoiceSectionRendererProps["data"]) => {
  if (data.taxMode) return data.taxMode;
  if ((data.totals?.tax ?? 0) <= 0) return "NONE" as InvoiceTaxMode;
  if ((data.totals?.igst ?? 0) > 0) return "IGST" as InvoiceTaxMode;
  return "CGST_SGST" as InvoiceTaxMode;
};

const resolveTotals = (data: InvoiceSectionRendererProps["data"]) => {
  const items = data.items.map(normalizeItem);
  const subtotal = round2(
    data.totals?.subtotal ??
      items.reduce((sum, item) => sum + item.baseAmount, 0),
  );
  const discount = round2(
    data.totals?.discount ??
      items.reduce((sum, item) => sum + item.discountAmount, 0),
  );
  const taxMode = resolveTaxMode(data);
  const tax = round2(
    data.totals?.tax ?? items.reduce((sum, item) => sum + item.taxAmount, 0),
  );
  const grandTotal = round2(
    data.totals?.grandTotal ?? data.totals?.total ?? subtotal - discount + tax,
  );
  const cgst = round2(
    data.totals?.cgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );
  const sgst = round2(
    data.totals?.sgst ?? (taxMode === "CGST_SGST" ? tax / 2 : 0),
  );
  const igst = round2(data.totals?.igst ?? (taxMode === "IGST" ? tax : 0));
  const paidAmount = round2(data.paymentSummary?.paidAmount ?? 0);
  const balanceDue = round2(
    data.paymentSummary?.remainingAmount ?? Math.max(grandTotal - paidAmount, 0),
  );

  return {
    items,
    subtotal,
    discount,
    tax,
    grandTotal,
    cgst,
    sgst,
    igst,
    taxMode,
    paidAmount,
    balanceDue,
  };
};

const labelClass =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500";

const summaryRowClass =
  "flex items-start justify-between gap-4 text-[13px] leading-6 text-neutral-900";

const TemplateClassicBusinessInvoice = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const showHeader = enabledSections.includes("header");
  const showClient = enabledSections.includes("client_details");
  const showItems = enabledSections.includes("items");
  const showTax = enabledSections.includes("tax");
  const showPayment = enabledSections.includes("payment_info");
  const showNotes = enabledSections.includes("notes");
  const showFooter = enabledSections.includes("footer");

  const businessLines = buildBusinessAddressLines(
    data.business.businessAddress,
    data.business.address,
  );
  const customerLines = buildCustomerLines(data.client.address);
  const paymentLines = [
    ...splitTextLines(data.paymentInfo),
    ...(data.payment?.extraLines ?? []),
  ];
  const noteLines = splitTextLines(data.notes);
  const termsLines = [
    "Payment is due within the agreed credit period mentioned on this invoice.",
    "Late fees may apply on outstanding balances after the due date.",
    "Goods once sold or delivered are subject to the agreed return policy only.",
  ];
  const declarationText =
    "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.";

  const {
    items,
    subtotal,
    discount,
    tax,
    grandTotal,
    cgst,
    sgst,
    igst,
    taxMode,
    paidAmount,
    balanceDue,
  } = resolveTotals(data);
  const currency = data.business.currency || "INR";
  const amountInWords =
    data.amountInWords || formatAmountInWords(grandTotal, currency);
  const paymentStatus =
    data.paymentSummary?.statusLabel ||
    (paidAmount >= grandTotal
      ? "PAID"
      : paidAmount > 0
        ? "PARTIAL"
        : "UNPAID");
  const paymentMethod =
    data.payment?.mode ||
    data.payment?.label ||
    data.paymentSummary?.history?.[0]?.method ||
    "Not specified";
  const transactionId = detectTransactionId(paymentLines);
  const upiId = data.payment?.upiId || extractUpiId(data.paymentInfo);
  const invoiceTitle = data.invoiceTitle || "INVOICE";

  return (
    <section
      className="mx-auto w-full max-w-[794px] bg-white px-10 py-10 text-black print:max-w-none print:px-8 print:py-8"
      style={
        {
          fontFamily: theme.fontFamily,
        } as CSSProperties
      }
    >
      <div className="space-y-7">
        {showHeader ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-10">
              <div className="space-y-3">
                <div>
                  <h1 className="text-[28px] font-black uppercase tracking-[-0.03em] text-neutral-950">
                    {data.business.businessName || "Business Name"}
                  </h1>
                  <div className="mt-3 space-y-1 text-[13px] leading-6 text-neutral-700">
                    {businessLines.length ? (
                      businessLines.map((line) => <p key={line}>{line}</p>)
                    ) : (
                      <p>Business address not provided.</p>
                    )}
                    <p>Phone: {data.business.phone || "-"}</p>
                    <p>Email: {data.business.email || "-"}</p>
                    {data.business.taxId ? <p>GST No: {data.business.taxId}</p> : null}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <h2 className="text-[36px] font-black tracking-[-0.05em] text-neutral-950">
                  {invoiceTitle}
                </h2>
                <div className="mt-4 space-y-2 border-t-[3px] border-b border-neutral-300 py-4 text-[13px] leading-6 text-neutral-800">
                  <div className={summaryRowClass}>
                    <span className="font-bold">Invoice Number</span>
                    <span>{data.invoiceNumber || "-"}</span>
                  </div>
                  <div className={summaryRowClass}>
                    <span className="font-bold">Invoice Date</span>
                    <span>{data.invoiceDate || "-"}</span>
                  </div>
                  <div className={summaryRowClass}>
                    <span className="font-bold">Due Date</span>
                    <span>{data.dueDate || "-"}</span>
                  </div>
                  <div className={summaryRowClass}>
                    <span className="font-bold">Payment Status</span>
                    <span className="font-bold">{paymentStatus}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t-[3px] border-neutral-950" />
          </>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-10">
          <div className="space-y-3">
            {showClient ? (
              <>
                <p className={labelClass}>Bill To</p>
                <div className="space-y-2">
                  <p className="text-[18px] font-black uppercase tracking-[-0.02em] text-neutral-950">
                    {data.client.name || "Customer"}
                  </p>
                  <div className="space-y-1 text-[13px] leading-6 text-neutral-700">
                    <p>Email: {data.client.email || "-"}</p>
                    {data.client.phone ? <p>Phone: {data.client.phone}</p> : null}
                    {customerLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                    {data.client.gstin ? <p>GST No: {data.client.gstin}</p> : null}
                    {!data.client.email && !data.client.phone && !customerLines.length ? (
                      <p>Customer details not provided.</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <aside className="self-start border border-neutral-900">
            <div className="bg-neutral-950 px-5 py-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">
                Grand Total
              </p>
              <p className="mt-2 text-[28px] font-black tracking-[-0.05em] text-white">
                {formatCurrency(grandTotal, currency)}
              </p>
            </div>
            <div className="space-y-2 px-5 py-4 text-[13px] leading-6 text-neutral-900">
              <div className={summaryRowClass}>
                <span className="font-bold">Amount Paid</span>
                <span>{formatCurrency(paidAmount, currency)}</span>
              </div>
              <div className={summaryRowClass}>
                <span className="font-bold">Balance Due</span>
                <span>{formatCurrency(balanceDue, currency)}</span>
              </div>
              <div className={summaryRowClass}>
                <span className="font-bold">Status</span>
                <span className="font-bold">{paymentStatus}</span>
              </div>
            </div>
          </aside>
        </div>

        {showItems ? (
          <>
            <div className="border-t-[3px] border-neutral-950" />
            <div className="overflow-hidden border border-neutral-300">
              <div className="grid grid-cols-[minmax(0,1.4fr)_84px_110px_90px_130px] bg-neutral-950 px-4 py-3 text-[12px] font-bold uppercase tracking-[0.12em] text-white">
                <span>Item / Description</span>
                <span className="text-center">Quantity</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Tax</span>
                <span className="text-right">Amount</span>
              </div>

              {items.length ? (
                items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1.4fr)_84px_110px_90px_130px] border-b border-neutral-200 px-4 py-4 text-[13px] leading-6 text-neutral-900"
                  >
                    <div>
                      <p className="font-semibold text-neutral-950">{item.name}</p>
                      {item.description ? (
                        <p className="text-[12px] leading-5 text-neutral-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-center">
                      {item.quantity}
                      {item.unitLabel ? ` ${item.unitLabel}` : ""}
                    </span>
                    <span className="text-right">
                      {formatCurrency(item.unitPrice, currency)}
                    </span>
                    <span className="text-right">
                      {item.taxRate > 0 ? `${item.taxRate}%` : "-"}
                    </span>
                    <span className="text-right font-semibold">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-[13px] text-neutral-500">
                  No items added yet.
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_286px] gap-12">
          <div className="space-y-6">
            <section className="space-y-2">
              <p className={labelClass}>Amount in Words</p>
              <p className="text-[14px] font-semibold leading-7 text-neutral-950">
                {amountInWords}
              </p>
            </section>

            {showPayment ? (
              <section className="space-y-2">
                <p className={labelClass}>Payment Details</p>
                <div className="space-y-1 text-[13px] leading-6 text-neutral-800">
                  <p>
                    <span className="font-bold">Payment Method:</span>{" "}
                    {paymentMethod}
                  </p>
                  {upiId ? (
                    <p>
                      <span className="font-bold">UPI ID:</span> {upiId}
                    </p>
                  ) : null}
                  {data.payment?.bankName ? (
                    <p>
                      <span className="font-bold">Bank:</span>{" "}
                      {data.payment.bankName}
                    </p>
                  ) : null}
                  {data.payment?.accountNumber ? (
                    <p>
                      <span className="font-bold">Account Number:</span>{" "}
                      {data.payment.accountNumber}
                    </p>
                  ) : null}
                  {data.payment?.ifsc ? (
                    <p>
                      <span className="font-bold">IFSC:</span> {data.payment.ifsc}
                    </p>
                  ) : null}
                  {transactionId ? <p>{transactionId}</p> : null}
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <p className={labelClass}>Terms & Conditions</p>
              <div className="space-y-1 text-[13px] leading-7 text-neutral-700">
                {termsLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className={labelClass}>Declaration</p>
              <p className="max-w-[500px] text-[13px] leading-7 text-neutral-700">
                {declarationText}
              </p>
            </section>

            {showNotes ? (
              <section className="space-y-2">
                <p className={labelClass}>Notes</p>
                <div className="space-y-1 text-[13px] leading-7 text-neutral-700">
                  {(noteLines.length
                    ? noteLines
                    : ["Thank you for your business."]).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-2 self-start border-t-[3px] border-neutral-950 pt-3">
            <div className={summaryRowClass}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal, currency)}</span>
            </div>
            {discount > 0 ? (
              <div className={summaryRowClass}>
                <span>{data.discount?.label || "Discount"}</span>
                <span>-{formatCurrency(discount, currency)}</span>
              </div>
            ) : null}
            {showTax && taxMode === "CGST_SGST" ? (
              <>
                <div className={summaryRowClass}>
                  <span>CGST</span>
                  <span>{formatCurrency(cgst, currency)}</span>
                </div>
                <div className={summaryRowClass}>
                  <span>SGST</span>
                  <span>{formatCurrency(sgst, currency)}</span>
                </div>
              </>
            ) : null}
            {showTax && taxMode === "IGST" ? (
              <div className={summaryRowClass}>
                <span>IGST</span>
                <span>{formatCurrency(igst, currency)}</span>
              </div>
            ) : null}
            {showTax ? (
              <div className={summaryRowClass}>
                <span>Total Tax</span>
                <span>{formatCurrency(tax, currency)}</span>
              </div>
            ) : null}
            <div className="border-t border-b-[3px] border-neutral-950 py-3">
              <div className="flex items-end justify-between gap-4">
                <span className="text-[14px] font-black uppercase tracking-[0.08em] text-neutral-950">
                  Grand Total
                </span>
                <span className="text-[24px] font-black tracking-[-0.04em] text-neutral-950">
                  {formatCurrency(grandTotal, currency)}
                </span>
              </div>
            </div>
            <div className={summaryRowClass}>
              <span>Amount Paid</span>
              <span>{formatCurrency(paidAmount, currency)}</span>
            </div>
            <div className={summaryRowClass}>
              <span>Balance Due</span>
              <span className="font-bold">{formatCurrency(balanceDue, currency)}</span>
            </div>
          </aside>
        </div>

        {showFooter ? (
          <div className="flex justify-end pt-10">
            <div className="w-[230px] text-right">
              <div className="border-t-[2px] border-neutral-950" />
              <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.14em] text-neutral-950">
                {data.signatureLabel || "Authorized Signatory"}
              </p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-700">
                {data.business.businessName}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default TemplateClassicBusinessInvoice;
