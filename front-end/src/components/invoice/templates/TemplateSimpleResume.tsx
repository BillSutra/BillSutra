"use client";

import type { CSSProperties } from "react";
import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
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

const normalizeItem = (item: InvoiceLineItem) => {
  const quantity = Number(item.quantity) || 0;
  const unitPrice = Number(item.unitPrice) || 0;
  const baseAmount = round2(quantity * unitPrice);
  const taxRate = Number(item.taxRate) || 0;
  const taxAmount = round2(baseAmount * (taxRate / 100));
  const amount = round2(item.amount ?? baseAmount + taxAmount);

  return {
    ...item,
    quantity,
    unitPrice,
    taxRate,
    amount,
  };
};

const resolveTotals = (data: InvoiceSectionRendererProps["data"]) => {
  const items = data.items.map(normalizeItem);
  const subtotal = round2(
    data.totals?.subtotal ??
      items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  const tax = round2(data.totals?.tax ?? 0);
  const cgst = round2(data.totals?.cgst ?? 0);
  const sgst = round2(data.totals?.sgst ?? 0);
  const grandTotal = round2(data.totals?.grandTotal ?? data.totals?.total ?? subtotal + tax);
  const paidAmount = round2(data.paymentSummary?.paidAmount ?? 0);

  return {
    items,
    subtotal,
    cgst,
    sgst,
    tax,
    grandTotal,
    paidAmount,
  };
};

const sectionTitleClass =
  "text-[12px] font-black uppercase tracking-[0.24em] text-black";

const summaryRowClass =
  "flex items-center justify-between gap-4 text-[13px] leading-6 text-black";

const TemplateSimpleResume = ({
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

  const businessLines = data.business.businessAddress
    ? buildBusinessAddressLines(data.business.businessAddress)
    : buildBusinessAddressLines(parseBusinessAddressText(data.business.address));
  const customerLines = buildCustomerLines(data.client.address);
  const paymentLines = splitTextLines(data.paymentInfo);
  const noteLines = splitTextLines(data.notes);
  const termsLines = [
    "Payment is due by the due date mentioned on this invoice.",
    "Goods or services should be checked at the time of delivery.",
    "This is a computer-generated tax invoice.",
  ];
  const declarationText =
    "We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct.";

  const { items, subtotal, cgst, sgst, tax, grandTotal, paidAmount } =
    resolveTotals(data);
  const currency = data.business.currency || "INR";
  const amountInWords =
    data.amountInWords || formatAmountInWords(grandTotal, currency);
  const paymentStatus =
    data.paymentSummary?.statusLabel ||
    (paidAmount >= grandTotal
      ? "PAID"
      : paidAmount > 0
        ? "PARTIAL"
        : "PENDING");
  const resolvedPaidAmount =
    data.paymentSummary?.paidAmount ?? (paymentStatus === "PAID" ? grandTotal : 0);
  const paymentMethod =
    data.payment?.mode ||
    data.payment?.label ||
    data.paymentSummary?.history?.[0]?.method ||
    paymentLines[0]?.replace(/^payment method\s*:\s*/i, "") ||
    "Cash";
  const customerDescription =
    customerLines.join(", ") ||
    data.client.email ||
    data.client.phone ||
    "Customer details not provided.";
  const invoiceTitle = data.invoiceTitle || "INVOICE";

  return (
    <section
      className="mx-auto w-full max-w-[794px] bg-white px-10 py-10 text-black print:max-w-none print:px-8 print:py-8"
      style={
        {
          fontFamily: theme.fontFamily,
          ["--simple-resume-accent" as string]: theme.primaryColor || "#111111",
        } as CSSProperties
      }
    >
      <div className="grid gap-7">
        {showHeader ? (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-10">
              <div className="space-y-2">
                <h1 className="text-[28px] font-black uppercase tracking-[-0.04em] text-black">
                  {data.business.businessName || "SHARMA KIRANA STORE"}
                </h1>
                <div className="space-y-1 text-[13px] leading-5 text-black/80">
                  {(businessLines.length ? businessLines : ["Main Road", "Ward 8"]).map(
                    (line) => (
                      <p key={line}>{line}</p>
                    ),
                  )}
                  <p>Phone: {data.business.phone || "-"}</p>
                </div>
              </div>

              <div className="justify-self-end text-right">
                <h2 className="text-[34px] font-black uppercase tracking-[-0.05em] text-black">
                  {invoiceTitle}
                </h2>
                <div className="mt-3 border-t-[3px] border-black pt-3 text-[13px] leading-7 text-black">
                  <p>
                    <span className="font-black">Invoice No:</span>{" "}
                    {data.invoiceNumber}
                  </p>
                  <p>
                    <span className="font-black">Date:</span> {data.invoiceDate}
                  </p>
                  <p>
                    <span className="font-black">Due Date:</span> {data.dueDate}
                  </p>
                  <p>
                    <span className="font-black">Status:</span> {paymentStatus}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t-[3px] border-black" />
          </>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_292px] gap-10">
          <div className="space-y-3">
            {showClient ? (
              <>
                <p className={sectionTitleClass}>Bill To</p>
                <div className="space-y-2">
                  <p className="text-[16px] font-black uppercase tracking-[-0.02em] text-black">
                    {data.client.name || "WALK-IN CUSTOMER"}
                  </p>
                  <p className="max-w-[420px] text-[13px] leading-6 text-black/80">
                    {customerDescription}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          {showPayment ? (
            <div className="space-y-4">
              <div className="bg-black px-4 py-4 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/80">
                  Amount Paid
                </p>
                <p className="mt-2 text-[28px] font-black tracking-[-0.05em] text-white">
                  {formatCurrency(resolvedPaidAmount, currency)}
                </p>
              </div>

              <div className="space-y-2 text-[13px] leading-6 text-black">
                <div className={summaryRowClass}>
                  <span className="font-black">Payment Status</span>
                  <span className="font-black">{paymentStatus}</span>
                </div>
                <div className={summaryRowClass}>
                  <span className="font-black">Pay By</span>
                  <span>{data.dueDate || "-"}</span>
                </div>
                <div className={summaryRowClass}>
                  <span className="font-black">Paid</span>
                  <span>{formatCurrency(resolvedPaidAmount, currency)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {showItems ? (
          <>
            <div className="border-t-[3px] border-black" />
            <div className="overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_120px_90px_140px] bg-black px-4 py-3 text-[12px] font-black uppercase tracking-[0.18em] text-white">
                <span>Item</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Tax</span>
                <span className="text-right">Amount</span>
              </div>

              {items.length ? (
                items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_90px_120px_90px_140px] border-b border-black/20 px-4 py-4 text-[13px] leading-6 text-black"
                  >
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-center">{item.quantity}</span>
                    <span className="text-right">
                      {formatCurrency(item.unitPrice, currency)}
                    </span>
                    <span className="text-right">{item.taxRate}%</span>
                    <span className="text-right font-semibold">
                      {formatCurrency(item.amount, currency)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="border-b border-black/20 px-4 py-6 text-[13px] text-black/70">
                  No items added
                </div>
              )}
            </div>
          </>
        ) : null}

        <div className="border-t-[3px] border-black" />

        <div className="grid grid-cols-[minmax(0,1fr)_304px] gap-12">
          <div className="space-y-7">
            <section className="space-y-2">
              <p className={sectionTitleClass}>Amount In Words</p>
              <p className="text-[14px] font-semibold leading-7 text-black">
                {amountInWords}
              </p>
            </section>

            {showPayment ? (
              <section className="space-y-2">
                <p className={sectionTitleClass}>Payment Details</p>
                <p className="text-[13px] font-semibold leading-6 text-black">
                  Payment method: {paymentMethod}
                </p>
              </section>
            ) : null}

            <section className="space-y-2">
              <p className={sectionTitleClass}>Terms & Conditions</p>
              <div className="space-y-1 text-[13px] leading-7 text-black/85">
                {termsLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </section>

            <section className="space-y-2">
              <p className={sectionTitleClass}>Declaration</p>
              <p className="max-w-[520px] text-[13px] leading-7 text-black/85">
                {declarationText}
              </p>
            </section>

            {showNotes ? (
              <section className="space-y-2">
                <p className={sectionTitleClass}>Notes</p>
                <div className="space-y-1 text-[13px] leading-7 text-black/85">
                  {(noteLines.length
                    ? noteLines
                    : ["Thank you for your business."]).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-2 self-start">
            <div className="space-y-2 border-b-[3px] border-black pb-3">
              <div className={summaryRowClass}>
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {showTax ? (
                <>
                  <div className={summaryRowClass}>
                    <span>CGST</span>
                    <span>{formatCurrency(cgst, currency)}</span>
                  </div>
                  <div className={summaryRowClass}>
                    <span>SGST</span>
                    <span>{formatCurrency(sgst, currency)}</span>
                  </div>
                  <div className={summaryRowClass}>
                    <span>Total GST</span>
                    <span>{formatCurrency(tax, currency)}</span>
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-3 border-b-[3px] border-black py-3">
              <div className="flex items-center justify-between gap-4 text-[14px] font-black uppercase tracking-[0.06em] text-black">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>

            <div className="space-y-3 border-b-[3px] border-black py-3">
              <div className="flex items-end justify-between gap-4">
                <span className="text-[14px] font-black uppercase tracking-[0.08em] text-black">
                  Amount Paid
                </span>
                <span className="text-[24px] font-black tracking-[-0.05em] text-black">
                  {formatCurrency(resolvedPaidAmount, currency)}
                </span>
              </div>
            </div>
          </aside>
        </div>

        {showFooter ? (
          <div className="flex justify-end pt-10">
            <div className="w-[220px] text-right">
              <div className="border-t-[3px] border-black" />
              <p className="mt-2 text-[12px] font-black uppercase tracking-[0.14em] text-black">
                {data.signatureLabel || "Authorized Signature"}
              </p>
              <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-black/80">
                {data.business.businessName || "For Sharma Kirana Store"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default TemplateSimpleResume;
