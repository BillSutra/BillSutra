import type { Request, Response } from "express";
import { InvoiceStatus } from "@prisma/client";
import prisma from "../../config/db.config.js";
import type { z } from "zod";
import {
  invoiceCreateSchema,
  invoicePreviewPdfRequestSchema,
  invoiceUpdateSchema,
} from "../../validations/apiValidations.js";
import {
  createInvoice,
  duplicateInvoice,
  deleteInvoice,
  generateInvoicePdf,
  getInvoiceBootstrap,
  getInvoice,
  listInvoices,
  markInvoiceAsSent,
  updateInvoice,
} from "./invoice.service.js";
import { emitDashboardUpdate } from "../../services/dashboardRealtime.js";
import { emitRealtimeInvoiceUpdated } from "../../services/realtimeSocket.service.js";
import { sendEmail } from "../../emails/index.js";
import { buildPublicInvoiceUrl } from "../../lib/appUrls.js";
import { incrementInvoiceUsage } from "../../services/subscription.service.js";
import { createNotification } from "../../services/notification.service.js";
import { dispatchNotification } from "../../services/notification.service.js";
import { invalidateInventoryInsightsCacheByUser } from "../../services/inventoryInsights.service.js";
import {
  deliverInvoiceEmail,
  deliverInvoiceReminderEmail,
  resolveInvoiceEmailRecipient,
} from "./invoiceEmail.service.js";
import { renderInvoicePreviewPdfBuffer } from "./invoicePreviewPdf.service.js";
import {
  invalidateCustomerListCaches,
  invalidateProductOptionCaches,
} from "../../lib/cacheInvalidation.js";
import {
  enqueueInvoiceEmailDelivery,
  enqueueInvoicePdfGeneration,
  enqueueInvoiceReminderDelivery,
} from "./invoice.queue.js";
import { recordAuditLog } from "../../services/auditLog.service.js";

type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
type InvoicePreviewPdfRequestInput = z.infer<typeof invoicePreviewPdfRequestSchema>;
type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
type HttpLikeError = Error & {
  status?: number;
  statusCode?: number;
  errors?: Record<string, unknown>;
};

const getErrorStatus = (error: unknown) => {
  const candidate = error as HttpLikeError;

  if (typeof candidate?.status === "number") {
    return candidate.status;
  }

  if (typeof candidate?.statusCode === "number") {
    return candidate.statusCode;
  }

  return undefined;
};

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

const sanitizeDownloadFileName = (value?: string) => {
  const fallback = "invoice-preview.pdf";
  if (!value?.trim()) return fallback;
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]/g, "-");
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
};

const parsePositiveIntQuery = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
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
  const pageRaw = readQueryValue(req.query.page);
  const limitRaw = readQueryValue(req.query.limit);

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

  const page = parsePositiveIntQuery(pageRaw);
  if (pageRaw && page === null) {
    return res.status(422).json({
      message: "Invalid page filter",
      errors: { page: ["page must be a positive integer"] },
    });
  }

  const limit = parsePositiveIntQuery(limitRaw);
  if (limitRaw && limit === null) {
    return res.status(422).json({
      message: "Invalid limit filter",
      errors: { limit: ["limit must be a positive integer"] },
    });
  }

  const invoices = await listInvoices(userId, {
    status,
    clientId,
    from: from ?? undefined,
    to: to ?? undefined,
    page: page ?? undefined,
    limit: limit ?? undefined,
  });
  return res.status(200).json({ data: invoices });
};

export const bootstrap = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const data = await getInvoiceBootstrap(userId);
  return res.status(200).json({ data });
};

