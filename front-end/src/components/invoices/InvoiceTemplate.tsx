import React, { useState, useEffect } from "react";
import type {
  InvoiceTemplateItem,
  InvoiceTemplateTotals,
  TaxMode,
} from "@/types/invoice";
import { getBusinessLogo } from "@/lib/businessLogo";

export type InvoiceTemplateProps = {
  logoUrl?: string;
  businessName: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  items: InvoiceTemplateItem[];
  totals: InvoiceTemplateTotals;
  gstMode: TaxMode;
};

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

const InvoiceTemplate = ({
  logoUrl,
  businessName,
  invoiceNumber,
  invoiceDate,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  items,
  totals,
  gstMode,
}: InvoiceTemplateProps) => {
  // Defer localStorage read to useEffect to avoid SSR/client hydration mismatch
  const [storedLogo, setStoredLogo] = useState<string | null>(null);
  useEffect(() => { setStoredLogo(getBusinessLogo()); }, []);
  const effectiveLogo = logoUrl || storedLogo;

  return (
    <div className="invoice-sheet rounded-3xl border border-[#e8d9cc] bg-white p-8 text-[#1f1b16] shadow-[0_24px_60px_-40px_rgba(92,75,59,0.6)]">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[#f0e2d6] pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#f2e6dc] bg-[#fff7ef] text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d56]">
            {effectiveLogo ? (
              <img
                src={effectiveLogo}
                alt={`${businessName} logo`}
                className="h-12 w-12 object-contain"
              />
            ) : (
              "Logo"
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8a6d56]">
              Invoice
            </p>
            <h2 className="mt-2 text-3xl tracking-tight font-[var(--font-fraunces),serif]">
              {businessName}
            </h2>
          </div>
        </div>
        <div className="rounded-2xl border border-[#f0e2d6] bg-[#fff7ef] p-4 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            Invoice No.
          </p>
          <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
            {invoiceNumber}
          </p>
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            Invoice Date
          </p>
          <p className="mt-2 text-sm font-semibold">{invoiceDate}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 rounded-2xl border border-[#f0e2d6] bg-muted/40 p-5 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#8a6d56]">
            Bill To
          </p>
          <p className="mt-2 text-base font-semibold text-[#1f1b16]">
            {customerName}
          </p>
          {customerEmail && (
            <p className="text-sm text-[#5c4b3b]">{customerEmail}</p>
          )}
          {customerPhone && (
            <p className="text-sm text-[#5c4b3b]">{customerPhone}</p>
          )}
          {customerAddress && (
            <p className="text-sm text-[#5c4b3b]">{customerAddress}</p>
          )}
        </div>
        <div className="rounded-xl border border-[#f0e2d6] bg-white p-4 text-sm text-[#5c4b3b]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            Summary
          </p>
          <p className="mt-3 text-base font-semibold text-[#1f1b16]">
            {formatCurrency(totals.total)}
          </p>
          <p className="mt-2">Items: {items.length}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[#f0e2d6]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[#f9f2ea] text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            <tr>
              <th className="border-b border-[#f0e2d6] px-4 py-3 text-center font-semibold">
                Item
              </th>
              <th className="border-b border-[#f0e2d6] px-4 py-3 text-center font-semibold">
                Qty
              </th>
              <th className="border-b border-[#f0e2d6] px-4 py-3 text-center font-semibold">
                Price
              </th>
              <th className="border-b border-[#f0e2d6] px-4 py-3 text-center font-semibold">
                GST %
              </th>
              <th className="border-b border-[#f0e2d6] px-4 py-3 text-center font-semibold">
                Line Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr
                key={`${item.name}-${index}`}
                className="odd:bg-white even:bg-muted/40"
              >
                <td className="border-b border-[#f0e2d6] px-4 py-3 text-center">
                  <p className="font-semibold">{item.name}</p>
                </td>
                <td className="border-b border-[#f0e2d6] px-4 py-3 text-center">
                  {item.quantity}
                </td>
                <td className="border-b border-[#f0e2d6] px-4 py-3 text-center">
                  {formatCurrency(item.price)}
                </td>
                <td className="border-b border-[#f0e2d6] px-4 py-3 text-center">
                  {item.tax_rate ?? 0}%
                </td>
                <td className="border-b border-[#f0e2d6] px-4 py-3 text-center">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_0.7fr]">
        <div className="rounded-2xl border border-[#f0e2d6] bg-[#fff7ef] p-4 text-sm text-[#5c4b3b]">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
            GST breakdown
          </p>
          {gstMode === "NONE" && <p className="mt-2">GST not applied.</p>}
          {gstMode === "IGST" && (
            <div className="mt-2 flex items-center justify-between">
              <span>IGST</span>
              <span>{formatCurrency(totals.igst ?? 0)}</span>
            </div>
          )}
          {gstMode === "CGST_SGST" && (
            <div className="mt-2 grid gap-2">
              <div className="flex items-center justify-between">
                <span>CGST</span>
                <span>{formatCurrency(totals.cgst ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>SGST</span>
                <span>{formatCurrency(totals.sgst ?? 0)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#f0e2d6] bg-white p-4">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#8a6d56]">Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            {gstMode !== "NONE" && (
              <div className="flex items-center justify-between">
                <span className="text-[#8a6d56]">GST</span>
                <span>{formatCurrency(totals.tax)}</span>
              </div>
            )}
            {totals.discount ? (
              <div className="flex items-center justify-between">
                <span className="text-[#8a6d56]">Discount</span>
                <span>-{formatCurrency(totals.discount)}</span>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#fff7ef] px-3 py-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTemplate;

