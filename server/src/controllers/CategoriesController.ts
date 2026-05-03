import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
} from "../validations/apiValidations.js";
import {
  invalidateRedisResourceCacheByPrefix,
  respondWithRedisCachedData,
  setRedisResourceCache,
} from "../lib/redisResourceCache.js";
import { measureRequestPhase } from "../lib/requestPerformance.js";
import {
  buildCategoriesCachePrefix,
  buildCategoriesRedisKey,
} from "../redis/cacheKeys.js";
import { invalidateProductOptionCaches } from "../lib/cacheInvalidation.js";

type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

const CATEGORY_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.CATEGORY_CACHE_TTL_SECONDS ?? 900),
  30,
);
const CATEGORY_CACHE_SWR_SECONDS = Math.max(
  Number(process.env.CATEGORY_CACHE_SWR_SECONDS ?? 300),
  0,
);

const invalidateCategoryCache = (businessId: string | undefined, userId: number) =>
  invalidateRedisResourceCacheByPrefix(
    buildCategoriesCachePrefix({ businessId, userId }),
  );

const normalizeCategoryName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const invalidateCategoryAndProductCaches = (
  businessId: string | undefined,
  userId: number,
) =>
  Promise.all([
    invalidateCategoryCache(businessId, userId),
    invalidateProductOptionCaches(businessId, userId),
  ]);

class CategoriesController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    return respondWithRedisCachedData({
      req,
      res,
      key: buildCategoriesRedisKey({ businessId, userId }),
      label: "categories",
      ttlSeconds: CATEGORY_CACHE_TTL_SECONDS,
      staleWhileRevalidateSeconds: CATEGORY_CACHE_SWR_SECONDS,
      invalidationPrefixes: [buildCategoriesCachePrefix({ businessId, userId })],
      resolver: async () =>
        measureRequestPhase("categories.db.list", () =>
          prisma.category.findMany({
            where: { user_id: userId },
            orderBy: { created_at: "desc" },
            select: {
              id: true,
              name: true,
              created_at: true,
              updated_at: true,
            },
          }),
        ),
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: CategoryCreateInput = req.body;
    const name = normalizeCategoryName(body.name);

    const duplicate = await prisma.category.findFirst({
      where: {
        user_id: userId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return sendResponse(res, 409, {
        message: "Category already exists",
        errors: { name: "Category already exists" },
      });
    }

    let category;
    try {
      category = await prisma.category.create({
        data: { user_id: userId, name },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return sendResponse(res, 409, {
          message: "Category already exists",
          errors: { name: "Category already exists" },
        });
      }
      throw error;
    }

    void invalidateCategoryCache(req.user?.businessId?.trim(), userId);

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
    const name =
      typeof body.name === "string" ? normalizeCategoryName(body.name) : undefined;

    const existing = await prisma.category.findFirst({
      where: { id, user_id: userId },
    });

    if (!existing) {
      return sendResponse(res, 404, { message: "Category not found" });
    }

    if (name) {
      const duplicate = await prisma.category.findFirst({
        where: {
          user_id: userId,
          NOT: { id },
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        return sendResponse(res, 409, {
          message: "Category already exists",
          errors: { name: "Category already exists" },
        });
      }
    }

    let category;
    try {
      category = await prisma.category.update({
        where: { id },
        data: name ? { name } : {},
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return sendResponse(res, 409, {
          message: "Category already exists",
          errors: { name: "Category already exists" },
        });
      }
      throw error;
    }

    void invalidateCategoryAndProductCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, {
      message: "Category updated",
      data: category,
    });
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

    void invalidateCategoryAndProductCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, { message: "Category removed" });
  }
}

export default CategoriesController;
