import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  warehouseCreateSchema,
  warehouseUpdateSchema,
} from "../validations/apiValidations.js";
import {
  maintainProductCategoryReferences,
  normalizeProductCategoryRecord,
  productCategoryInclude,
} from "../lib/productCategories.js";

type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;

class WarehousesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const warehouses = await prisma.warehouse.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, { data: warehouses });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: WarehouseCreateInput = req.body;
    const { name, location } = body;

    const warehouse = await prisma.warehouse.create({
      data: { user_id: userId, name, location },
    });

    return sendResponse(res, 201, {
      message: "Warehouse created",
      data: warehouse,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    void maintainProductCategoryReferences(userId);
    const warehouse = await prisma.warehouse.findFirst({
      where: { id, user_id: userId },
      include: {
        inventories: {
          include: {
            product: {
              include: productCategoryInclude,
            },
          },
        },
      },
    });

    if (!warehouse) {
      return sendResponse(res, 404, { message: "Warehouse not found" });
    }

    return sendResponse(res, 200, {
      data: {
        ...warehouse,
        inventories: warehouse.inventories.map((inventory) => ({
          ...inventory,
          product: normalizeProductCategoryRecord(inventory.product),
        })),
      },
    });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: WarehouseUpdateInput = req.body;
    const { name, location } = body;

    const updated = await prisma.warehouse.updateMany({
      where: { id, user_id: userId },
      data: { name, location },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Warehouse not found" });
    }

    return sendResponse(res, 200, { message: "Warehouse updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.warehouse.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Warehouse not found" });
    }

    return sendResponse(res, 200, { message: "Warehouse removed" });
  }
}

export default WarehousesController;
