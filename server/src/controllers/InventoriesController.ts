import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { StockReason } from "@prisma/client";
import type { z } from "zod";
import {
  inventoryAdjustSchema,
  inventoryQuerySchema,
} from "../validations/apiValidations.js";

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

    const updated = await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.upsert({
        where: {
          warehouse_id_product_id: {
            warehouse_id,
            product_id,
          },
        },
        update: { quantity: { increment: change } },
        create: {
          warehouse_id,
          product_id,
          quantity: change,
        },
      });

      const productUpdated = await tx.product.update({
        where: { id: product_id },
        data: { stock_on_hand: { increment: change } },
      });

      await tx.stockMovement.create({
        data: {
          product_id,
          change,
          reason: reason ?? StockReason.ADJUSTMENT,
          note: note
            ? `${note} (Warehouse ${warehouse_id})`
            : `Warehouse ${warehouse_id}`,
        },
      });

      return { inventory, product: productUpdated };
    });

    return sendResponse(res, 200, {
      message: "Inventory updated",
      data: updated,
    });
  }
}

export default InventoriesController;
