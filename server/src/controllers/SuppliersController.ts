import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { sendResponse } from "../utils/sendResponse.js";
import prisma from "../config/db.config.js";
import type { z } from "zod";
import {
  supplierCreateSchema,
  supplierUpdateSchema,
} from "../validations/apiValidations.js";
import {
  formatBusinessAddress,
  normalizeBusinessAddressDraft,
  parseLegacyBusinessAddress,
} from "../lib/indianAddress.js";
import { normalizeGstin } from "../lib/gstin.js";
import {
  encryptSensitiveValue,
  maybeDecryptSensitiveValue,
} from "../lib/fieldEncryption.js";

type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

type SupplierPaymentTerms = "NET_7" | "NET_15" | "NET_30";

type SupplierBaseRecord = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
};

type SupplierExtendedFields = {
  id: number;
  categories: unknown;
  business_name: string | null;
  gstin: string | null;
  pan: string | null;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  payment_terms: string | null;
  opening_balance: unknown;
  notes: string | null;
};

type SupplierExtendedFieldsLegacy = Omit<SupplierExtendedFields, "categories">;

const supplierBaseSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  created_at: true,
  updated_at: true,
} satisfies Prisma.SupplierSelect;

const toNumber = (value: unknown) => Number(value ?? 0);

const roundAmount = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toNullableString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeSupplierGstinValue = (value: unknown) => {
  const decrypted = maybeDecryptSensitiveValue(toNullableString(value));
  return decrypted ? normalizeGstin(decrypted) : null;
};

const normalizeSupplierPanValue = (value: unknown) =>
  maybeDecryptSensitiveValue(toNullableString(value))?.toUpperCase() ?? null;

const normalizePaymentTerms = (value: unknown): SupplierPaymentTerms | null => {
  if (value === "NET_7" || value === "NET_15" || value === "NET_30") {
    return value;
  }

  return null;
};

const normalizeSupplierCategories = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique: string[] = [];
  const seen = new Set<string>();

  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }

    const normalized = entry.replace(/\s+/g, " ").trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(normalized.slice(0, 60));
  });

  return unique;
};

const isSupplierSchemaMismatchError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return true;
    }

    if (error.code === "P2010") {
      const code = (error.meta as { code?: string } | undefined)?.code;
      return code === "42703" || code === "42P01";
    }
  }

  if (error instanceof Error) {
    return (
      /business_name/i.test(error.message) ||
      /categories/i.test(error.message) ||
      /opening_balance/i.test(error.message) ||
      /payment_terms/i.test(error.message) ||
      /address_line1/i.test(error.message)
    );
  }

  return false;
};

const loadExtendedSupplierFields = async (
  userId: number,
  supplierIds: number[],
) => {
  if (!supplierIds.length) {
    return new Map<number, SupplierExtendedFields>();
  }

  try {
    const rows = await prisma.$queryRaw<SupplierExtendedFields[]>(Prisma.sql`
      SELECT
        id,
        categories,
        business_name,
        gstin,
        pan,
        address_line1,
        city,
        state,
        pincode,
        payment_terms,
        opening_balance,
        notes
      FROM "suppliers"
      WHERE user_id = ${userId}
        AND id IN (${Prisma.join(supplierIds)})
    `);

    return new Map(rows.map((row) => [row.id, row]));
  } catch (error) {
    if (isSupplierSchemaMismatchError(error)) {
      try {
        const fallbackRows = await prisma.$queryRaw<
          SupplierExtendedFieldsLegacy[]
        >(Prisma.sql`
          SELECT
            id,
            business_name,
            gstin,
            pan,
            address_line1,
            city,
            state,
            pincode,
            payment_terms,
            opening_balance,
            notes
          FROM "suppliers"
          WHERE user_id = ${userId}
            AND id IN (${Prisma.join(supplierIds)})
        `);

        return new Map(
          fallbackRows.map((row) => [
            row.id,
            {
              ...row,
              categories: [],
            } satisfies SupplierExtendedFields,
          ]),
        );
      } catch (fallbackError) {
        if (isSupplierSchemaMismatchError(fallbackError)) {
          return new Map<number, SupplierExtendedFields>();
        }

        throw fallbackError;
      }
    }

    throw error;
  }
};

