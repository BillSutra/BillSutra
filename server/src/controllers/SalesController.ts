import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import {
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  SaleStatus,
} from "@prisma/client";
import type { z } from "zod";
import {
  saleCreateSchema,
  saleUpdateSchema,
} from "../validations/apiValidations.js";
import { computePaymentState } from "../utils/paymentCalculations.js";
import { emitDashboardUpdate } from "../services/dashboardRealtime.js";
import { emitRealtimeInvoiceUpdated } from "../services/realtimeSocket.service.js";
import { invalidateInventoryInsightsCacheByUser } from "../services/inventoryInsights.service.js";
import {
  applyBillingSaleInventoryAdjustments,
  getBillingInventorySettings,
  resolveBillingWarehouse,
} from "../services/billingInventorySync.service.js";
import {
  applyInventoryDelta,
  parseWarehouseIdFromNote,
} from "../services/inventoryValidation.service.js";
import {
  canWorkerPerformBillingAction,
  getWorkerAccessRole,
  type BillingAction,
} from "../lib/workerPermissions.js";
import { computeInvoiceStatus } from "../utils/invoicePaymentSnapshot.js";
import { dispatchNotification } from "../services/notification.service.js";

type SaleCreateInput = z.infer<typeof saleCreateSchema>;
type SaleUpdateInput = z.infer<typeof saleUpdateSchema>;
type SaleItemInput = SaleCreateInput["items"][number];

const toNumber = (value: unknown) => Number(value ?? 0);
const roundCurrencyAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;
const SYNCED_INVOICE_NOTE_CAPTURE = /Synced from invoice\s+([^\s,)]+)/i;

const extractSyncedInvoiceNumber = (notes?: string | null) =>
  notes?.match(SYNCED_INVOICE_NOTE_CAPTURE)?.[1] ?? null;

const extractSyncedInvoiceDescriptor = (notes?: string | null) =>
  notes?.match(/Synced from invoice[^)]*/i)?.[0] ?? null;

const mergeSyncedInvoiceNotes = (
  currentNotes: string | null | undefined,
  requestedNotes: string | null | undefined,
) => {
  if (requestedNotes === undefined) {
    return undefined;
  }

  const syncDescriptor = extractSyncedInvoiceDescriptor(currentNotes);
  if (!syncDescriptor) {
    return requestedNotes;
  }

  const trimmed = requestedNotes?.trim() ?? "";
  if (!trimmed) {
    return syncDescriptor;
  }

  return trimmed.includes(syncDescriptor)
    ? trimmed
    : `${trimmed} (${syncDescriptor})`;
};

const resolveInvoiceStatusFromPaidAmount = (
  paidAmount: number,
  totalAmount: number,
) => {
  if (paidAmount >= totalAmount) {
    return InvoiceStatus.PAID;
  }

  if (paidAmount > 0) {
    return InvoiceStatus.PARTIALLY_PAID;
  }

  return InvoiceStatus.SENT;
};

const createSaleSyncValidationError = (message: string) => {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = 422;
  return error;
};

const buildSaleSyncPaymentReference = (saleId: number) => `sale-sync:${saleId}`;

