import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import { stockAdjustSchema } from "../validations/apiValidations.js";
import { dispatchNotification } from "../services/notification.service.js";
import { invalidateInventoryInsightsCacheByUser } from "../services/inventoryInsights.service.js";
import { applyInventoryDelta } from "../services/inventoryValidation.service.js";

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

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await applyInventoryDelta({
          tx,
          productId: product.id,
          warehouseId: warehouse_id,
          delta: change,
          reason: reason ?? "ADJUSTMENT",
          note: warehouse_id
            ? `${note ?? "Adjustment"} (Warehouse ${warehouse_id})`
            : note,
        });

        return tx.product.findUnique({
          where: { id: product.id },
        });
      });

      if (!updated) {
        return sendResponse(res, 500, { message: "Stock could not be updated" });
      }

      if (
        businessId &&
        updated.reorder_level > 0 &&
        updated.stock_on_hand <= updated.reorder_level
      ) {
        await dispatchNotification({
          userId,
          businessId,
          type: "inventory",
          message: `${updated.name} is low in stock (${updated.stock_on_hand} left).`,
          referenceKey: `low-stock:${updated.id}:${updated.stock_on_hand}`,
        });
      }

      invalidateInventoryInsightsCacheByUser(userId);

      return sendResponse(res, 200, { message: "Stock updated", data: updated });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return sendResponse(res, statusCode, {
          message: statusCode >= 500 ? "Stock could not be updated" : error.message,
        });
      }

      return sendResponse(res, 500, { message: "Stock could not be updated" });
    }
  }
}

export default StockController;