const loadSupplierPendingAmounts = async (
  userId: number,
  supplierIds: number[],
) => {
  if (!supplierIds.length) {
    return new Map<number, number>();
  }

  const rows = await prisma.purchase.groupBy({
    by: ["supplier_id"],
    where: {
      user_id: userId,
      supplier_id: { in: supplierIds },
    },
    _sum: {
      pendingAmount: true,
    },
  });

  const pendingMap = new Map<number, number>();
  rows.forEach((row) => {
    if (row.supplier_id !== null) {
      pendingMap.set(row.supplier_id, toNumber(row._sum.pendingAmount));
    }
  });

  return pendingMap;
};

const persistExtendedSupplierFields = async (
  userId: number,
  supplierId: number,
  payload: {
    categories: string[];
    business_name: string | null;
    gstin: string | null;
    pan: string | null;
    address_line1: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    payment_terms: SupplierPaymentTerms | null;
    opening_balance: number;
    notes: string | null;
  },
) => {
  try {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "suppliers"
      SET
        categories = ${payload.categories},
        business_name = ${payload.business_name},
        gstin = ${payload.gstin},
        pan = ${payload.pan},
        address_line1 = ${payload.address_line1},
        city = ${payload.city},
        state = ${payload.state},
        pincode = ${payload.pincode},
        payment_terms = ${payload.payment_terms},
        opening_balance = ${payload.opening_balance},
        notes = ${payload.notes}
      WHERE id = ${supplierId}
        AND user_id = ${userId}
    `);
  } catch (error) {
    if (isSupplierSchemaMismatchError(error)) {
      try {
        await prisma.$executeRaw(Prisma.sql`
          UPDATE "suppliers"
          SET
            business_name = ${payload.business_name},
            gstin = ${payload.gstin},
            pan = ${payload.pan},
            address_line1 = ${payload.address_line1},
            city = ${payload.city},
            state = ${payload.state},
            pincode = ${payload.pincode},
            payment_terms = ${payload.payment_terms},
            opening_balance = ${payload.opening_balance},
            notes = ${payload.notes}
          WHERE id = ${supplierId}
            AND user_id = ${userId}
        `);
        return;
      } catch (fallbackError) {
        if (isSupplierSchemaMismatchError(fallbackError)) {
          return;
        }

        throw fallbackError;
      }
    }

    throw error;
  }
};

const resolveSupplierAddress = (
  input: Partial<SupplierCreateInput & SupplierUpdateInput>,
  fallback?: {
    address?: string | null;
    address_line1?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  },
) => {
  const nestedAddress = normalizeBusinessAddressDraft(input.supplierAddress);
  const topLevelAddress = normalizeBusinessAddressDraft({
    addressLine1: input.address_line1,
    city: input.city,
    state: input.state,
    pincode: input.pincode,
  });
  const inputLegacyAddress = parseLegacyBusinessAddress(input.address);
  const fallbackAddress = normalizeBusinessAddressDraft({
    addressLine1: fallback?.address_line1 ?? undefined,
    city: fallback?.city ?? undefined,
    state: fallback?.state ?? undefined,
    pincode: fallback?.pincode ?? undefined,
  });
  const fallbackLegacyAddress = parseLegacyBusinessAddress(fallback?.address);

  return normalizeBusinessAddressDraft({
    addressLine1:
      nestedAddress.addressLine1 ??
      topLevelAddress.addressLine1 ??
      inputLegacyAddress.addressLine1 ??
      fallbackAddress.addressLine1 ??
      fallbackLegacyAddress.addressLine1,
    city:
      nestedAddress.city ??
      topLevelAddress.city ??
      inputLegacyAddress.city ??
      fallbackAddress.city ??
      fallbackLegacyAddress.city,
    state:
      nestedAddress.state ??
      topLevelAddress.state ??
      inputLegacyAddress.state ??
      fallbackAddress.state ??
      fallbackLegacyAddress.state,
    pincode:
      nestedAddress.pincode ??
      topLevelAddress.pincode ??
      inputLegacyAddress.pincode ??
      fallbackAddress.pincode ??
      fallbackLegacyAddress.pincode,
  });
};

const serializeSupplier = (
  supplier: SupplierBaseRecord,
  extended?: SupplierExtendedFields,
  pendingAmount = 0,
) => {
  const parsedLegacyAddress = parseLegacyBusinessAddress(supplier.address);
  const normalizedAddress = normalizeBusinessAddressDraft({
    addressLine1: extended?.address_line1 ?? parsedLegacyAddress.addressLine1,
    city: extended?.city ?? parsedLegacyAddress.city,
    state: extended?.state ?? parsedLegacyAddress.state,
    pincode: extended?.pincode ?? parsedLegacyAddress.pincode,
  });

  const businessName = toNullableString(extended?.business_name);
  const categories = normalizeSupplierCategories(extended?.categories);
  const gstin = normalizeSupplierGstinValue(extended?.gstin);
  const pan = normalizeSupplierPanValue(extended?.pan);
  const paymentTerms = normalizePaymentTerms(extended?.payment_terms);
  const openingBalance = roundAmount(
    Math.max(toNumber(extended?.opening_balance ?? 0), 0),
  );
  const outstandingBalance = roundAmount(
    Math.max(openingBalance + Math.max(pendingAmount, 0), 0),
  );

  return {
    id: supplier.id,
    name: supplier.name,
    email: supplier.email,
    phone: supplier.phone,
    address: formatBusinessAddress(normalizedAddress, supplier.address),
    categories,
    businessName,
    business_name: businessName,
    gstin: gstin ? normalizeGstin(gstin) : null,
    pan,
    supplierAddress: {
      addressLine1: normalizedAddress.addressLine1 ?? "",
      city: normalizedAddress.city ?? "",
      state: normalizedAddress.state ?? "",
      pincode: normalizedAddress.pincode ?? "",
    },
    address_line1: normalizedAddress.addressLine1 ?? null,
    city: normalizedAddress.city ?? null,
    state: normalizedAddress.state ?? null,
    pincode: normalizedAddress.pincode ?? null,
    paymentTerms,
    payment_terms: paymentTerms,
    openingBalance,
    opening_balance: openingBalance,
    notes: toNullableString(extended?.notes),
    outstandingBalance,
    outstanding_balance: outstandingBalance,
    created_at: supplier.created_at,
    updated_at: supplier.updated_at,
  };
};

class SuppliersController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { user_id: userId },
      select: supplierBaseSelect,
      orderBy: { created_at: "desc" },
    });

    const supplierIds = suppliers.map((supplier) => supplier.id);
    const [extendedMap, pendingMap] = await Promise.all([
      loadExtendedSupplierFields(userId, supplierIds),
      loadSupplierPendingAmounts(userId, supplierIds),
    ]);

    const serializedSuppliers = suppliers.map((supplier) =>
      serializeSupplier(
        supplier,
        extendedMap.get(supplier.id),
        pendingMap.get(supplier.id) ?? 0,
      ),
    );

    return sendResponse(res, 200, { data: serializedSuppliers });
  }

  static async store(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const body: SupplierCreateInput = req.body;
    const structuredAddress = resolveSupplierAddress(body);
    const legacyAddress = formatBusinessAddress(
      structuredAddress,
      body.address,
    );

    const supplier = await prisma.supplier.create({
      data: {
        user_id: userId,
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        address: legacyAddress,
      },
      select: supplierBaseSelect,
    });

    await persistExtendedSupplierFields(userId, supplier.id, {
      categories: normalizeSupplierCategories(body.categories),
      business_name: toNullableString(body.businessName ?? body.business_name),
      gstin: encryptSensitiveValue(normalizeSupplierGstinValue(body.gstin)),
      pan: encryptSensitiveValue(normalizeSupplierPanValue(body.pan)),
      address_line1: structuredAddress.addressLine1 ?? null,
      city: structuredAddress.city ?? null,
      state: structuredAddress.state ?? null,
      pincode: structuredAddress.pincode ?? null,
      payment_terms:
        normalizePaymentTerms(body.paymentTerms ?? body.payment_terms) ??
        "NET_15",
      opening_balance: roundAmount(
        Math.max(toNumber(body.openingBalance ?? body.opening_balance ?? 0), 0),
      ),
      notes: toNullableString(body.notes),
    });

    const [extendedMap, pendingMap] = await Promise.all([
      loadExtendedSupplierFields(userId, [supplier.id]),
      loadSupplierPendingAmounts(userId, [supplier.id]),
    ]);

    return sendResponse(res, 201, {
      message: "Supplier created",
      data: serializeSupplier(
        supplier,
        extendedMap.get(supplier.id),
        pendingMap.get(supplier.id) ?? 0,
      ),
    });
  }

  static async show(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const supplier = await prisma.supplier.findFirst({
      where: { id, user_id: userId },
      select: supplierBaseSelect,
    });

    if (!supplier) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    const [extendedMap, pendingMap, purchases] = await Promise.all([
      loadExtendedSupplierFields(userId, [supplier.id]),
      loadSupplierPendingAmounts(userId, [supplier.id]),
      prisma.purchase.findMany({
        where: { user_id: userId, supplier_id: supplier.id },
        include: { items: true, warehouse: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return sendResponse(res, 200, {
      data: {
        ...serializeSupplier(
          supplier,
          extendedMap.get(supplier.id),
          pendingMap.get(supplier.id) ?? 0,
        ),
        purchases,
      },
    });
  }

  static async update(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const body: SupplierUpdateInput = req.body;

    const existing = await prisma.supplier.findFirst({
      where: { id, user_id: userId },
      select: supplierBaseSelect,
    });

    if (!existing) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    const existingExtendedMap = await loadExtendedSupplierFields(userId, [id]);
    const existingExtended = existingExtendedMap.get(id);

    const structuredAddress = resolveSupplierAddress(body, {
      address: existing.address,
      address_line1: existingExtended?.address_line1 ?? null,
      city: existingExtended?.city ?? null,
      state: existingExtended?.state ?? null,
      pincode: existingExtended?.pincode ?? null,
    });

    const legacyAddress = formatBusinessAddress(
      structuredAddress,
      body.address ?? existing.address,
    );

    const updated = await prisma.supplier.updateMany({
      where: { id, user_id: userId },
      data: {
        name: body.name ?? existing.name,
        email: body.email ?? existing.email,
        phone: body.phone ?? existing.phone,
        address: legacyAddress,
      },
    });

    if (!updated.count) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    await persistExtendedSupplierFields(userId, id, {
      categories: normalizeSupplierCategories(
        body.categories ?? existingExtended?.categories,
      ),
      business_name: toNullableString(
        body.businessName ??
          body.business_name ??
          existingExtended?.business_name,
      ),
      gstin: encryptSensitiveValue(
        normalizeSupplierGstinValue(body.gstin ?? existingExtended?.gstin),
      ),
      pan: encryptSensitiveValue(
        normalizeSupplierPanValue(body.pan ?? existingExtended?.pan),
      ),
      address_line1: structuredAddress.addressLine1 ?? null,
      city: structuredAddress.city ?? null,
      state: structuredAddress.state ?? null,
      pincode: structuredAddress.pincode ?? null,
      payment_terms: normalizePaymentTerms(
        body.paymentTerms ??
          body.payment_terms ??
          existingExtended?.payment_terms,
      ),
      opening_balance: roundAmount(
        Math.max(
          toNumber(
            body.openingBalance ??
              body.opening_balance ??
              existingExtended?.opening_balance ??
              0,
          ),
          0,
        ),
      ),
      notes: toNullableString(body.notes ?? existingExtended?.notes),
    });

    return sendResponse(res, 200, { message: "Supplier updated" });
  }

  static async destroy(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const deleted = await prisma.supplier.deleteMany({
      where: { id, user_id: userId },
    });

    if (!deleted.count) {
      return sendResponse(res, 404, { message: "Supplier not found" });
    }

    return sendResponse(res, 200, { message: "Supplier removed" });
  }
}

export default SuppliersController;