export const store = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const businessId = req.user?.businessId?.trim();
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const body = req.body as InvoiceCreateInput;
    const invoice = await createInvoice(userId, body);
    invalidateInventoryInsightsCacheByUser(userId);
    void invalidateCustomerListCaches(businessId, userId);
    void invalidateProductOptionCaches(businessId, userId);

    try {
      await incrementInvoiceUsage(userId);
    } catch (error) {
      console.error(
        "[Invoice] Usage increment failed, invoice was still created",
        error,
      );
    }

    if (businessId) {
      try {
        await dispatchNotification({
          userId,
          businessId,
          type: "payment",
          message: `Invoice ${invoice.invoice_number} was created successfully.`,
          referenceKey: `invoice-created:${invoice.id}`,
        });
      } catch (error) {
        console.error(
          "[Invoice] Notification creation failed, invoice was still created",
          error,
        );
      }
    }
    emitDashboardUpdate({ userId, source: "invoice.create" });
    void enqueueInvoicePdfGeneration({
      userId,
      invoiceId: invoice.id,
      context: {
        businessId: req.user?.businessId,
        userId,
        actorId: req.user?.actorId,
        correlationId: req.requestId,
        metadata: {
          source: "invoice.create",
        },
      },
    });
    const hydratedInvoice = await getInvoice(userId, invoice.id);
    if (hydratedInvoice) {
      emitRealtimeInvoiceUpdated({
        userId,
        invoiceId: hydratedInvoice.id,
        status: hydratedInvoice.status,
        totalPaid: Number(
          (hydratedInvoice as { totalPaid?: unknown }).totalPaid ?? 0,
        ),
        computedStatus:
          (hydratedInvoice as { computedStatus?: string }).computedStatus ??
          undefined,
        source: "invoice.create",
      });
    }
    await recordAuditLog({
      req,
      userId,
      actorId: req.user?.actorId ?? String(userId),
      actorType: req.user?.accountType ?? "OWNER",
      action: "invoice.create",
      resourceType: "invoice",
      resourceId: String(invoice.id),
      status: "success",
      metadata: {
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
        total: invoice.total,
      },
    });

    return res.status(201).json({
      message: "Invoice created",
      data: invoice,
    });
  } catch (error) {
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);
    if (status) {
      return res.status(status).json({
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
  const businessId = req.user?.businessId?.trim();
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

  void invalidateCustomerListCaches(businessId, userId);
  void invalidateProductOptionCaches(businessId, userId);
  emitDashboardUpdate({ userId, source: "invoice.update" });
  void enqueueInvoicePdfGeneration({
    userId,
    invoiceId: id,
    context: {
      businessId: req.user?.businessId,
      userId,
      actorId: req.user?.actorId,
      correlationId: req.requestId,
      metadata: {
        source: "invoice.update",
      },
    },
  });
  const invoice = await getInvoice(userId, id);
  if (invoice) {
    emitRealtimeInvoiceUpdated({
      userId,
      invoiceId: invoice.id,
      status: invoice.status,
      totalPaid: Number((invoice as { totalPaid?: unknown }).totalPaid ?? 0),
      computedStatus:
        (invoice as { computedStatus?: string }).computedStatus ?? undefined,
      source: "invoice.update",
    });
  }
  await recordAuditLog({
    req,
    userId,
    actorId: req.user?.actorId ?? String(userId),
    actorType: req.user?.accountType ?? "OWNER",
    action: "invoice.update",
    resourceType: "invoice",
    resourceId: String(id),
    status: "success",
    metadata: {
      status: body.status ?? null,
      dueDate: body.due_date ?? null,
    },
  });
  return res.status(200).json({ message: "Invoice updated" });
};

export const destroy = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const businessId = req.user?.businessId?.trim();
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = Number(req.params.id);
  const deleted = await deleteInvoice(userId, id);
  if (!deleted.count) {
    return res.status(404).json({ message: "Invoice not found" });
  }

  void invalidateCustomerListCaches(businessId, userId);
  void invalidateProductOptionCaches(businessId, userId);
  emitDashboardUpdate({ userId, source: "invoice.delete" });
  await recordAuditLog({
    req,
    userId,
    actorId: req.user?.actorId ?? String(userId),
    actorType: req.user?.accountType ?? "OWNER",
    action: "invoice.delete",
    resourceType: "invoice",
    resourceId: String(id),
    status: "success",
  });
  return res.status(200).json({ message: "Invoice removed" });
};

export const duplicate = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const businessId = req.user?.businessId?.trim();
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const id = Number(req.params.id);
    const invoice = await duplicateInvoice(userId, id);
    void invalidateCustomerListCaches(businessId, userId);
    void invalidateProductOptionCaches(businessId, userId);
    emitDashboardUpdate({ userId, source: "invoice.duplicate" });
    void enqueueInvoicePdfGeneration({
      userId,
      invoiceId: invoice.id,
      context: {
        businessId: req.user?.businessId,
        userId,
        actorId: req.user?.actorId,
        correlationId: req.requestId,
        metadata: {
          source: "invoice.duplicate",
        },
      },
    });
    emitRealtimeInvoiceUpdated({
      userId,
      invoiceId: invoice.id,
      status: invoice.status,
      totalPaid: Number((invoice as { totalPaid?: unknown }).totalPaid ?? 0),
      computedStatus:
        (invoice as { computedStatus?: string }).computedStatus ?? undefined,
      source: "invoice.duplicate",
    });

    return res.status(201).json({
      message: "Invoice duplicated",
      data: invoice,
    });
  } catch (error) {
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);

    if (status) {
      return res.status(status).json({
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
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);

    if (status) {
      return res.status(status).json({
        message: err.message,
        errors: err.errors,
      });
    }

    console.error("[invoice.controller] pdf generation failed", {
      invoiceId: req.params.id,
      userId,
      message: err?.message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({ message: "Unable to generate invoice PDF" });
  }
};

export const previewPdf = async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const body = req.body as InvoicePreviewPdfRequestInput;
    const previewPayload = body.preview_payload;
    const previewItems = Array.isArray(previewPayload?.data?.items)
      ? previewPayload.data.items
      : [];

    if (!previewItems.length) {
      return res.status(422).json({
        message: "Invoice data not ready for PDF generation",
        errors: { preview_payload: ["At least one invoice item is required"] },
      });
    }

    const buffer = await renderInvoicePreviewPdfBuffer(previewPayload);
    const htmlLength = JSON.stringify(previewPayload).length;

    console.info("[invoice.controller] preview pdf generated", {
      userId,
      itemCount: previewItems.length,
      payloadSize: htmlLength,
      fileName: body.file_name ?? null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitizeDownloadFileName(body.file_name)}"`,
    );

    return res.status(200).send(buffer);
  } catch (error) {
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);

    if (status) {
      return res.status(status).json({
        message: err.message,
        errors: err.errors,
      });
    }

    console.error("[invoice.controller] preview pdf generation failed", {
      userId,
      message: err?.message,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({ message: "Unable to generate preview PDF" });
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
    const previewPayload =
      req.body?.preview_payload &&
      typeof req.body.preview_payload === "object" &&
      !Array.isArray(req.body.preview_payload)
        ? req.body.preview_payload
        : undefined;
    const { recipientEmail } = await resolveInvoiceEmailRecipient(
      userId,
      id,
      requestedEmail,
    );
    const queued =
      // Queue jobs intentionally carry IDs only. Preview payload sends stay sync.
      previewPayload === undefined
        ? await enqueueInvoiceEmailDelivery({
            userId,
            invoiceId: id,
            requestedEmail,
            context: {
              businessId: req.user?.businessId,
              userId,
              actorId: req.user?.actorId,
              correlationId: req.requestId,
              metadata: {
                source: "invoice.send",
              },
            },
          })
        : { queued: false as const };

    if (queued.queued) {
      return res.status(202).json({
        message: `Invoice email queued for ${recipientEmail}`,
        data: {
          invoiceId: id,
          status: "queued",
          email: recipientEmail,
          queued: true,
          jobId: queued.jobId,
          trackingId: queued.trackingId,
        },
      });
    }

    const result = await deliverInvoiceEmail({
      userId,
      invoiceId: id,
      requestedEmail,
      previewPayload,
    });

    return res.status(200).json({
      message: `Invoice email sent to ${recipientEmail}`,
      data: {
        invoiceId: result.invoiceId,
        status: result.status,
        email: result.email,
        queued: false,
      },
    });
  } catch (error) {
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);
    if (status) {
      return res.status(status).json({ message: err.message });
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

    const recipientEmail =
      requestedEmail || invoice.customer?.email?.trim() || "";
    if (!recipientEmail) {
      return res.status(422).json({
        message: "Customer email is required to send this reminder",
        errors: { email: ["Customer email is required"] },
      });
    }

    const queued = await enqueueInvoiceReminderDelivery({
      userId,
      invoiceId: id,
      requestedEmail,
      context: {
        businessId: req.user?.businessId,
        userId,
        actorId: req.user?.actorId,
        correlationId: req.requestId,
        metadata: {
          source: "invoice.reminder",
        },
      },
    });

    if (!queued.queued) {
      await deliverInvoiceReminderEmail({
        userId,
        invoiceId: id,
        requestedEmail,
      });
    }

    return res.status(200).json({
      message: queued.queued
        ? `Invoice reminder queued for ${recipientEmail}`
        : `Invoice reminder sent to ${recipientEmail}`,
      data: {
        invoiceId: invoice.id,
        email: recipientEmail,
        queued: queued.queued,
        jobId: queued.queued ? queued.jobId : null,
        trackingId: queued.queued ? queued.trackingId : null,
      },
    });
  } catch (error) {
    const err = error as HttpLikeError;
    const status = getErrorStatus(error);
    if (status) {
      return res.status(status).json({ message: err.message });
    }

    return res.status(500).json({ message: "Unable to send payment reminder" });
  }
};
