import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { sendResponse } from "../utils/sendResponse.js";
import type { z } from "zod";
import prisma from "../config/db.config.js";
import { ensureBusinessForUser } from "../lib/authSession.js";
import {
  formatBusinessAddress,
  normalizeBusinessAddressDraft,
  parseLegacyBusinessAddress,
} from "../lib/indianAddress.js";
import { businessProfileUpsertSchema } from "../validations/apiValidations.js";

type BusinessProfileInput = z.infer<typeof businessProfileUpsertSchema>;

type BusinessProfileRecordForResponse = {
  address: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  [key: string]: unknown;
};

const legacyProfileSelect = {
  id: true,
  user_id: true,
  business_name: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  logo_url: true,
  tax_id: true,
  currency: true,
  show_logo_on_invoice: true,
  show_tax_number: true,
  show_payment_qr: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.BusinessProfileSelect;

const structuredProfileSelect = {
  ...legacyProfileSelect,
  address_line1: true,
  city: true,
  state: true,
  pincode: true,
} satisfies Prisma.BusinessProfileSelect;

const isBusinessProfileSchemaMismatchError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === "P2021" || error.code === "P2022";
};

const resolveStructuredAddress = (input: BusinessProfileInput) => {
  const nestedAddress = normalizeBusinessAddressDraft(input.businessAddress);
  const topLevelAddress = normalizeBusinessAddressDraft({
    addressLine1: input.address_line1,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  });
  const legacyParsedAddress = parseLegacyBusinessAddress(input.address);

  return normalizeBusinessAddressDraft({
    addressLine1:
      nestedAddress.addressLine1 ??
      topLevelAddress.addressLine1 ??
      legacyParsedAddress.addressLine1,
    city:
      nestedAddress.city ?? topLevelAddress.city ?? legacyParsedAddress.city,
    state:
      nestedAddress.state ?? topLevelAddress.state ?? legacyParsedAddress.state,
    pincode:
      nestedAddress.pincode ??
      topLevelAddress.pincode ??
      legacyParsedAddress.pincode,
  });
};

const serializeProfile = (profile: BusinessProfileRecordForResponse | null) => {
  if (!profile) {
    return null;
  }

  const structuredAddress = normalizeBusinessAddressDraft({
    addressLine1: profile.address_line1 ?? undefined,
    city: profile.city ?? undefined,
    state: profile.state ?? undefined,
    pincode: profile.pincode ?? undefined,
  });
  const legacyAddress = parseLegacyBusinessAddress(profile.address);

  const businessAddress = {
    addressLine1:
      structuredAddress.addressLine1 ?? legacyAddress.addressLine1 ?? "",
    city: structuredAddress.city ?? legacyAddress.city ?? "",
    state: structuredAddress.state ?? legacyAddress.state ?? "",
    pincode: structuredAddress.pincode ?? legacyAddress.pincode ?? "",
  };

  return {
    ...profile,
    businessAddress,
  };
};

class BusinessProfileController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    let profile: BusinessProfileRecordForResponse | null;

    try {
      profile = await prisma.businessProfile.findUnique({
        where: { user_id: userId },
        select: structuredProfileSelect,
      });
    } catch (error) {
      if (!isBusinessProfileSchemaMismatchError(error)) {
        throw error;
      }

      profile = await prisma.businessProfile.findUnique({
        where: { user_id: userId },
        select: legacyProfileSelect,
      });
    }

    return sendResponse(res, 200, { data: serializeProfile(profile) });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: BusinessProfileInput = req.body;
    const structuredAddress = resolveStructuredAddress(body);
    const legacyAddress = formatBusinessAddress(
      structuredAddress,
      body.address,
    );

    const legacyUpdatePayload = {
      business_name: body.business_name,
      address: legacyAddress,
      phone: body.phone,
      email: body.email,
      website: body.website,
      logo_url: body.logo_url,
      tax_id: body.tax_id,
      currency: body.currency,
      show_logo_on_invoice: body.show_logo_on_invoice,
      show_tax_number: body.show_tax_number,
      show_payment_qr: body.show_payment_qr,
    };

    const legacyCreatePayload = {
      user_id: userId,
      business_name: body.business_name,
      address: legacyAddress,
      phone: body.phone,
      email: body.email,
      website: body.website,
      logo_url: body.logo_url,
      tax_id: body.tax_id,
      currency: body.currency,
      show_logo_on_invoice: body.show_logo_on_invoice ?? true,
      show_tax_number: body.show_tax_number ?? true,
      show_payment_qr: body.show_payment_qr ?? false,
    };

    let profile: BusinessProfileRecordForResponse | null;

    try {
      profile = await prisma.businessProfile.upsert({
        where: { user_id: userId },
        update: {
          ...legacyUpdatePayload,
          address_line1: structuredAddress.addressLine1 ?? null,
          city: structuredAddress.city ?? null,
          state: structuredAddress.state ?? null,
          pincode: structuredAddress.pincode ?? null,
        },
        create: {
          ...legacyCreatePayload,
          address_line1: structuredAddress.addressLine1 ?? null,
          city: structuredAddress.city ?? null,
          state: structuredAddress.state ?? null,
          pincode: structuredAddress.pincode ?? null,
        },
        select: structuredProfileSelect,
      });
    } catch (error) {
      if (!isBusinessProfileSchemaMismatchError(error)) {
        throw error;
      }

      profile = await prisma.businessProfile.upsert({
        where: { user_id: userId },
        update: legacyUpdatePayload,
        create: legacyCreatePayload,
        select: legacyProfileSelect,
      });
    }

    await ensureBusinessForUser(userId, body.business_name);

    return sendResponse(res, 200, {
      message: "Profile saved",
      data: serializeProfile(profile),
    });
  }
}

export default BusinessProfileController;
