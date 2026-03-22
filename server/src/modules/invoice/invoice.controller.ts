import type { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";
import type { z } from "zod";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
} from "../../validations/apiValidations.js";
import {
  createInvoice,
  duplicateInvoice,
  deleteInvoice,
  generateInvoicePdf,
  getInvoice,
  listInvoices,
  markInvoiceAsSent,
  updateInvoice,
} from "./invoice.service.js";
import { emitDashboardUpdate } from "../../services/dashboardRealtime.js";
import { sendEmail } from "../../emails/index.js";
import { buildPublicInvoiceUrl } from "../../lib/appUrls.js";

type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;

const readQueryValue = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return undefined;
};

const parseInvoiceStatus = (value?: string): InvoiceStatus | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (Object.values(InvoiceStatus).includes(normalized as InvoiceStatus)) {
    return normalized as InvoiceStatus;
  }

  return undefined;
};

const parseDateFilter = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export const index = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const statusRaw = readQueryValue(req.query.status);
  const clientIdRaw = readQueryValue(req.query.clientId);
  const fromRaw = readQueryValue(req.query.from);
  const toRaw = readQueryValue(req.query.to);

  const status = parseInvoiceStatus(statusRaw);
  if (statusRaw && !status) {
    return res.status(422).json({
      message: "Invalid status filter",
      errors: { status: ["Invalid invoice status"] },
    });
  }

  let clientId: number | undefined;
  if (clientIdRaw !== undefined) {
    const parsedClientId = Number(clientIdRaw);
    if (!Number.isInteger(parsedClientId) || parsedClientId <= 0) {
      return res.status(422).json({
        message: "Invalid clientId filter",
        errors: { clientId: ["clientId must be a positive integer"] },
      });
    }
    clientId = parsedClientId;
  }

  const from = parseDateFilter(fromRaw);
  if (fromRaw && from === null) {
    return res.status(422).json({
      message: "Invalid from date filter",
      errors: { from: ["from must be a valid date"] },
    });
  }

  const to = parseDateFilter(toRaw);
  if (toRaw && to === null) {
    return res.status(422).json({
      message: "Invalid to date filter",
      errors: { to: ["to must be a valid date"] },
    });
  }

  if (from && to && from > to) {
    return res.status(422).json({
      message: "Invalid date range",
      errors: { range: ["from must be less than or equal to to"] },
    });
  }

  const invoices = await listInvoices(userId, {
    status,
    clientId,
    from: from ?? undefined,
    to: to ?? undefined,
  });
  return res.status(200).json({ data: invoices });
};

export const store = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const body = req.body as InvoiceCreateInput;
    const invoice = await createInvoice(userId, body);
    emitDashboardUpdate({ userId, source: "invoice.create" });

    return res.status(201).json({
      message: "Invoice created",
      data: invoice,
    });
  } catch (error) {
    const err = error as Error & {
      status?: number;
      errors?: Record<string, unknown>;
    };
    if (err.status) {
      return res.status(err.status).json({
        message: err.message,
        errors: err.errors,
      });
    }
    return res.status(500).json({ message: "Unable to create invoice" });
  }
};

export const show = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = Number(req.params.id);
  const invoice = await getInvoice(userId, id);
  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  return res.status(200).json({ data: invoice });
};

export const update = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = Number(req.params.id);
  const body = req.body as InvoiceUpdateInput;
  const updated = await updateInvoice(userId, id, {
    status: body.status,
    due_date: body.due_date ?? undefined,
    notes: body.notes,
  });

  if (!updated.count) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  emitDashboardUpdate({ userId, source: "invoice.update" });
  return res.status(200).json({ message: "Invoice updated" });
};

export const destroy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = Number(req.params.id);
  const deleted = await deleteInvoice(userId, id);
  if (!deleted.count) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  emitDashboardUpdate({ userId, source: "invoice.delete" });
  return res.status(200).json({ message: "Invoice removed" });
};

export const duplicate = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const id = Number(req.params.id);
    const invoice = await duplicateInvoice(userId, id);
    emitDashboardUpdate({ userId, source: "invoice.duplicate" });

    return res.status(201).json({
      message: "Invoice duplicated",
      data: invoice,
    });
  } catch (error) {
    const err = error as Error & {
      status?: number;
      errors?: Record<string, unknown>;
    };

    if (err.status) {
      return res.status(err.status).json({
        message: err.message,
        errors: err.errors,
      });
    }

    return res.status(500).json({ message: "Unable to duplicate invoice" });
  }
};

export const pdf = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const id = Number(req.params.id);
    const result = await generateInvoicePdf(userId, id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.invoiceNumber}.pdf"`,
    );

    return res.status(200).send(result.buffer);
  } catch (error) {
    const err = error as Error & {
      status?: number;
      errors?: Record<string, unknown>;
    };

    if (err.status) {
      return res.status(err.status).json({
        message: err.message,
        errors: err.errors,
      });
    }

    return res.status(500).json({ message: "Unable to generate invoice PDF" });
  }
};

export const send = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const id = Number(req.params.id);
    const requestedEmail =
      typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const invoiceDetails = await getInvoice(userId, id);
    if (!invoiceDetails) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const recipientEmail =
      requestedEmail || invoiceDetails.customer?.email?.trim() || "";
    if (!recipientEmail) {
      return res.status(422).json({
        message: "Customer email is required to send this invoice",
        errors: { email: ["Customer email is required"] },
      });
    }

    const businessProfile = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
      select: {
        business_name: true,
        email: true,
        phone: true,
        currency: true,
      },
    });

    await sendEmail("invoice_sent", {
      email: recipientEmail,
      customer_name: invoiceDetails.customer?.name ?? "Customer",
      invoice_id: invoiceDetails.invoice_number,
      amount: Number(invoiceDetails.total ?? 0),
      date: invoiceDetails.date,
      due_date: invoiceDetails.due_date,
      business_name: businessProfile?.business_name ?? "BillSutra",
      business_email: businessProfile?.email ?? null,
      business_phone: businessProfile?.phone ?? null,
      notes: invoiceDetails.notes ?? null,
      invoice_url: buildPublicInvoiceUrl(
        invoiceDetails.id,
        invoiceDetails.invoice_number,
      ),
      currency: businessProfile?.currency ?? "INR",
      items: invoiceDetails.items.map((item) => ({
        name: item.name,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.price ?? 0),
        line_total: Number(item.total ?? 0),
      })),
    });

    const invoice = await markInvoiceAsSent(userId, id);
    emitDashboardUpdate({ userId, source: "invoice.sent" });

    return res.status(200).json({
      message: `Invoice email sent to ${recipientEmail}`,
      data: { invoiceId: invoice.id, status: invoice.status, email: recipientEmail },
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }

    return res
      .status(500)
      .json({ message: "Unable to send invoice notification" });
  }
};

export const reminder = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const id = Number(req.params.id);
    const requestedEmail =
      typeof req.body?.email === "string" ? req.body.email.trim() : "";
    const invoice = await getInvoice(userId, id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const recipientEmail = requestedEmail || invoice.customer?.email?.trim() || "";
    if (!recipientEmail) {
      return res.status(422).json({
        message: "Customer email is required to send this reminder",
        errors: { email: ["Customer email is required"] },
      });
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

    return res.status(200).json({
      message: `Invoice reminder sent to ${recipientEmail}`,
      data: { invoiceId: invoice.id, email: recipientEmail },
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }

    return res.status(500).json({ message: "Unable to send payment reminder" });
  }
};
