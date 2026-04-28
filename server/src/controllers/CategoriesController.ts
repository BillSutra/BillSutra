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

const CATEGORY_CACHE_MS = Number(process.env.CATEGORY_CACHE_MS ?? 30_000);
const categoryListCache = new Map<
  number,
  {
    expiresAt: number;
    data: Array<{
      id: number;
      name: string;
      created_at: Date;
      updated_at: Date;
    }>;
  }
>();

const invalidateCategoryCache = (userId: number) => {
  categoryListCache.delete(userId);
};

class CategoriesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const cached = categoryListCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return sendResponse(res, 200, { data: cached.data });
    }

    const categories = await prisma.category.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (CATEGORY_CACHE_MS > 0) {
      categoryListCache.set(userId, {
        expiresAt: Date.now() + CATEGORY_CACHE_MS,
        data: categories,
      });
    }

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

    invalidateCategoryCache(userId);

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

    invalidateCategoryCache(userId);

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

    invalidateCategoryCache(userId);

    return sendResponse(res, 200, { message: "Category removed" });
  }
}

export default CategoriesController;
