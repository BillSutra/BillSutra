"use client";

import type { InvoiceSectionRendererProps } from "@/components/invoice/InvoiceRenderer";
import { useBusinessLogo } from "@/hooks/useBusinessLogo";
import { calculateTotals, formatAmountInWords, formatCurrency } from "../sections/utils";

const roundAmount = (value: number) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

const compactTerms = (notes: string) => {
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 3) {
    return lines.slice(0, 3);
  }

  const normalized = notes.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return [
      "Payment is due by the due date mentioned on this invoice.",
      "Goods or services should be checked at the time of delivery.",
      "This is a computer-generated tax invoice.",
    ];
  }

  if (normalized.length <= 210) {
    return [normalized];
  }

  return [`${normalized.slice(0, 207).trim()}...`];
};

const resolveTaxSplit = (data: InvoiceSectionRendererProps["data"]) => {
  const fallbackTotals = calculateTotals(data.items);
  const totals = data.totals ?? fallbackTotals;
  const subtotal = roundAmount(totals.subtotal ?? fallbackTotals.subtotal);
  const tax = roundAmount(totals.tax ?? fallbackTotals.tax);
  const discount = roundAmount(totals.discount ?? 0);
  const total = roundAmount(totals.total ?? subtotal + tax - discount);
  const igst = roundAmount(data.totals?.igst ?? 0);
  const cgst = roundAmount(data.totals?.cgst ?? (igst > 0 ? 0 : tax / 2));
  const sgst = roundAmount(data.totals?.sgst ?? (igst > 0 ? 0 : tax / 2));

  return {
    subtotal,
    tax,
    discount,
    total,
    igst,
    cgst,
    sgst,
  };
};

const formatIdentityLine = (label: string, value?: string) => {
  if (!value?.trim()) return null;
  return `${label}: ${value.trim()}`;
};

const splitPaymentLines = (value?: string) => {
  if (!value?.trim()) return [];

  return value
    .split(/\r?\n|\|/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4);
};

const getPanFromTaxId = (taxId?: string) => {
  if (!taxId?.trim()) return null;

  const normalized = taxId.trim().toUpperCase();
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]{3}$/;

  if (!gstinPattern.test(normalized)) {
    return null;
  }

  return normalized.slice(2, 12);
};

const formatMetaLabel = (line: string) => {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex === -1) {
    return {
      label: "",
      value: line,
    };
  }

  return {
    label: line.slice(0, separatorIndex).trim(),
    value: line.slice(separatorIndex + 1).trim(),
  };
};

const sectionHeadingClass =
  "text-[9px] font-bold uppercase tracking-[0.18em] text-black";

const labelClass = "font-semibold text-black";

