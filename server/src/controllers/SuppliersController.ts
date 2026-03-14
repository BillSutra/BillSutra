import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  supplierCreateSchema,
  supplierUpdateSchema,
} from "../validations/apiValidations.js";

type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

class SuppliersController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, { data: suppliers });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: SupplierCreateInput = req.body;
    const { name, email, phone, address } = body;

    const supplier = await prisma.supplier.create({
      data: { user_id: userId, name, email, phone, address },
    });

    return sendResponse(res, 201, {
      message: "Supplier created",
      data: supplier,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const supplier = await prisma.supplier.findFirst({
      where: { id, user_id: userId },
      include: { purchases: true },
    });

    if (!supplier) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    return sendResponse(res, 200, { data: supplier });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: SupplierUpdateInput = req.body;
    const { name, email, phone, address } = body;

    const updated = await prisma.supplier.updateMany({
      where: { id, user_id: userId },
      data: { name, email, phone, address },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    return sendResponse(res, 200, { message: "Supplier updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.supplier.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    return sendResponse(res, 200, { message: "Supplier removed" });
  }
}

export default SuppliersController;
