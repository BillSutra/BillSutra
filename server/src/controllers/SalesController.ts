import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import {
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
  StockReason,
} from "@prisma/client";
import type { z } from "zod";
import {
  saleCreateSchema,
  saleUpdateSchema,
} from "../validations/apiValidations.js";
import { computePaymentState } from "../utils/paymentCalculations.js";
import { emitDashboardUpdate } from "../services/dashboardRealtime.js";
import { invalidateInventoryInsightsCacheByUser } from "../services/inventoryInsights.service.js";
import {
  applyBillingSaleInventoryAdjustments,
  resolveBillingWarehouse,
} from "../services/billingInventorySync.service.js";
import {
  canWorkerPerformBillingAction,
  getWorkerAccessRole,
  type BillingAction,
} from "../lib/workerPermissions.js";

type SaleCreateInput = z.infer<typeof saleCreateSchema>;
type SaleUpdateInput = z.infer<typeof saleUpdateSchema>;
type SaleItemInput = SaleCreateInput["items"][number];

const toNumber = (value: unknown) => Number(value ?? 0);

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

    const sale = await prisma.$transaction(async (tx) => {
      const warehouse = await resolveBillingWarehouse(tx, userId, body.warehouse_id);
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
          tax_rate: item.tax_rate ?? undefined,
        })),
        referenceId: created.id,
        referenceType: "sale",
      });

      return created;
    });

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

    await prisma.sale.update({
      where: { id: existing.id },
      data: {
        status,
        notes,
        paidAmount: paymentState.paidAmount,
        pendingAmount: paymentState.pendingAmount,
        paymentStatus: paymentState.paymentStatus,
        paymentDate: paymentState.paymentDate,
        paymentMethod: paymentState.paymentMethod,
      },
    });

    invalidateInventoryInsightsCacheByUser(userId);
    emitDashboardUpdate({ userId, source: "sale.update" });
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

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        if (!item.product_id) continue;

        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_on_hand: { increment: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            change: item.quantity,
            reason: StockReason.RETURN,
            note: `Sale reversal ${sale.id}`,
          },
        });
      }

      await tx.sale.delete({ where: { id: sale.id } });
    });

    invalidateInventoryInsightsCacheByUser(userId);
    emitDashboardUpdate({ userId, source: "sale.delete" });
    return sendResponse(res, 200, { message: "Sale deleted" });
  }
}

export default SalesController;
