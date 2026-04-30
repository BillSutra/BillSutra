import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { getTotalPages, parsePagination } from "../utils/pagination.js";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import {
  productCreateSchema,
  productUpdateSchema,
} from "../validations/apiValidations.js";
import { dispatchNotification } from "../services/notification.service.js";
import {
  maintainProductCategoryReferences,
  normalizeProductCategoryRecord,
  normalizeProductCategoryRecords,
  productCategoryInclude,
} from "../lib/productCategories.js";
import {
  respondWithRedisCachedData,
} from "../lib/redisResourceCache.js";
import { measureRequestPhase } from "../lib/requestPerformance.js";
import {
  buildProductOptionsCachePrefix,
  buildProductOptionsRedisKey,
} from "../redis/cacheKeys.js";
import { invalidateProductOptionCaches } from "../lib/cacheInvalidation.js";

type ProductCreateInput = z.infer<typeof productCreateSchema>;
type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

const PRODUCT_OPTIONS_CACHE_TTL_SECONDS = Math.max(
  Number(process.env.PRODUCT_OPTIONS_CACHE_TTL_SECONDS ?? 180),
  15,
);
const PRODUCT_OPTIONS_CACHE_SWR_SECONDS = Math.max(
  Number(process.env.PRODUCT_OPTIONS_CACHE_SWR_SECONDS ?? 60),
  0,
);

const normalizeProductName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const buildQuickProductSku = (productName: string) => {
  const base = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  const prefix = base || "ITEM";
  const suffix = `${Date.now().toString().slice(-4)}${Math.floor(
    Math.random() * 90 + 10,
  )}`;
  return `${prefix}-${suffix}`;
};

const resolveProductSku = async ({
  userId,
  preferredSku,
  productName,
}: {
  userId: number;
  preferredSku?: string;
  productName: string;
}) => {
  const requestedSku = preferredSku?.trim();
  if (requestedSku) {
    return requestedSku;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidateSku = buildQuickProductSku(productName);
    const existingProduct = await prisma.product.findFirst({
      where: {
        user_id: userId,
        sku: candidateSku,
      },
      select: { id: true },
    });

    if (!existingProduct) {
      return candidateSku;
    }
  }

  return `${buildQuickProductSku(productName)}-${Math.floor(
    Math.random() * 900 + 100,
  )}`;
};

class ProductsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const { page, limit, skip } = parsePagination(
      {
        page: req.query.page,
        limit: req.query.limit,
      },
      {
        defaultLimit: 20,
        maxLimit: 200,
      },
    );

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : "";
    const mode =
      typeof req.query.mode === "string" ? req.query.mode.trim().toLowerCase() : "";
    const isOptionsMode = mode === "options";

    const where: Prisma.ProductWhereInput = {
      user_id: userId,
    };

    if (category) {
      const parsedCategoryId = Number(category);
      if (Number.isInteger(parsedCategoryId) && parsedCategoryId > 0) {
        where.category_id = parsedCategoryId;
      } else {
        where.category = {
          name: {
            equals: category,
            mode: "insensitive",
          },
        };
      }
    }

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          sku: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          barcode: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          category: {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    void maintainProductCategoryReferences(userId);

    if (isOptionsMode) {
      return respondWithRedisCachedData({
        req,
        res,
        key: buildProductOptionsRedisKey({
          businessId,
          userId,
          search,
          category,
          page,
          limit,
        }),
        label: "products-options",
        ttlSeconds: PRODUCT_OPTIONS_CACHE_TTL_SECONDS,
        staleWhileRevalidateSeconds: PRODUCT_OPTIONS_CACHE_SWR_SECONDS,
        invalidationPrefixes: [
          buildProductOptionsCachePrefix({ businessId, userId }),
        ],
        resolver: async () => {
          const items = await measureRequestPhase("products.db.options", () =>
            prisma.product.findMany({
              where,
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                price: true,
                cost: true,
                gst_rate: true,
                stock_on_hand: true,
                reorder_level: true,
                category: productCategoryInclude.category,
              },
              orderBy: { name: "asc" },
              skip,
              take: limit,
            }),
          );
          const normalizedItems = await measureRequestPhase(
            "products.serialize.options",
            async () => normalizeProductCategoryRecords(items),
          );
          return {
            products: normalizedItems,
            items: normalizedItems,
            page,
            limit,
            total: normalizedItems.length,
            totalPages: 1,
          };
        },
      });
    }

    const [items, total] = await measureRequestPhase("products.db.index", () =>
      Promise.all([
        prisma.product.findMany({
          where,
          include: productCategoryInclude,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]),
    );
    const normalizedItems = await measureRequestPhase(
      "products.serialize.index",
      async () => normalizeProductCategoryRecords(items),
    );

    return sendResponse(res, 200, {
      data: {
        products: normalizedItems,
        items: normalizedItems,
        total,
        page,
        limit,
        totalPages: getTotalPages(total, limit),
      },
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    const businessId = req.user?.businessId?.trim();
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: ProductCreateInput = req.body;
    const {
      name,
      sku,
      price,
      barcode,
      gst_rate,
      cost,
      stock_on_hand,
      reorder_level,
      category_id,
    } = body;
    const normalizedName = normalizeProductName(name);

    if (category_id) {
      const category = await prisma.category.findFirst({
        where: { id: category_id, user_id: userId },
      });

      if (!category) {
        return sendResponse(res, 404, { message: "Category not found" });
      }
    }

    if (barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode },
      });

      if (existingBarcode) {
        return sendResponse(res, 409, { message: "Barcode already in use" });
      }
    }

    const existingProductWithName = await prisma.product.findFirst({
      where: {
        user_id: userId,
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
      include: productCategoryInclude,
    });

    if (existingProductWithName) {
      return sendResponse(res, 409, {
        message: "Product already exists",
        data: normalizeProductCategoryRecord(existingProductWithName),
      });
    }

    const resolvedSku = await resolveProductSku({
      userId,
      preferredSku: sku,
      productName: normalizedName,
    });

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        category_id,
        name: normalizedName,
        sku: resolvedSku,
        barcode,
        gst_rate,
        price,
        cost,
        stock_on_hand: stock_on_hand ?? 0,
        reorder_level: reorder_level ?? 0,
      },
      include: productCategoryInclude,
    });
    void invalidateProductOptionCaches(req.user?.businessId?.trim(), userId);

    if (businessId) {
      void dispatchNotification({
        userId,
        businessId,
        type: "inventory",
        message: `New product ${product.name} added.`,
        referenceKey: `product-created:${product.id}`,
      });
    }

    return sendResponse(res, 201, {
      message: "Product created",
      data: normalizeProductCategoryRecord(product),
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    void maintainProductCategoryReferences(userId);
    const product = await prisma.product.findFirst({
      where: { id, user_id: userId },
      include: productCategoryInclude,
    });

    if (!product) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    return sendResponse(res, 200, {
      data: normalizeProductCategoryRecord(product),
    });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: ProductUpdateInput = req.body;
    const {
      name,
      sku,
      price,
      barcode,
      gst_rate,
      cost,
      stock_on_hand,
      reorder_level,
      category_id,
    } = body;
    const normalizedName = typeof name === "string"
      ? normalizeProductName(name)
      : undefined;

    if (category_id) {
      const category = await prisma.category.findFirst({
        where: { id: category_id, user_id: userId },
      });

      if (!category) {
        return sendResponse(res, 404, { message: "Category not found" });
      }
    }

    if (barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: { barcode, NOT: { id } },
      });

      if (existingBarcode) {
        return sendResponse(res, 409, { message: "Barcode already in use" });
      }
    }

    const existingProduct = await prisma.product.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });

    if (!existingProduct) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    if (normalizedName) {
      const duplicateNameProduct = await prisma.product.findFirst({
        where: {
          user_id: userId,
          NOT: { id: existingProduct.id },
          name: {
            equals: normalizedName,
            mode: "insensitive",
          },
        },
        include: productCategoryInclude,
      });

      if (duplicateNameProduct) {
        return sendResponse(res, 409, {
          message: "Product already exists",
          data: normalizeProductCategoryRecord(duplicateNameProduct),
        });
      }
    }

    const updated = await prisma.product.update({
      where: { id: existingProduct.id },
      data: {
        name: normalizedName,
        sku,
        barcode,
        gst_rate,
        price,
        cost,
        stock_on_hand,
        reorder_level,
        category_id,
      },
      include: productCategoryInclude,
    });
    void invalidateProductOptionCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, {
      message: "Product updated",
      data: normalizeProductCategoryRecord(updated),
    });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.product.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    void invalidateProductOptionCaches(req.user?.businessId?.trim(), userId);

    return sendResponse(res, 200, { message: "Product removed" });
  }
}

export default ProductsController;
