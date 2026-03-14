import type { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import type { z } from "zod";
import { invoiceCreateSchema } from "../../validations/apiValidations.js";
import {
  createInvoice,
  duplicateInvoice,
  deleteInvoice,
  generateInvoicePdf,
  getInvoice,
  getInvoiceForNotification,
  listInvoices,
  markInvoiceAsSent,
} from "./invoice.service.js";
import { sendInvoiceNotification } from "./invoice.notifications.js";

type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

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

const getPublicInvoiceLink = (req: Request, invoiceId: number) => {
  const configuredBaseUrl = process.env.PUBLIC_INVOICE_BASE_URL;
  const requestBaseUrl = `${req.protocol}://${req.get("host")}`;
  const baseUrl = (configuredBaseUrl || requestBaseUrl).replace(/\/$/, "");

  return `${baseUrl}/api/public/invoice/${invoiceId}`;
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

    let notificationWarning: string | null = null;
    try {
      const invoiceForNotification = await getInvoiceForNotification(
        userId,
        invoice.id,
      );

      if (invoiceForNotification) {
        const publicInvoiceLink = getPublicInvoiceLink(
          req,
          invoiceForNotification.id,
        );

        await sendInvoiceNotification(
          "created",
          {
            invoiceId: invoiceForNotification.id,
            invoiceNumber: invoiceForNotification.invoice_number,
            status: invoiceForNotification.status,
            issueDate: invoiceForNotification.date,
            dueDate: invoiceForNotification.due_date,
            total: invoiceForNotification.total,
            subtotal: invoiceForNotification.subtotal,
            tax: invoiceForNotification.tax,
            discount: invoiceForNotification.discount,
            customer: invoiceForNotification.customer,
            items: invoiceForNotification.items,
            businessProfile: invoiceForNotification.user.business_profile,
          },
          publicInvoiceLink,
        );
      }
    } catch (notificationError) {
      const err = notificationError as Error;
      notificationWarning =
        err.message || "Invoice created but notification failed";
      console.warn(
        `[invoice.store] Created invoice ${invoice.id}, but notification failed: ${notificationWarning}`,
      );
    }

    return res.status(201).json({
      message: "Invoice created",
      data: invoice,
      warning: notificationWarning,
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
    await markInvoiceAsSent(userId, id);

    const invoice = await getInvoiceForNotification(userId, id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const publicInvoiceLink = getPublicInvoiceLink(req, invoice.id);

    await sendInvoiceNotification(
      "sent",
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.date,
        dueDate: invoice.due_date,
        total: invoice.total,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        customer: invoice.customer,
        items: invoice.items,
        businessProfile: invoice.user.business_profile,
      },
      publicInvoiceLink,
    );

    return res.status(200).json({
      message: "Invoice sent notification email delivered",
      data: { invoiceId: invoice.id, status: invoice.status },
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
    const invoice = await getInvoiceForNotification(userId, id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const publicInvoiceLink = getPublicInvoiceLink(req, invoice.id);

    await sendInvoiceNotification(
      "reminder",
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        issueDate: invoice.date,
        dueDate: invoice.due_date,
        total: invoice.total,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        discount: invoice.discount,
        customer: invoice.customer,
        items: invoice.items,
        businessProfile: invoice.user.business_profile,
      },
      publicInvoiceLink,
    );

    return res.status(200).json({
      message: "Payment reminder email delivered",
      data: { invoiceId: invoice.id },
    });
  } catch (error) {
    const err = error as Error & { status?: number };
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }

    return res.status(500).json({ message: "Unable to send payment reminder" });
  }
};