const TemplateIndianModern = ({
  data,
  enabledSections,
  theme,
}: InvoiceSectionRendererProps) => {
  const { logo: storedLogo } = useBusinessLogo();
  const effectiveLogo = data.business.logoUrl || storedLogo;
  const totals = resolveTaxSplit(data);
  const paidAmount = roundAmount(data.paymentSummary?.paidAmount ?? 0);
  const balanceDue = roundAmount(
    data.paymentSummary?.remainingAmount ?? totals.total - paidAmount,
  );
  const showHeader = enabledSections.includes("header");
  const showClient = enabledSections.includes("client_details");
  const showItems =
    enabledSections.includes("items") || enabledSections.includes("service_items");
  const showTax = enabledSections.includes("tax");
  const showDiscount = enabledSections.includes("discount") && totals.discount > 0;
  const showPayment = enabledSections.includes("payment_info");
  const showNotes = enabledSections.includes("notes");
  const showFooter = enabledSections.includes("footer");
  const terms = compactTerms(data.notes);
  const paymentLines = splitPaymentLines(data.paymentInfo);
  const derivedPan = getPanFromTaxId(
    data.business.showTaxNumber ? data.business.taxId : "",
  );
  const businessIdentity = [
    data.business.address?.trim(),
    formatIdentityLine("Phone", data.business.phone),
    data.business.email?.trim() ? `Email: ${data.business.email.trim()}` : null,
    data.business.website?.trim()
      ? `Website: ${data.business.website.trim()}`
      : null,
    formatIdentityLine(
      "GSTIN",
      data.business.showTaxNumber ? data.business.taxId : "",
    ),
    formatIdentityLine("PAN", derivedPan ?? ""),
  ].filter((line): line is string => Boolean(line));
  const clientIdentity = [
    data.client.address?.trim(),
    formatIdentityLine("Phone", data.client.phone),
    formatIdentityLine("Email", data.client.email),
  ].filter((line): line is string => Boolean(line));
  const statusText =
    data.paymentSummary?.statusLabel?.trim() ||
    (balanceDue <= 0 ? "Paid" : "Pending");
  const closingNote = data.closingNote?.trim() || "Thank you for your business.";

  return (
    <div
      className="invoice-content-root"
      style={{ fontFamily: theme.fontFamily }}
    >
      <section className="bg-white px-5 py-4 text-[10px] leading-[1.35] text-black print:px-4 print:py-3">
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-black">
          TEST TEMPLATE
        </p>
        {showHeader ? (
          <header className="border-b border-black pb-4">
            <div className="grid gap-4 sm:grid-cols-[1.18fr_0.82fr]">
              <div className="flex items-start gap-3">
                {data.business.showLogoOnInvoice && effectiveLogo ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <img
                      src={effectiveLogo}
                      alt={`${data.business.businessName} logo`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : null}

                <div className="min-w-0">
                  <h1 className="text-[25px] font-black uppercase leading-[1.02] tracking-[0.01em] text-black">
                    {data.business.businessName}
                  </h1>
                  <div className="mt-1 grid gap-0.5 text-[9px] text-black">
                    {businessIdentity.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-[28px] font-black uppercase leading-none tracking-[0.03em] text-black">
                  Invoice
                </p>
                <div className="mt-2 ml-auto grid max-w-[220px] gap-1 border-t border-black pt-2 text-[9.5px]">
                  <p>
                    <span className={labelClass}>Invoice No:</span> {data.invoiceNumber}
                  </p>
                  <p>
                    <span className={labelClass}>Date:</span> {data.invoiceDate}
                  </p>
                  <p>
                    <span className={labelClass}>Due Date:</span> {data.dueDate}
                  </p>
                  <p>
                    <span className={labelClass}>Status:</span> {statusText}
                  </p>
                </div>
              </div>
            </div>
          </header>
        ) : null}

        <section className="grid gap-4 border-b border-black py-4 sm:grid-cols-[1.12fr_0.88fr] sm:items-start">
          {showClient ? (
            <div>
              <p className={sectionHeadingClass}>Bill To</p>
              <p className="mt-1 text-[14px] font-bold uppercase leading-tight text-black">
                {data.client.name}
              </p>
              <div className="mt-1 grid gap-0.5 text-[9.5px] text-black">
                {clientIdentity.length ? (
                  clientIdentity.map((line) => <p key={line}>{line}</p>)
                ) : (
                  <p>Customer details not provided.</p>
                )}
              </div>
            </div>
          ) : (
            <div />
          )}

          <div className="sm:justify-self-end sm:w-full sm:max-w-[250px]">
            <div className="bg-black px-3 py-2.5 text-white">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.16em] text-white">
                Amount Due
              </p>
              <p className="mt-1 text-[29px] font-black leading-none tracking-tight text-white">
                {formatCurrency(
                  showPayment ? balanceDue : totals.total,
                  data.business.currency,
                )}
              </p>
            </div>
            <div className="mt-2 grid gap-1 text-[9.5px] text-black">
              <div className="flex items-center justify-between gap-3">
                <span className={labelClass}>Payment Status</span>
                <span className="font-bold uppercase">{statusText}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={labelClass}>Pay By</span>
                <span className="font-semibold">{data.dueDate}</span>
              </div>
              {showPayment ? (
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Paid</span>
                  <span>{formatCurrency(paidAmount, data.business.currency)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {showItems ? (
          <section className="py-3">
            <table className="min-w-full table-fixed border-collapse text-[9.5px] text-black">
              <thead>
                <tr className="bg-black text-white">
                  <th className="w-[40%] px-2 py-1.5 text-left font-bold uppercase tracking-[0.08em]">
                    Item
                  </th>
                  <th className="w-[10%] px-2 py-1.5 text-right font-bold uppercase tracking-[0.08em]">
                    Qty
                  </th>
                  <th className="w-[18%] px-2 py-1.5 text-right font-bold uppercase tracking-[0.08em]">
                    Rate
                  </th>
                  <th className="w-[12%] px-2 py-1.5 text-right font-bold uppercase tracking-[0.08em]">
                    Tax
                  </th>
                  <th className="w-[20%] px-2 py-1.5 text-right font-bold uppercase tracking-[0.08em]">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, index) => {
                  const lineSubtotal = roundAmount(item.quantity * item.unitPrice);
                  const lineTax = roundAmount(
                    lineSubtotal * ((item.taxRate ?? 0) / 100),
                  );
                  const lineTotal = roundAmount(lineSubtotal + lineTax);

                  return (
                    <tr key={`${item.name}-${index}`} className="align-top">
                      <td className="border-b border-[#D1D5DB] px-2 py-2">
                        <p className="font-semibold text-black">{item.name}</p>
                        {item.description?.trim() ? (
                          <p className="mt-0.5 text-[8.75px] leading-[1.25] text-black">
                            {item.description.trim()}
                          </p>
                        ) : null}
                      </td>
                      <td className="border-b border-[#D1D5DB] px-2 py-2 text-right">
                        {item.quantity}
                      </td>
                      <td className="border-b border-[#D1D5DB] px-2 py-2 text-right">
                        {formatCurrency(item.unitPrice, data.business.currency)}
                      </td>
                      <td className="border-b border-[#D1D5DB] px-2 py-2 text-right">
                        {item.taxRate ?? 0}%
                      </td>
                      <td className="border-b border-[#D1D5DB] px-2 py-2 text-right font-bold">
                        {formatCurrency(lineTotal, data.business.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}

        <section className="grid gap-6 border-t border-black pt-3 sm:grid-cols-[1.12fr_0.88fr]">
          <div className="grid gap-3">
            <div>
              <p className={sectionHeadingClass}>Amount in Words</p>
              <p className="mt-1 text-[9.75px] font-semibold leading-5 text-black">
                {formatAmountInWords(
                  showPayment ? balanceDue : totals.total,
                  data.business.currency,
                )}
              </p>
            </div>

            {showPayment && paymentLines.length ? (
              <div>
                <p className={sectionHeadingClass}>Payment Details</p>
                <div className="mt-1 grid gap-1 text-[9px] text-black">
                  {paymentLines.map((line) => {
                    const paymentLine = formatMetaLabel(line);

                    return (
                      <p key={line}>
                        {paymentLine.label ? (
                          <>
                            <span className={labelClass}>{paymentLine.label}:</span>{" "}
                            <span>{paymentLine.value}</span>
                          </>
                        ) : (
                          paymentLine.value
                        )}
                      </p>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {showNotes ? (
              <div>
                <p className={sectionHeadingClass}>Terms &amp; Conditions</p>
                <div className="mt-1 grid gap-1 text-[8.85px] leading-4 text-black">
                  {terms.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className={sectionHeadingClass}>Declaration</p>
              <p className="mt-1 text-[8.85px] leading-4 text-black">
                We declare that this invoice shows the actual price of the goods
                or services described and that all particulars are true and correct.
              </p>
            </div>
          </div>

          <div className="sm:ml-auto sm:w-full sm:max-w-[260px]">
            <div className="grid gap-1 text-[9.5px] text-black">
              <div className="flex items-center justify-between gap-3">
                <span className={labelClass}>Subtotal</span>
                <span>{formatCurrency(totals.subtotal, data.business.currency)}</span>
              </div>
              {showDiscount ? (
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Discount</span>
                  <span>
                    -{formatCurrency(totals.discount, data.business.currency)}
                  </span>
                </div>
              ) : null}
              {showTax && totals.igst > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>IGST</span>
                  <span>{formatCurrency(totals.igst, data.business.currency)}</span>
                </div>
              ) : null}
              {showTax && totals.igst === 0 ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>CGST</span>
                    <span>{formatCurrency(totals.cgst, data.business.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={labelClass}>SGST</span>
                    <span>{formatCurrency(totals.sgst, data.business.currency)}</span>
                  </div>
                </>
              ) : null}
              {showTax ? (
                <div className="flex items-center justify-between gap-3">
                  <span className={labelClass}>Total GST</span>
                  <span>{formatCurrency(totals.tax, data.business.currency)}</span>
                </div>
              ) : null}
              <div className="border-t border-black pt-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold uppercase tracking-[0.08em] text-black">
                    Grand Total
                  </span>
                  <span className="text-[11px] font-bold text-black">
                    {formatCurrency(totals.total, data.business.currency)}
                  </span>
                </div>
              </div>
              <div className="border-t-2 border-black border-b-2 border-black py-2">
                <div className="flex items-end justify-between gap-3">
                  <span className="font-bold uppercase tracking-[0.08em] text-black">
                    Amount Due
                  </span>
                  <span className="text-[24px] font-black leading-none tracking-tight text-black">
                    {formatCurrency(
                      showPayment ? balanceDue : totals.total,
                      data.business.currency,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {showFooter ? (
          <footer className="grid gap-4 pt-5 sm:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-black">
                Notes
              </p>
              <p className="text-[8.85px] leading-4 text-black">{closingNote}</p>
            </div>

            <div className="justify-self-end text-right">
              <div className="h-10" />
              <p className="border-t border-black pt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-black">
                {data.signatureLabel ?? "Authorized Signatory"}
              </p>
              <p className="mt-1 text-[8px] uppercase tracking-[0.08em] text-black">
                For {data.business.businessName}
              </p>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
};

export default TemplateIndianModern;
