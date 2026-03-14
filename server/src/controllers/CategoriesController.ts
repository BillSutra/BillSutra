import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
} from "../validations/apiValidations.js";

type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

class CategoriesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const categories = await prisma.category.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });

    return sendResponse(res, 200, { data: categories });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: CategoryCreateInput = req.body;
    const { name } = body;

    const category = await prisma.category.create({
      data: { user_id: userId, name },
    });

    return sendResponse(res, 201, {
      message: "Category created",
      data: category,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const category = await prisma.category.findFirst({
      where: { id, user_id: userId },
    });

    if (!category) {
      return sendResponse(res, 404, { message: "Category not found" });
    }

    return sendResponse(res, 200, { data: category });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: CategoryUpdateInput = req.body;
    const { name } = body;

    const updated = await prisma.category.updateMany({
      where: { id, user_id: userId },
      data: { name },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Category not found" });
    }

    return sendResponse(res, 200, { message: "Category updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.category.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Category not found" });
    }

    return sendResponse(res, 200, { message: "Category removed" });
  }
}

export default CategoriesController;
