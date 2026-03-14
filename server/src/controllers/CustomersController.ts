import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import { getTotalPages, parsePagination } from "../utils/pagination.js";
import type { z } from "zod";
import {
  customerCreateSchema,
  customerUpdateSchema,
} from "../validations/apiValidations.js";

type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

class CustomersController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const { page, limit, skip } = parsePagination({
      page: req.query.page,
      limit: req.query.limit,
    });

    const where = { user_id: userId };
    const [items, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return sendResponse(res, 200, {
      data: {
        items,
        total,
        page,
        totalPages: getTotalPages(total, limit),
      },
    });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: CustomerCreateInput = req.body;
    const { name, email, phone, address } = body;

    const customer = await prisma.customer.create({
      data: {
        user_id: userId,
        name,
        email,
        phone,
        address,
      },
    });

    return sendResponse(res, 201, {
      message: "Customer created",
      data: customer,
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const customer = await prisma.customer.findFirst({
      where: { id, user_id: userId },
    });

    if (!customer) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { data: customer });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: CustomerUpdateInput = req.body;
    const { name, email, phone, address } = body;

    const updated = await prisma.customer.updateMany({
      where: { id, user_id: userId },
      data: { name, email, phone, address },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { message: "Customer updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.customer.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Customer not found" });
    }

    return sendResponse(res, 200, { message: "Customer removed" });
  }
}

export default CustomersController;
