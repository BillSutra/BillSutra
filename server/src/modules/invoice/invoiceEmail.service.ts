import prisma from "../../config/db.config.js";
import { sendEmail } from "../../emails/index.js";
import type { InvoiceEmailPreviewPayload } from "../../emails/types.js";
import { buildPublicInvoiceUrl } from "../../lib/appUrls.js";
import { emitDashboardUpdate } from "../../services/dashboardRealtime.js";
import { createPdfAttachment } from "../../services/mailService.js";
import {
  generateInvoicePdf,
  getInvoice,
  markInvoiceAsSent,
} from "./invoice.service.js";
import { renderInvoicePreviewPdfBuffer } from "./invoicePreviewPdf.service.js";

const getLatestPayment = (
  payments: Array<{
    paid_at: Date;
    method: string | null;
  }>,
) =>
  payments.reduce<(typeof payments)[number] | null>((latest, payment) => {
    if (!latest) {
      return payment;
    }

    return new Date(payment.paid_at).getTime() >
      new Date(latest.paid_at).getTime()
      ? payment
      : latest;
  }, null);

const resolveInvoiceEmailPaymentStatus = ({
  status,
  total,
  paidAmount,
}: {
  status: string;
  total: number;
  paidAmount: number;
}) => {
  if (paidAmount >= total && total > 0) {
    return "PAID";
  }

  if (paidAmount > 0) {
    return "PARTIALLY_PAID";
  }

  if (status === "VOID") {
    return "FAILED";
  }

  return "PENDING";
};

export const resolveInvoiceEmailRecipient = async (
  userId: number,
  invoiceId: number,
  requestedEmail?: string | null,
) => {
  const invoiceDetails = await getInvoice(userId, invoiceId);
  if (!invoiceDetails) {
    const error = new Error("Invoice not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const recipientEmail =
    requestedEmail?.trim() || invoiceDetails.customer?.email?.trim() || "";
  if (!recipientEmail) {
    const error = new Error(
      "Customer email is required to send this invoice",
    ) as Error & {
      status?: number;
      errors?: Record<string, string[]>;
    };
    error.status = 422;
    error.errors = { email: ["Customer email is required"] };
    throw error;
  }

  return {
    invoiceDetails,
    recipientEmail,
  };
};

export const deliverInvoiceEmail = async ({
  userId,
  invoiceId,
  requestedEmail,
  previewPayload,
}: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
  previewPayload?: InvoiceEmailPreviewPayload | null;
}) => {
  const { invoiceDetails, recipientEmail } = await resolveInvoiceEmailRecipient(
    userId,
    invoiceId,
    requestedEmail,
  );
  const latestPayment = getLatestPayment(invoiceDetails.payments);
  const paidAmount = invoiceDetails.payments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0,
  );
  const businessProfile = await prisma.businessProfile.findUnique({
    where: { user_id: userId },
    select: {
      business_name: true,
      email: true,
      phone: true,
      currency: true,
    },
  });
  const pdfBuffer = previewPayload
    ? await renderInvoicePreviewPdfBuffer(previewPayload)
    : (await generateInvoicePdf(userId, invoiceId)).buffer;

  await sendEmail(
    "invoice_sent",
    {
      email: recipientEmail,
      customer_name: invoiceDetails.customer?.name ?? "Customer",
      customer_email: invoiceDetails.customer?.email ?? recipientEmail,
      customer_phone: invoiceDetails.customer?.phone ?? null,
      invoice_id: invoiceDetails.invoice_number,
      amount: Number(invoiceDetails.total ?? 0),
      subtotal: Number(invoiceDetails.subtotal ?? 0),
      tax: Number(invoiceDetails.tax ?? 0),
      tax_mode:
        typeof invoiceDetails.tax_mode === "string"
          ? invoiceDetails.tax_mode
          : null,
      discount: Number(invoiceDetails.discount ?? 0),
      discount_type:
        invoiceDetails.discount_type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
      discount_value: Number(invoiceDetails.discount_value ?? 0),
      total_cgst: Number(invoiceDetails.total_cgst ?? 0),
      total_sgst: Number(invoiceDetails.total_sgst ?? 0),
      total_igst: Number(invoiceDetails.total_igst ?? 0),
      date: invoiceDetails.date,
      due_date: invoiceDetails.due_date,
      business_name: businessProfile?.business_name ?? "BillSutra",
      business_email: businessProfile?.email ?? null,
      business_phone: businessProfile?.phone ?? null,
      payment_status: resolveInvoiceEmailPaymentStatus({
        status: invoiceDetails.status,
        total: Number(invoiceDetails.total ?? 0),
        paidAmount,
      }),
      payment_method: latestPayment?.method ?? null,
      notes: invoiceDetails.notes ?? null,
      invoice_url: buildPublicInvoiceUrl(
        invoiceDetails.id,
        invoiceDetails.invoice_number,
      ),
      currency: businessProfile?.currency ?? "INR",
      preview_payload: previewPayload ?? undefined,
      items: invoiceDetails.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.price ?? 0),
        line_subtotal: Number(
          item.base_amount ?? item.quantity * Number(item.price ?? 0),
        ),
        discount: null,
        tax_rate: item.tax_rate == null ? null : Number(item.tax_rate),
        gst_type: typeof item.gst_type === "string" ? item.gst_type : null,
        gst_amount: Number(item.gst_amount ?? 0),
        cgst_amount: Number(item.cgst_amount ?? 0),
        sgst_amount: Number(item.sgst_amount ?? 0),
        igst_amount: Number(item.igst_amount ?? 0),
        line_total: Number(item.total ?? 0),
      })),
    },
    {
      attachments: [
        createPdfAttachment(
          `${invoiceDetails.invoice_number}.pdf`,
          pdfBuffer,
        ),
      ],
    },
  );

  const invoice = await markInvoiceAsSent(userId, invoiceId);
  emitDashboardUpdate({ userId, source: "invoice.sent" });

  return {
    invoiceId: invoice.id,
    status: invoice.status,
    email: recipientEmail,
    invoiceNumber: invoiceDetails.invoice_number,
  };
};

export const deliverInvoiceReminderEmail = async ({
  userId,
  invoiceId,
  requestedEmail,
}: {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
}) => {
  const invoice = await getInvoice(userId, invoiceId);
  if (!invoice) {
    const error = new Error("Invoice not found") as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const recipientEmail =
    requestedEmail?.trim() || invoice.customer?.email?.trim() || "";
  if (!recipientEmail) {
    const error = new Error(
      "Customer email is required to send this reminder",
    ) as Error & {
      status?: number;
      errors?: Record<string, string[]>;
    };
    error.status = 422;
    error.errors = { email: ["Customer email is required"] };
    throw error;
  }

  const businessProfile = await prisma.businessProfile.findUnique({
    where: { user_id: userId },
    select: {
      business_name: true,
      currency: true,
    },
  });

  await sendEmail("invoice_reminder", {
    email: recipientEmail,
    customer_name: invoice.customer?.name ?? "Customer",
    invoice_id: invoice.invoice_number,
    amount: Number(invoice.total ?? 0),
    due_date: invoice.due_date,
    business_name: businessProfile?.business_name ?? "BillSutra",
    invoice_url: buildPublicInvoiceUrl(invoice.id, invoice.invoice_number),
    currency: businessProfile?.currency ?? "INR",
  });

  return {
    invoiceId: invoice.id,
    email: recipientEmail,
    invoiceNumber: invoice.invoice_number,
  };
};
