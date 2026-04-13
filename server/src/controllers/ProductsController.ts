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

type ProductCreateInput = z.infer<typeof productCreateSchema>;
type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

class ProductsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
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
      ];
    }

    const dbQuery = {
      where,
      include: { category: true },
      orderBy: { created_at: "desc" as const },
      skip,
      take: limit,
    };

    const [items, total] = await prisma.$transaction([
      prisma.product.findMany(dbQuery),
      prisma.product.count({ where }),
    ]);

    return sendResponse(res, 200, {
      data: {
        products: items,
        items,
        total,
        page,
        limit,
        totalPages: getTotalPages(total, limit),
      },
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
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

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        category_id,
        name,
        sku,
        barcode,
        gst_rate,
        price,
        cost,
        stock_on_hand: stock_on_hand ?? 0,
        reorder_level: reorder_level ?? 0,
      },
    });

    return sendResponse(res, 201, {
      message: "Product created",
      data: product,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const product = await prisma.product.findFirst({
      where: { id, user_id: userId },
      include: { category: true },
    });

    if (!product) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    return sendResponse(res, 200, { data: product });
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

    const updated = await prisma.product.updateMany({
      where: { id, user_id: userId },
      data: {
        name,
        sku,
        barcode,
        gst_rate,
        price,
        cost,
        stock_on_hand,
        reorder_level,
        category_id,
      },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Product not found" });
    }

    return sendResponse(res, 200, { message: "Product updated" });
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

    return sendResponse(res, 200, { message: "Product removed" });
  }
}

export default ProductsController;
