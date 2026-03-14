import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import prisma from "../config/db.config.js";
import {
  userSavedTemplateCreateSchema,
  userSavedTemplateUpdateSchema,
} from "../validations/apiValidations.js";

type UserSavedTemplateCreateInput = z.infer<
  typeof userSavedTemplateCreateSchema
>;
type UserSavedTemplateUpdateInput = z.infer<
  typeof userSavedTemplateUpdateSchema
>;

class UserSavedTemplateController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const records = await prisma.userSavedTemplate.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" },
    });

    return sendResponse(res, 200, { data: records });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: UserSavedTemplateCreateInput = req.body;

    const record = await prisma.userSavedTemplate.create({
      data: {
        user_id: userId,
        name: body.name,
        base_template_id: body.base_template_id,
        enabled_sections: body.enabled_sections,
        section_order: body.section_order,
        theme_color: body.theme_color,
        design_config: body.design_config as Prisma.InputJsonValue | undefined,
      },
    });

    return sendResponse(res, 201, {
      message: "Saved template created",
      data: record,
    });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: UserSavedTemplateUpdateInput = req.body;

    const existing = await prisma.userSavedTemplate.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });

    if (!existing) {
      return sendResponse(res, 404, { message: "Saved template not found" });
    }

    const record = await prisma.userSavedTemplate.update({
      where: { id },
      data: {
        name: body.name,
        base_template_id: body.base_template_id,
        enabled_sections: body.enabled_sections,
        section_order: body.section_order,
        theme_color: body.theme_color,
        design_config: body.design_config as Prisma.InputJsonValue | undefined,
      },
    });

    return sendResponse(res, 200, {
      message: "Saved template updated",
      data: record,
    });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);

    const existing = await prisma.userSavedTemplate.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    });

    if (!existing) {
      return sendResponse(res, 404, { message: "Saved template not found" });
    }

    await prisma.userSavedTemplate.delete({ where: { id } });

    return sendResponse(res, 200, { message: "Saved template deleted" });
  }
}

export default UserSavedTemplateController;
