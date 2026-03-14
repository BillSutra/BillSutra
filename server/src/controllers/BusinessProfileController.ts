import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import type { z } from "zod";
import prisma from "../config/db.config.js";
import { businessProfileUpsertSchema } from "../validations/apiValidations.js";

type BusinessProfileInput = z.infer<typeof businessProfileUpsertSchema>;

class BusinessProfileController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const profile = await prisma.businessProfile.findUnique({
      where: { user_id: userId },
    });

    return sendResponse(res, 200, { data: profile });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: BusinessProfileInput = req.body;

    const profile = await prisma.businessProfile.upsert({
      where: { user_id: userId },
      update: {
        business_name: body.business_name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        website: body.website,
        logo_url: body.logo_url,
        tax_id: body.tax_id,
        currency: body.currency,
        show_logo_on_invoice: body.show_logo_on_invoice,
        show_tax_number: body.show_tax_number,
        show_payment_qr: body.show_payment_qr,
      },
      create: {
        user_id: userId,
        business_name: body.business_name,
        address: body.address,
        phone: body.phone,
        email: body.email,
        website: body.website,
        logo_url: body.logo_url,
        tax_id: body.tax_id,
        currency: body.currency,
        show_logo_on_invoice: body.show_logo_on_invoice ?? true,
        show_tax_number: body.show_tax_number ?? true,
        show_payment_qr: body.show_payment_qr ?? false,
      },
    });

    return sendResponse(res, 200, { message: "Profile saved", data: profile });
  }
}

export default BusinessProfileController;
