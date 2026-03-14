import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { PaymentMethod, PaymentStatus, StockReason } from "@prisma/client";
import type { z } from "zod";
import {
  purchaseCreateSchema,
  purchaseUpdateSchema,
} from "../validations/apiValidations.js";
import { computePaymentState } from "../utils/paymentCalculations.js";

type PurchaseCreateInput = z.infer<typeof purchaseCreateSchema>;
type PurchaseItemInput = PurchaseCreateInput["items"][number];
type PurchaseUpdateInput = z.infer<typeof purchaseUpdateSchema>;

const toNumber = (value: unknown) => Number(value ?? 0);

const decoratePurchaseFinancials = <T extends { total: unknown }>(
  purchase: T & {
    totalAmount?: unknown;
    paidAmount?: unknown;
    pendingAmount?: unknown;
    paymentStatus?: PaymentStatus;
    paymentDate?: Date | null;
    paymentMethod?: PaymentMethod | null;
  },
) => ({
  ...purchase,
  totalAmount: toNumber(purchase.totalAmount ?? purchase.total),
  paidAmount: toNumber(purchase.paidAmount),
  pendingAmount: toNumber(purchase.pendingAmount ?? purchase.total),
  paymentStatus: purchase.paymentStatus ?? PaymentStatus.UNPAID,
  paymentDate: purchase.paymentDate ?? null,
  paymentMethod: purchase.paymentMethod ?? null,
});

class PurchasesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const purchases = await prisma.purchase.findMany({
      where: { user_id: userId },
      include: { supplier: true, items: true, warehouse: true },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, {
      data: purchases.map((purchase) => decoratePurchaseFinancials(purchase)),
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: PurchaseCreateInput = req.body;

    if (body.supplier_id) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplier_id, user_id: userId },
      });

      if (!supplier) {
        return sendResponse(res, 404, { message: "Supplier not found" });
      }
    }

    if (body.warehouse_id) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: body.warehouse_id, user_id: userId },
      });

      if (!warehouse) {
        return sendResponse(res, 404, { message: "Warehouse not found" });
      }
    }

    const productIds = body.items.map(
      (item: PurchaseItemInput) => item.product_id,
    );

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
      unit_cost: number;
      tax_rate?: number;
      line_total: number;
    }> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return sendResponse(res, 404, { message: "Product not found" });
      }

      const lineSubtotal = item.quantity * item.unit_cost;
      const lineTax = item.tax_rate ? (lineSubtotal * item.tax_rate) / 100 : 0;
      subtotal += lineSubtotal;
      tax += lineTax;

      items.push({
        product_id: item.product_id,
        name: product.name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
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

    const purchase = await prisma.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          user_id: userId,
          supplier_id: body.supplier_id,
          warehouse_id: body.warehouse_id,
          purchase_date: body.purchase_date ?? undefined,
          subtotal,
          tax,
          total,
          totalAmount: paymentState.totalAmount,
          paidAmount: paymentState.paidAmount,
          pendingAmount: paymentState.pendingAmount,
          paymentStatus: paymentState.paymentStatus,
          paymentDate: paymentState.paymentDate,
          paymentMethod: paymentState.paymentMethod,
          notes: body.notes,
          items: { create: items },
        },
        include: { items: true, supplier: true, warehouse: true },
      });

      for (const item of items) {
        await tx.product.update({
          where: { id: item.product_id },
          data: { stock_on_hand: { increment: item.quantity } },
        });

        if (body.warehouse_id) {
          await tx.inventory.upsert({
            where: {
              warehouse_id_product_id: {
                warehouse_id: body.warehouse_id,
                product_id: item.product_id,
              },
            },
            update: { quantity: { increment: item.quantity } },
            create: {
              warehouse_id: body.warehouse_id,
              product_id: item.product_id,
              quantity: item.quantity,
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            product_id: item.product_id,
            change: item.quantity,
            reason: StockReason.PURCHASE,
            note: body.warehouse_id
              ? `Purchase ${created.id} (Warehouse ${body.warehouse_id})`
              : `Purchase ${created.id}`,
          },
        });
      }

      return created;
    });

    return sendResponse(res, 201, {
      message: "Purchase recorded",
      data: decoratePurchaseFinancials(purchase),
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const purchase = await prisma.purchase.findFirst({
      where: { id, user_id: userId },
      include: { supplier: true, items: true, warehouse: true },
    });

    if (!purchase) {
      return sendResponse(res, 404, { message: "Purchase not found" });
    }

    return sendResponse(res, 200, {
      data: decoratePurchaseFinancials(purchase),
    });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: PurchaseUpdateInput = req.body;

    const purchase = await prisma.purchase.findFirst({
      where: { id, user_id: userId },
      include: { items: true },
    });

    if (!purchase) {
      return sendResponse(res, 404, { message: "Purchase not found" });
    }

    if (body.supplier_id) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplier_id, user_id: userId },
      });

      if (!supplier) {
        return sendResponse(res, 404, { message: "Supplier not found" });
      }
    }

    if (body.warehouse_id) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: body.warehouse_id, user_id: userId },
      });

      if (!warehouse) {
        return sendResponse(res, 404, { message: "Warehouse not found" });
      }
    }

    const productIds = body.items.map(
      (item: PurchaseItemInput) => item.product_id,
    );

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
      unit_cost: number;
      tax_rate?: number;
      line_total: number;
    }> = [];

    for (const item of body.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return sendResponse(res, 404, { message: "Product not found" });
      }

      const lineSubtotal = item.quantity * item.unit_cost;
      const lineTax = item.tax_rate ? (lineSubtotal * item.tax_rate) / 100 : 0;
      subtotal += lineSubtotal;
      tax += lineTax;

      items.push({
        product_id: item.product_id,
        name: product.name,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        tax_rate: item.tax_rate,
        line_total: lineSubtotal + lineTax,
      });
    }

    const total = subtotal + tax;
    const paymentState = computePaymentState({
      totalAmount: total,
      paidAmount: body.amount_paid ?? toNumber(purchase.paidAmount),
      paymentStatus:
        (body.payment_status as PaymentStatus | undefined) ??
        purchase.paymentStatus,
      paymentDate: body.payment_date ?? purchase.paymentDate ?? undefined,
      paymentMethod: body.payment_method ?? purchase.paymentMethod ?? undefined,
    });

    const aggregateByProduct = (
      list: Array<{ product_id: number; quantity: number }>,
    ) => {
      const map = new Map<number, number>();
      for (const entry of list) {
        map.set(
          entry.product_id,
          (map.get(entry.product_id) ?? 0) + entry.quantity,
        );
      }
      return map;
    };

    const previousItems = purchase.items
      .filter((item) => item.product_id !== null)
      .map((item) => ({
        product_id: item.product_id as number,
        quantity: item.quantity,
      }));

    const previousQtyMap = aggregateByProduct(previousItems);
    const nextQtyMap = aggregateByProduct(
      items.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    );

    const productIdsToAdjust = new Set([
      ...previousQtyMap.keys(),
      ...nextQtyMap.keys(),
    ]);

    const previousWarehouseId = purchase.warehouse_id ?? undefined;
    const nextWarehouseId =
      body.warehouse_id ?? purchase.warehouse_id ?? undefined;
    const warehouseChanged = previousWarehouseId !== nextWarehouseId;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          supplier_id: body.supplier_id ?? purchase.supplier_id,
          warehouse_id: nextWarehouseId,
          purchase_date: body.purchase_date ?? purchase.purchase_date,
          notes: body.notes ?? purchase.notes,
          subtotal,
          tax,
          total,
          totalAmount: paymentState.totalAmount,
          paidAmount: paymentState.paidAmount,
          pendingAmount: paymentState.pendingAmount,
          paymentStatus: paymentState.paymentStatus,
          paymentDate: paymentState.paymentDate,
          paymentMethod: paymentState.paymentMethod,
          items: {
            deleteMany: {},
            create: items,
          },
        },
        include: { items: true, supplier: true, warehouse: true },
      });

      for (const productId of productIdsToAdjust) {
        const previousQty = previousQtyMap.get(productId) ?? 0;
        const nextQty = nextQtyMap.get(productId) ?? 0;
        const stockDiff = nextQty - previousQty;

        if (stockDiff) {
          await tx.product.update({
            where: { id: productId },
            data: { stock_on_hand: { increment: stockDiff } },
          });

          await tx.stockMovement.create({
            data: {
              product_id: productId,
              change: stockDiff,
              reason: StockReason.PURCHASE,
              note: nextWarehouseId
                ? `Purchase ${purchase.id} updated (Warehouse ${nextWarehouseId})`
                : `Purchase ${purchase.id} updated`,
            },
          });
        }

        if (warehouseChanged && previousWarehouseId && previousQty) {
          await tx.inventory.upsert({
            where: {
              warehouse_id_product_id: {
                warehouse_id: previousWarehouseId,
                product_id: productId,
              },
            },
            update: { quantity: { increment: -previousQty } },
            create: {
              warehouse_id: previousWarehouseId,
              product_id: productId,
              quantity: -previousQty,
            },
          });
        }

        if (nextWarehouseId) {
          const inventoryDiff = warehouseChanged ? nextQty : stockDiff;
          if (!inventoryDiff) continue;
          await tx.inventory.upsert({
            where: {
              warehouse_id_product_id: {
                warehouse_id: nextWarehouseId,
                product_id: productId,
              },
            },
            update: { quantity: { increment: inventoryDiff } },
            create: {
              warehouse_id: nextWarehouseId,
              product_id: productId,
              quantity: inventoryDiff,
            },
          });
        }
      }

      return updatedPurchase;
    });

    return sendResponse(res, 200, {
      message: "Purchase updated",
      data: decoratePurchaseFinancials(updated),
    });
  }
}

export default PurchasesController;
