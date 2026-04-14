import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { StockReason } from "@prisma/client";
import type { z } from "zod";
import { stockAdjustSchema } from "../validations/apiValidations.js";
import { createNotification } from "../services/notification.service.js";
import { invalidateInventoryInsightsCacheByUser } from "../services/inventoryInsights.service.js";

type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

class StockController {
  static async adjust(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: StockAdjustInput = req.body;
    const { product_id, warehouse_id, change, reason, note } = body;

    const product = await prisma.product.findFirst({
      where: { id: product_id, user_id: userId },
    });

    if (!product) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    if (warehouse_id) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: warehouse_id, user_id: userId },
      });

      if (!warehouse) {
        return sendResponse(res, 404, { message: "Warehouse not found" });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          stock_on_hand: product.stock_on_hand + change,
        },
      });

      if (warehouse_id) {
        await tx.inventory.upsert({
          where: {
            warehouse_id_product_id: {
              warehouse_id,
              product_id: product.id,
            },
          },
          update: { quantity: { increment: change } },
          create: {
            warehouse_id,
            product_id: product.id,
            quantity: change,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          product_id: product.id,
          change,
          reason: reason ?? StockReason.ADJUSTMENT,
          note: warehouse_id
            ? `${note ?? "Adjustment"} (Warehouse ${warehouse_id})`
            : note,
        },
      });

      return updatedProduct;
    });

    if (
      businessId &&
      updated.reorder_level > 0 &&
      updated.stock_on_hand <= updated.reorder_level
    ) {
      await createNotification({
        userId,
        businessId,
        type: "inventory",
        message: `${updated.name} is low in stock (${updated.stock_on_hand} left).`,
        referenceKey: `low-stock:${updated.id}:${updated.stock_on_hand}`,
      });
    }

    invalidateInventoryInsightsCacheByUser(userId);

    return sendResponse(res, 200, { message: "Stock updated", data: updated });
  }
}

export default StockController;

