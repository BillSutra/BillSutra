import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { InvoiceStatus } from "@prisma/client";
import type { z } from "zod";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
} from "../validations/apiValidations.js";
import { calculateInvoiceTotals } from "../utils/invoiceCalculations.js";
import {
  canWorkerPerformBillingAction,
  getWorkerAccessRole,
  type BillingAction,
} from "../lib/workerPermissions.js";

type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
type InvoiceUpdateInput = z.infer<typeof invoiceUpdateSchema>;
type InvoiceItemInput = InvoiceCreateInput["items"][number];
type InvoiceCreateItem = {
  product_id?: number;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number;
  total: number;
};

const canMutateBilling = async (req: Request, action: BillingAction) => {
  if (!req.user?.workerId) return true;

  const accessRole = await getWorkerAccessRole(req.user.workerId);
  if (!accessRole) return true;
  return canWorkerPerformBillingAction(accessRole, action);
};

class InvoicesController {
  static async nextInvoiceNumber(userId: number) {
    const latest = await prisma.invoice.findFirst({
      where: { user_id: userId },
      orderBy: { createdAt: "desc" },
      select: { invoice_number: true },
    });

    const match = latest?.invoice_number?.match(/INV-(\d+)/i);
    const next = match ? Number(match[1]) + 1 : 1;
    return `INV-${String(next).padStart(4, "0")}`;
  }

  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const invoices = await prisma.invoice.findMany({
      where: { user_id: userId },
      include: { customer: true, items: true, payments: true },
      orderBy: { createdAt: "desc" },
    });

    return sendResponse(res, 200, { data: invoices });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!(await canMutateBilling(req, "create"))) {
      return sendResponse(res, 403, {
        message: "You do not have permission for this billing action",
      });
    }

    const body: InvoiceCreateInput = req.body;

    const { subtotal, tax, discount, total, items } = calculateInvoiceTotals(
      body.items,
      body.discount ?? 0,
    );

    const invoiceItems: InvoiceCreateItem[] = items.map((item) => ({
      product_id: item.product_id ?? undefined,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
      total: item.lineTotal,
    }));

    const invoiceNumber = await InvoicesController.nextInvoiceNumber(userId);

    const invoice = await prisma.invoice.create({
      data: {
        user_id: userId,
        customer_id: body.customer_id,
        invoice_number: invoiceNumber,
        date: body.date ?? undefined,
        due_date: body.due_date ?? undefined,
        status: body.status ?? InvoiceStatus.DRAFT,
        subtotal,
        tax,
        discount,
        total,
        notes: body.notes,
        items: { create: invoiceItems },
      },
      include: { items: true },
    });

    if (req.user?.workerId) {
      try {
        await prisma.$executeRaw`
          UPDATE "invoices"
          SET "worker_id" = ${req.user.workerId}
          WHERE "id" = ${invoice.id}
        `;
        await prisma.$executeRaw`
          UPDATE "worker_profiles"
          SET "last_active_at" = CURRENT_TIMESTAMP,
              "updated_at" = CURRENT_TIMESTAMP
          WHERE "worker_id" = ${req.user.workerId}
        `;
      } catch {
        // Migration-safe fallback: invoice creation should still succeed.
      }
    }

    return sendResponse(res, 201, {
      message: "Invoice created",
      data: invoice,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const invoice = await prisma.invoice.findFirst({
      where: { id, user_id: userId },
      include: { customer: true, items: true, payments: true },
    });

    if (!invoice) {
      return sendResponse(res, 404, { message: "Invoice not found" });
    }

    return sendResponse(res, 200, { data: invoice });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!(await canMutateBilling(req, "update"))) {
      return sendResponse(res, 403, {
        message: "You do not have permission for this billing action",
      });
    }

    const id = Number(req.params.id);
    const body: InvoiceUpdateInput = req.body;
    const { status, due_date, notes } = body;

    const updated = await prisma.invoice.updateMany({
      where: { id, user_id: userId },
      data: {
        status,
        due_date: due_date ?? undefined,
        notes,
      },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Invoice not found" });
    }

    return sendResponse(res, 200, { message: "Invoice updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!(await canMutateBilling(req, "delete"))) {
      return sendResponse(res, 403, {
        message: "You do not have permission for this billing action",
      });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.invoice.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Invoice not found" });
    }

    return sendResponse(res, 200, { message: "Invoice removed" });
  }
}

export default InvoicesController;
