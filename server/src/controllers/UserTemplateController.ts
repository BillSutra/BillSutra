import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { userTemplateUpsertSchema } from "../validations/apiValidations.js";

type UserTemplateInput = z.infer<typeof userTemplateUpsertSchema>;

const toInputJsonValue = (
  value: UserTemplateInput["design_config"],
): Prisma.InputJsonValue | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
};

class UserTemplateController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const templateId = req.query.template_id
      ? Number(req.query.template_id)
      : null;

    if (templateId) {
      const setting = await prisma.userTemplate.findUnique({
        where: {
          user_id_template_id: { user_id: userId, template_id: templateId },
        },
      });
      return sendResponse(res, 200, { data: setting });
    }

    const settings = await prisma.userTemplate.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" },
    });

    return sendResponse(res, 200, { data: settings });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: UserTemplateInput = req.body;
    const designConfig = toInputJsonValue(body.design_config);

    const templateSetting = await prisma.userTemplate.upsert({
      where: {
        user_id_template_id: { user_id: userId, template_id: body.template_id },
      },
      update: {
        enabled_sections: body.enabled_sections,
        theme_color: body.theme_color,
        section_order: body.section_order,
        design_config: designConfig,
      },
      create: {
        user_id: userId,
        template_id: body.template_id,
        enabled_sections: body.enabled_sections,
        theme_color: body.theme_color,
        section_order: body.section_order,
        design_config: designConfig,
      },
    });

    return sendResponse(res, 200, {
      message: "Template settings saved",
      data: templateSetting,
    });
  }
}

export default UserTemplateController;
