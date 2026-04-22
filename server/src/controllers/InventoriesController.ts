import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from "../validations/apiValidations.js";
import { createNotification } from "../services/notification.service.js";
import { invalidateInventoryInsightsCacheByUser } from "../services/inventoryInsights.service.js";
import { applyInventoryDelta } from "../services/inventoryValidation.service.js";

type InventoryAdjustInput = z.infer<typeof inventoryAdjustSchema>;
type InventoryQueryInput = z.infer<typeof inventoryQuerySchema>;

class InventoriesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const query: InventoryQueryInput = req.query;
      const warehouseIdRaw = query.warehouse_id;
      const warehouseId =
        typeof warehouseIdRaw === "number"
          ? warehouseIdRaw
          : warehouseIdRaw
            ? Number(warehouseIdRaw)
            : undefined;

      if (warehouseIdRaw && !Number.isFinite(warehouseId)) {
        return sendResponse(res, 422, {
          message: "Validation failed",
          errors: { warehouse_id: ["Invalid warehouse id"] },
        });
      }

      const inventories = await prisma.inventory.findMany({
        where: {
          warehouse: { user_id: userId },
          ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        },
        include: { warehouse: true, product: true },
        orderBy: { id: "desc" },
      });

      return sendResponse(res, 200, { data: inventories });
    } catch (error) {
      return sendResponse(res, 500, { message: "Failed to load inventories" });
    }
  }

  static async adjust(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: InventoryAdjustInput = req.body;
    const { warehouse_id, product_id, change, reason, note } = body;

    const [warehouse, product] = await Promise.all([
      prisma.warehouse.findFirst({
        where: { id: warehouse_id, user_id: userId },
      }),
      prisma.product.findFirst({
        where: { id: product_id, user_id: userId },
      }),
    ]);

    if (!warehouse) {
      return sendResponse(res, 404, { message: "Warehouse not found" });
    }

    if (!product) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await applyInventoryDelta({
          tx,
          productId: product_id,
          warehouseId: warehouse_id,
          delta: change,
          reason: reason ?? "ADJUSTMENT",
          note: note
            ? `${note} (Warehouse ${warehouse_id})`
            : `Warehouse ${warehouse_id}`,
        });

        const [inventory, productUpdated] = await Promise.all([
          tx.inventory.findUnique({
            where: {
              warehouse_id_product_id: {
                warehouse_id,
                product_id,
              },
            },
          }),
          tx.product.findUnique({
            where: { id: product_id },
          }),
        ]);

        return {
          inventory,
          product: productUpdated,
        };
      });

      if (!updated.inventory || !updated.product) {
        return sendResponse(res, 500, {
          message: "Inventory could not be updated",
        });
      }

      if (
        businessId &&
        updated.product.reorder_level > 0 &&
        updated.product.stock_on_hand <= updated.product.reorder_level
      ) {
        await createNotification({
          userId,
          businessId,
          type: "inventory",
          message: `${updated.product.name} is low in stock (${updated.product.stock_on_hand} left).`,
          referenceKey: `low-stock:${updated.product.id}:${updated.product.stock_on_hand}`,
        });
      }

      invalidateInventoryInsightsCacheByUser(userId);

      return sendResponse(res, 200, {
        message: "Inventory updated",
        data: updated,
      });
    } catch (error) {
      if (error instanceof Error) {
        const statusCode =
          "statusCode" in error && typeof error.statusCode === "number"
            ? error.statusCode
            : 500;

        return sendResponse(res, statusCode, {
          message:
            statusCode >= 500
              ? "Inventory could not be updated"
              : error.message,
        });
      }

      return sendResponse(res, 500, {
        message: "Inventory could not be updated",
      });
    }
  }
}

export default InventoriesController;
