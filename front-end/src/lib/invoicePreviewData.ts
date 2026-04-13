import type { InvoicePreviewData } from "@/types/invoice-template";

export const PREVIEW_INVOICE: InvoicePreviewData = {
  invoiceNumber: "BS-2408",
  invoiceDate: "Mar 08, 2026",
  dueDate: "Mar 22, 2026",
  business: {
    businessName: "BillSutra Studio",
    address: "208, Riverwalk Avenue, Pune, Maharashtra - 411001",
    businessAddress: {
      addressLine1: "208, Riverwalk Avenue",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    },
    phone: "+91 98765 43210",
    email: "hello@billsutra.app",
    website: "www.billsutra.app",
    logoUrl: "",
    taxId: "27AAEPM4567G1Z9",
    currency: "INR",
    showLogoOnInvoice: true,
    showTaxNumber: true,
    showPaymentQr: false,
  },
  client: {
    name: "Kalpana Textiles",
    email: "accounts@kalpana.com",
    phone: "+91 99887 12210",
    address: "7, MG Road, Mumbai",
  },
  items: [
    {
      name: "Inventory subscription",
      description: "Monthly plan",
      quantity: 1,
      unitPrice: 1200,
      taxRate: 18,
    },
    {
      name: "Custom onboarding",
      description: "One-time setup",
      quantity: 1,
      unitPrice: 3500,
      taxRate: 18,
    },
  ],
  notes: "Thanks for choosing BillSutra. Payment due within 14 days.",
  paymentInfo: "UPI: billsutra@upi | Bank: HDFC 0021",
};
