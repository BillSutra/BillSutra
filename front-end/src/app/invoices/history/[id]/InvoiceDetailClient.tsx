"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DashNavbar from "@/components/dashboard/DashNav";
import { Button } from "@/components/ui/button";
import InvoiceTemplate from "@/components/invoice/InvoiceTemplate";
import { useInvoiceQuery } from "@/hooks/useInventoryQueries";

const formatCurrency = (value: number) => `₹${value.toFixed(2)}`;

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-IN");
};

type InvoiceDetailClientProps = {
  name: string;
  image?: string;
};

const InvoiceDetailClient = ({ name, image }: InvoiceDetailClientProps) => {
  const params = useParams();
  const id = Number(params?.id);
  const { data, isLoading, isError } = useInvoiceQuery(id);

  const totals = useMemo(() => {
    if (!data) {
      return {
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        cgst: 0,
        sgst: 0,
      };
    }
    const subtotal = Number(data.subtotal ?? 0);
    const tax = Number(data.tax ?? 0);
    const discount = Number(data.discount ?? 0);
    const total = Number(data.total ?? 0);
    const halfTax = tax / 2;
    return {
      subtotal,
      tax,
      discount,
      total,
      cgst: halfTax,
      sgst: halfTax,
    };
  }, [data]);

  const templateItems = useMemo(() => {
    if (!data) return [];
    return data.items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      price: Number(item.price),
      tax_rate: item.tax_rate ? Number(item.tax_rate) : 0,
      total: Number(item.total),
    }));
  }, [data]);

  const gstMode = totals.tax > 0 ? "CGST_SGST" : "NONE";

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!data) return;
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const startX = 14;
    let cursorY = 18;
    const accent: [number, number, number] = [138, 109, 86];
    const text: [number, number, number] = [31, 27, 22];
    const soft: [number, number, number] = [249, 242, 234];
    const softAlt: [number, number, number] = [255, 250, 245];

    pdf.setFontSize(16);
    pdf.setTextColor(...text);
    pdf.text("BillSutra", startX, cursorY);
    pdf.setFontSize(10);
    pdf.setTextColor(...accent);
    pdf.text(`Invoice No: ${data.invoice_number}`, startX, cursorY + 8);
    pdf.text(`Invoice Date: ${formatDate(data.date)}`, startX, cursorY + 15);

    cursorY += 26;
    pdf.setFontSize(11);
    pdf.setTextColor(...accent);
    pdf.text("Bill To", startX, cursorY);
    pdf.setFontSize(10);
    pdf.setTextColor(...text);
    pdf.text(data.customer?.name ?? "Customer", startX, cursorY + 6);
    if (data.customer?.email)
      pdf.text(data.customer.email, startX, cursorY + 12);
    if (data.customer?.phone)
      pdf.text(data.customer.phone, startX, cursorY + 18);
    if (data.customer?.address)
      pdf.text(data.customer.address, startX, cursorY + 24);

    const tableStart = cursorY + 30;
    autoTable(pdf, {
      startY: tableStart,
      head: [["Item", "Qty", "Price", "GST %", "Line Total"]],
      body: templateItems.map((item) => [
        item.name,
        String(item.quantity),
        formatCurrency(item.price),
        String(item.tax_rate ?? 0),
        formatCurrency(item.total),
      ]),
      styles: { fontSize: 9, textColor: text, cellPadding: 3 },
      headStyles: { fillColor: soft, textColor: accent, fontStyle: "bold" },
      alternateRowStyles: { fillColor: softAlt },
      tableLineColor: [231, 220, 208],
      columnStyles: {
        1: { halign: "right" },
        2: { halign: "right" },
        3: { halign: "right" },
        4: { halign: "right" },
      },
    });

    const afterTable = (pdf as jsPDF & { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY;
    const totalsY = (afterTable ?? tableStart) + 8;
    const labelX = 130;
    const valueX = 190;

    pdf.setFontSize(10);
    pdf.setTextColor(...accent);
    pdf.text("Subtotal", labelX, totalsY, { align: "left" });
    pdf.setTextColor(...text);
    pdf.text(formatCurrency(totals.subtotal), valueX, totalsY, {
      align: "right",
    });

    let offset = 6;
    if (totals.tax > 0) {
      pdf.setTextColor(...accent);
      pdf.text("GST", labelX, totalsY + offset, { align: "left" });
      pdf.setTextColor(...text);
      pdf.text(formatCurrency(totals.tax), valueX, totalsY + offset, {
        align: "right",
      });
      offset += 6;
    }

    if (totals.discount > 0) {
      pdf.setTextColor(...accent);
      pdf.text("Discount", labelX, totalsY + offset, { align: "left" });
      pdf.setTextColor(...text);
      pdf.text(
        `-${formatCurrency(totals.discount)}`,
        valueX,
        totalsY + offset,
        {
          align: "right",
        },
      );
      offset += 6;
    }

    const totalY = totalsY + offset + 2;
    pdf.setDrawColor(231, 220, 208);
    pdf.setFillColor(...softAlt);
    pdf.roundedRect(labelX - 6, totalY - 5, 66, 10, 2, 2, "F");
    pdf.setFontSize(11);
    pdf.setTextColor(...text);
    pdf.text("Total", labelX, totalY, { align: "left" });
    pdf.text(formatCurrency(totals.total), valueX, totalY, { align: "right" });

    pdf.save(`${data.invoice_number}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1b16]">
      <div className="no-print">
        <DashNavbar name={name} image={image} />
      </div>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
              Invoices
            </p>
            <h1 className="text-3xl font-black">Invoice preview</h1>
            <p className="max-w-2xl text-base text-[#5c4b3b]">
              Review and print your invoice, or download a PDF copy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/invoices/history">Back to history</Link>
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint}>
              Print
            </Button>
            <Button type="button" onClick={handleDownloadPdf}>
              Download PDF
            </Button>
          </div>
        </div>

        <section className="mt-6">
          {isLoading && (
            <p className="text-sm text-[#8a6d56]">Loading invoice...</p>
          )}
          {isError && (
            <p className="text-sm text-[#b45309]">Failed to load invoice.</p>
          )}
          {!isLoading && !isError && data && (
            <div className="printable">
              <InvoiceTemplate
                logoUrl={undefined}
                businessName="BillSutra"
                invoiceNumber={data.invoice_number}
                invoiceDate={formatDate(data.date)}
                customerName={data.customer?.name ?? "Customer"}
                customerEmail={data.customer?.email ?? null}
                customerPhone={data.customer?.phone ?? null}
                customerAddress={data.customer?.address ?? null}
                items={templateItems}
                totals={totals}
                gstMode={gstMode}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default InvoiceDetailClient;
