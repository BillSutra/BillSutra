"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Copy, Download, ExternalLink } from "lucide-react";
import A4PreviewStack from "@/components/invoice/A4PreviewStack";
import {
  DesignConfigProvider,
  normalizeDesignConfig,
} from "@/components/invoice/DesignConfigContext";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Env from "@/lib/env";
import {
  buildPublicInvoicePreviewData,
  DEFAULT_INVOICE_SECTIONS,
  DEFAULT_INVOICE_TEMPLATE_ID,
  DEFAULT_INVOICE_TEMPLATE_NAME,
  DEFAULT_INVOICE_THEME,
  type PublicInvoice,
} from "@/lib/publicInvoice";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const statusMap: Record<PublicInvoice["paymentStatus"], string> = {
  PAID: "border-green-200 bg-green-100 text-green-700",
  PENDING: "border-yellow-200 bg-yellow-100 text-yellow-700",
  FAILED: "border-red-200 bg-red-100 text-red-700",
  PARTIALLY_PAID: "border-blue-200 bg-blue-100 text-blue-700",
};

type PublicInvoicePageClientProps = {
  invoice: PublicInvoice;
};

const PublicInvoicePageClient = ({
  invoice,
}: PublicInvoicePageClientProps) => {
  const designConfig = useMemo(() => normalizeDesignConfig(null), []);
  const previewData = useMemo(
    () => buildPublicInvoicePreviewData(invoice),
    [invoice],
  );
  const pdfDownloadUrl = useMemo(
    () =>
      `${Env.BACKEND_URL.replace(/\/$/, "")}/api/public/invoice/${encodeURIComponent(
        invoice.public_id,
      )}/pdf`,
    [invoice.public_id],
  );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // Ignore clipboard failures on restricted browsers.
    }
  };

  const handleDownloadPdf = () => {
    window.open(pdfDownloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_50%,#ffffff_100%)] px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
                Shared invoice
              </p>
              <h1 className="mt-3 font-[var(--font-fraunces)] text-4xl leading-tight text-slate-950">
                {invoice.invoice_id}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Review the invoice from {invoice.business_name} and use the business
                contact details shown below if you need payment or billing support.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <Badge
                  className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${statusMap[invoice.paymentStatus]}`}
                >
                  {invoice.paymentStatus.replaceAll("_", " ")}
                </Badge>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Total {formatCurrency(invoice.amount, invoice.currency)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={handleCopyLink}
              >
                <Copy className="h-4 w-4" />
                Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={handleDownloadPdf}
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
              <Button asChild className="h-11 rounded-xl">
                <Link href="/" target="_blank" rel="noreferrer">
                  Open BillSutra
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 border-t border-slate-200 bg-slate-50/80 px-6 py-5 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Customer
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {invoice.customer_name}
              </p>
              {invoice.email ? (
                <p className="mt-1 text-sm text-slate-600">{invoice.email}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Business contact
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {invoice.business_name}
              </p>
              {invoice.business_email ? (
                <p className="mt-1 text-sm text-slate-600">
                  {invoice.business_email}
                </p>
              ) : null}
              {invoice.business_phone ? (
                <p className="mt-1 text-sm text-slate-600">
                  {invoice.business_phone}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Public reference
              </p>
              <p className="mt-2 break-all text-sm font-medium text-slate-700">
                {invoice.public_id}
              </p>
            </div>
          </div>
        </section>

        <section
          id="invoice"
          className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.4)]"
        >
          <DesignConfigProvider
            value={{
              designConfig,
              updateSection: () => {},
              resetSection: () => {},
              resetAll: () => {},
            }}
          >
            <A4PreviewStack stackKey={`public-invoice-${invoice.public_id}`}>
              <InvoiceTemplate
                templateId={DEFAULT_INVOICE_TEMPLATE_ID}
                templateName={DEFAULT_INVOICE_TEMPLATE_NAME}
                data={previewData}
                enabledSections={[...DEFAULT_INVOICE_SECTIONS]}
                sectionOrder={[...DEFAULT_INVOICE_SECTIONS]}
                theme={DEFAULT_INVOICE_THEME}
              />
            </A4PreviewStack>
          </DesignConfigProvider>
        </section>
      </div>
    </main>
  );
};

export default PublicInvoicePageClient;