const syncLinkedInvoicePaymentState = async (params: {
  tx: Prisma.TransactionClient;
  userId: number;
  saleId: number;
  currentSalePaidAmount: number;
  linkedInvoiceNumber: string;
  paymentState: ReturnType<typeof computePaymentState>;
}) => {
  const {
    tx,
    userId,
    saleId,
    currentSalePaidAmount,
    linkedInvoiceNumber,
    paymentState,
  } = params;

  const invoice = await tx.invoice.findFirst({
    where: { user_id: userId, invoice_number: linkedInvoiceNumber },
    include: {
      payments: {
        orderBy: [{ paid_at: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!invoice) {
    console.warn("[sales] linked invoice missing during payment sync", {
      saleId,
      userId,
      invoiceNumber: linkedInvoiceNumber,
    });
    return null;
  }

  const syncReference = buildSaleSyncPaymentReference(saleId);
  let syncPayments = invoice.payments.filter(
    (payment) => payment.reference === syncReference,
  );

  if (syncPayments.length === 0 && invoice.payments.length === 1) {
    const [candidate] = invoice.payments;
    const candidateAmount = roundCurrencyAmount(Number(candidate.amount ?? 0));
    if (
      !candidate.reference &&
      candidateAmount === roundCurrencyAmount(currentSalePaidAmount)
    ) {
      await tx.payment.update({
        where: { id: candidate.id },
        data: { reference: syncReference },
      });
      syncPayments = [{ ...candidate, reference: syncReference }];
    }
  }

  const syncPaymentIds = new Set(syncPayments.map((payment) => payment.id));
  const externalPaidAmount = roundCurrencyAmount(
    invoice.payments.reduce((sum, payment) => {
      if (syncPaymentIds.has(payment.id)) {
        return sum;
      }

      return sum + Number(payment.amount ?? 0);
    }, 0),
  );

  const desiredPaidAmount = roundCurrencyAmount(paymentState.paidAmount);
  if (desiredPaidAmount < externalPaidAmount) {
    throw createSaleSyncValidationError(
      "Cannot reduce this sale below the amount already collected on the linked invoice.",
    );
  }

  const desiredSyncAmount = roundCurrencyAmount(
    Math.max(desiredPaidAmount - externalPaidAmount, 0),
  );
  const [primarySyncPayment, ...extraSyncPayments] = syncPayments;

  if (extraSyncPayments.length > 0) {
    await tx.payment.deleteMany({
      where: { id: { in: extraSyncPayments.map((payment) => payment.id) } },
    });
  }

  if (desiredSyncAmount > 0) {
    const syncPaymentPayload = {
      amount: desiredSyncAmount,
      method: paymentState.paymentMethod ?? PaymentMethod.CASH,
      paid_at: paymentState.paymentDate ?? new Date(),
      reference: syncReference,
    };

    if (primarySyncPayment) {
      await tx.payment.update({
        where: { id: primarySyncPayment.id },
        data: syncPaymentPayload,
      });
    } else {
      await tx.payment.create({
        data: {
          user_id: userId,
          invoice_id: invoice.id,
          ...syncPaymentPayload,
        },
      });
    }
  } else if (primarySyncPayment) {
    await tx.payment.delete({
      where: { id: primarySyncPayment.id },
    });
  }

  const totalPaidAmount = roundCurrencyAmount(
    externalPaidAmount + Math.max(desiredSyncAmount, 0),
  );
  const invoiceStatus = resolveInvoiceStatusFromPaidAmount(
    totalPaidAmount,
    Number(invoice.total ?? 0),
  );

  await tx.invoice.update({
    where: { id: invoice.id },
    data: { status: invoiceStatus },
  });

  console.info("[sales] synced linked invoice payment state", {
    saleId,
    invoiceId: invoice.id,
    invoiceNumber: linkedInvoiceNumber,
    userId,
    totalPaid: totalPaidAmount,
    status: invoiceStatus,
  });

  return {
    invoiceId: invoice.id,
    totalPaid: totalPaidAmount,
    status: invoiceStatus,
    computedStatus: computeInvoiceStatus(totalPaidAmount, Number(invoice.total ?? 0)),
  };
};

const canMutateBilling = async (req: Request, action: BillingAction) => {
  if (!req.user?.workerId) return true;

  const accessRole = await getWorkerAccessRole(req.user.workerId);
  if (!accessRole) return true;
  return canWorkerPerformBillingAction(accessRole, action);
};

const decorateSaleFinancials = <T extends { total: unknown }>(
  sale: T & {
    totalAmount?: unknown;
    paidAmount?: unknown;
    pendingAmount?: unknown;
    paymentStatus?: PaymentStatus;
    paymentDate?: Date | null;
    paymentMethod?: PaymentMethod | null;
    notes?: string | null;
  },
) => ({
  ...sale,
  totalAmount: toNumber(sale.totalAmount ?? sale.total),
  paidAmount: toNumber(sale.paidAmount),
  pendingAmount: toNumber(sale.pendingAmount ?? sale.total),
  paymentStatus: sale.paymentStatus ?? PaymentStatus.UNPAID,
  paymentDate: sale.paymentDate ?? null,
  paymentMethod: sale.paymentMethod ?? null,
});

class SalesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const sales = await prisma.sale.findMany({
      where: { user_id: userId },
      include: { customer: true, items: true },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, {
      data: sales.map((sale) => decorateSaleFinancials(sale)),
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    if (!(await canMutateBilling(req, "create"))) {
      return sendResponse(res, 403, {
        message: "You do not have permission for this billing action",
      });
    }

    const body: SaleCreateInput = req.body;
    const { status, notes } = body;

    if (body.customer_id) {
      const customer = await prisma.customer.findFirst({
        where: { id: body.customer_id, user_id: userId },
      });

      if (!customer) {
        return sendResponse(res, 404, { message: "Customer not found" });
      }
    }

    const productIds = body.items.map((item: SaleItemInput) => item.product_id);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, user_id: userId },
    });

    if (products.length !== productIds.length) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    let tax = 0;
    const items: Array<{
      product_id: number;
      name: string;
      quantity: number;
      unit_price: number;
      tax_rate?: number;
      line_total: number;
    }> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return sendResponse(res, 404, { message: "Product not found" });
      }

      const lineSubtotal = item.quantity * item.unit_price;
      const lineTax = item.tax_rate ? (lineSubtotal * item.tax_rate) / 100 : 0;
      subtotal += lineSubtotal;
      tax += lineTax;

      items.push({
        product_id: item.product_id,
        name: product.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: lineSubtotal + lineTax,
      });
    }

    const total = subtotal + tax;
    const paymentState = computePaymentState({
      totalAmount: total,
      paidAmount: body.amount_paid,
      paymentStatus: body.payment_status as PaymentStatus | undefined,
      paymentDate: body.payment_date,
      paymentMethod: body.payment_method,
    });

    let sale;
    try {
      sale = await prisma.$transaction(async (tx) => {
        const inventorySettings = await getBillingInventorySettings(tx, userId);
        const warehouse = await resolveBillingWarehouse(
          tx,
          userId,
          body.warehouse_id,
        );
        const created = await tx.sale.create({
          data: {
            user_id: userId,
            customer_id: body.customer_id,
            sale_date: body.sale_date ?? undefined,
            status: body.status ?? SaleStatus.COMPLETED,
            subtotal,
            tax,
            total,
            totalAmount: paymentState.totalAmount,
            paidAmount: paymentState.paidAmount,
            pendingAmount: paymentState.pendingAmount,
            paymentStatus: paymentState.paymentStatus,
            paymentDate: paymentState.paymentDate,
            paymentMethod: paymentState.paymentMethod,
            notes: body.notes
              ? `${body.notes} (Warehouse ${warehouse.id})`
              : `Warehouse ${warehouse.id}`,
            items: { create: items },
          },
          include: { items: true, customer: true },
        });

        await applyBillingSaleInventoryAdjustments({
          tx,
          warehouseId: warehouse.id,
          items: items.map((item) => ({
            product_id: item.product_id,
            name: item.name,
            quantity: item.quantity,
            price: item.unit_price,
            nonInventoryItem: false,
            tax_rate: item.tax_rate ?? undefined,
          })),
          allowNegativeStock: inventorySettings.allowNegativeStock,
          referenceId: created.id,
          referenceType: "sale",
        });

        return created;
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return sendResponse(res, statusCode, {
          message: statusCode >= 500 ? "Sale could not be recorded" : error.message,
        });
      }

      return sendResponse(res, 500, { message: "Sale could not be recorded" });
    }

    if (req.user?.workerId) {
      try {
        await prisma.$executeRaw`
            UPDATE "sales"
            SET "worker_id" = ${req.user.workerId}
            WHERE "id" = ${sale.id}
          `;
        await prisma.$executeRaw`
            UPDATE "worker_profiles"
            SET "last_active_at" = CURRENT_TIMESTAMP,
                "updated_at" = CURRENT_TIMESTAMP
            WHERE "worker_id" = ${req.user.workerId}
          `;
      } catch {
        // Migration-safe fallback: sale creation should still succeed.
      }
    }

    invalidateInventoryInsightsCacheByUser(userId);
    emitDashboardUpdate({ userId, source: "sale.create" });
    if (businessId) {
      const largeSaleThreshold = Number(
        process.env.NOTIFICATION_LARGE_SALE_THRESHOLD ?? 25000,
      );

      if (Number.isFinite(largeSaleThreshold) && total >= largeSaleThreshold) {
        void dispatchNotification({
          userId,
          businessId,
          type: "payment",
          message: `Large sale completed for Rs ${total.toFixed(2)}.`,
          referenceKey: `large-sale:${sale.id}`,
        });
      }
    }
    return sendResponse(res, 201, {
      message: "Sale recorded",
      data: decorateSaleFinancials(sale),
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const sale = await prisma.sale.findFirst({
      where: { id, user_id: userId },
      include: { customer: true, items: true },
    });

    if (!sale) {
      return sendResponse(res, 404, { message: "Sale not found" });
    }

    return sendResponse(res, 200, { data: decorateSaleFinancials(sale) });
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
    const body: SaleUpdateInput = req.body;
    const { status, notes } = body;
    const existing = await prisma.sale.findFirst({
      where: { id, user_id: userId },
      select: {
        id: true,
        total: true,
        paidAmount: true,
        paymentStatus: true,
        paymentDate: true,
        paymentMethod: true,
        notes: true,
      },
    });

    if (!existing) {
      return sendResponse(res, 404, { message: "Sale not found" });
    }

    const paymentState = computePaymentState({
      totalAmount: toNumber(existing.total),
      paidAmount: body.amount_paid ?? toNumber(existing.paidAmount),
      paymentStatus:
        (body.payment_status as PaymentStatus | undefined) ??
        existing.paymentStatus,
      paymentDate: body.payment_date ?? existing.paymentDate ?? undefined,
      paymentMethod: body.payment_method ?? existing.paymentMethod ?? undefined,
    });
    const linkedInvoiceNumber = extractSyncedInvoiceNumber(existing.notes);
    const mergedNotes = mergeSyncedInvoiceNotes(existing.notes, notes);
    let syncedInvoiceUpdate:
      | Awaited<ReturnType<typeof syncLinkedInvoicePaymentState>>
      | null = null;

    try {
      syncedInvoiceUpdate = await prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: existing.id },
          data: {
            status,
            notes: mergedNotes,
            paidAmount: paymentState.paidAmount,
            pendingAmount: paymentState.pendingAmount,
            paymentStatus: paymentState.paymentStatus,
            paymentDate: paymentState.paymentDate,
            paymentMethod: paymentState.paymentMethod,
          },
        });

        if (linkedInvoiceNumber) {
          return syncLinkedInvoicePaymentState({
            tx,
            userId,
            saleId: existing.id,
            currentSalePaidAmount: toNumber(existing.paidAmount),
            linkedInvoiceNumber,
            paymentState,
          });
        }

        return null;
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return sendResponse(res, statusCode, {
          message: statusCode >= 500 ? "Sale could not be updated" : error.message,
        });
      }

      return sendResponse(res, 500, { message: "Sale could not be updated" });
    }

    invalidateInventoryInsightsCacheByUser(userId);
    emitDashboardUpdate({ userId, source: "sale.update" });
    if (syncedInvoiceUpdate) {
      emitRealtimeInvoiceUpdated({
        userId,
        invoiceId: syncedInvoiceUpdate.invoiceId,
        status: syncedInvoiceUpdate.status,
        totalPaid: syncedInvoiceUpdate.totalPaid,
        computedStatus: syncedInvoiceUpdate.computedStatus,
        source: "sale.update",
      });
    }
    return sendResponse(res, 200, { message: "Sale updated" });
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
    const sale = await prisma.sale.findFirst({
      where: { id, user_id: userId },
      include: { items: true },
    });

    if (!sale) {
      return sendResponse(res, 404, { message: "Sale not found" });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const warehouseId = parseWarehouseIdFromNote(sale.notes);

        for (const item of sale.items) {
          if (!item.product_id) continue;

          await applyInventoryDelta({
            tx,
            productId: item.product_id,
            warehouseId,
            delta: item.quantity,
            reason: "RETURN",
            note: warehouseId
              ? `Sale reversal ${sale.id} (Warehouse ${warehouseId})`
              : `Sale reversal ${sale.id}`,
          });
        }

        await tx.sale.delete({ where: { id: sale.id } });
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return sendResponse(res, statusCode, {
          message: statusCode >= 500 ? "Sale could not be deleted" : error.message,
        });
      }

      return sendResponse(res, 500, { message: "Sale could not be deleted" });
    }

    invalidateInventoryInsightsCacheByUser(userId);
    emitDashboardUpdate({ userId, source: "sale.delete" });
    return sendResponse(res, 200, { message: "Sale deleted" });
  }
}

export default SalesController;
