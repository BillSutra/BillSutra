import { Prisma } from "@prisma/client";
import { applyInventoryDelta } from "./inventoryValidation.service.js";

type TransactionClient = Prisma.TransactionClient;
type BillingProductRecord = Awaited<
  ReturnType<TransactionClient["product"]["findMany"]>
>[number];

export type BillingInventoryItemInput = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
  gst_type?: "CGST_SGST" | "IGST" | "NONE" | null;
};

export type BillingInventoryResolvedItem = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  nonInventoryItem: boolean;
  tax_rate?: number | null;
  gst_type?: "CGST_SGST" | "IGST" | "NONE" | null;
};

export type BillingInventorySettings = {
  allowNegativeStock: boolean;
};

export type BillingInventorySchemaSupport = {
  allowNegativeStockPreference: boolean;
  invoiceItemNonInventoryFlag: boolean;
  saleItemNonInventoryFlag: boolean;
};

const DEFAULT_WAREHOUSE_NAME = "Main Warehouse";
const DEFAULT_WAREHOUSE_LOCATION = "Auto-created for billing sync";
export const DEFAULT_BILLING_INVENTORY_SETTINGS: BillingInventorySettings = {
  allowNegativeStock: true,
};

const DEFAULT_BILLING_INVENTORY_SCHEMA_SUPPORT: BillingInventorySchemaSupport = {
  allowNegativeStockPreference: false,
  invoiceItemNonInventoryFlag: false,
  saleItemNonInventoryFlag: false,
};

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const createAppError = (message: string, status = 400) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

const toBilledQuantity = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
};

const logMissingBillingProduct = (params: {
  userId: number;
  itemName: string;
  requestedProductId?: number | null;
}) => {
  console.warn("[BillingInventorySync] Missing product referenced in billing", {
    userId: params.userId,
    itemName: params.itemName,
    requestedProductId: params.requestedProductId ?? null,
  });
};

export const getBillingInventorySettings = async (
  tx: TransactionClient,
  userId: number,
): Promise<BillingInventorySettings> => {
  const schemaSupport = await getBillingInventorySchemaSupport(tx);
  if (!schemaSupport.allowNegativeStockPreference) {
    return { ...DEFAULT_BILLING_INVENTORY_SETTINGS };
  }

  const preference = await tx.userPreference.findUnique({
    where: { user_id: userId },
    select: { allowNegativeStock: true },
  });

  return {
    allowNegativeStock:
      preference?.allowNegativeStock ??
      DEFAULT_BILLING_INVENTORY_SETTINGS.allowNegativeStock,
  };
};

export const getBillingInventorySchemaSupport = async (
  tx: TransactionClient,
): Promise<BillingInventorySchemaSupport> => {
  const rows = await tx.$queryRaw<
    Array<{ table_name: string; column_name: string }>
  >(Prisma.sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'user_preferences' AND column_name = 'allow_negative_stock')
        OR (table_name = 'invoice_items' AND column_name = 'non_inventory_item')
        OR (table_name = 'sale_items' AND column_name = 'non_inventory_item')
      )
  `);

  const availableColumns = new Set(
    rows.map((row) => `${row.table_name}.${row.column_name}`),
  );

  return {
    allowNegativeStockPreference: availableColumns.has(
      "user_preferences.allow_negative_stock",
    ),
    invoiceItemNonInventoryFlag: availableColumns.has(
      "invoice_items.non_inventory_item",
    ),
    saleItemNonInventoryFlag: availableColumns.has("sale_items.non_inventory_item"),
  };
};

export const resolveBillingWarehouse = async (
  tx: TransactionClient,
  userId: number,
  preferredWarehouseId?: number | null,
) => {
  if (preferredWarehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: preferredWarehouseId, user_id: userId },
    });

    if (!warehouse) {
      throw createAppError("Warehouse not found.", 404);
    }

    return warehouse;
  }

  const existingWarehouse = await tx.warehouse.findFirst({
    where: { user_id: userId },
    orderBy: { created_at: "asc" },
  });

  if (existingWarehouse) {
    return existingWarehouse;
  }

  return tx.warehouse.create({
    data: {
      user_id: userId,
      name: DEFAULT_WAREHOUSE_NAME,
      location: DEFAULT_WAREHOUSE_LOCATION,
    },
  });
};

export const resolveBillingProducts = async (
  tx: TransactionClient,
  userId: number,
  items: BillingInventoryItemInput[],
): Promise<BillingInventoryResolvedItem[]> => {
  const productIdSet = new Set<number>();
  items.forEach((item) => {
    const value = item.product_id;
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      productIdSet.add(value);
    }
  });
  const productIds = Array.from(productIdSet);

  const productsById = new Map(
    (
      await tx.product.findMany({
        where: { user_id: userId, id: { in: productIds } },
      })
    ).map((product) => [product.id, product]),
  );

  const unresolvedNameMap = new Map<string, string>();
  items.forEach((item) => {
    const trimmedName = item.name.trim();
    if (!trimmedName) {
      return;
    }

    const key = normalizeName(trimmedName);
    if (!productsById.has(item.product_id ?? -1) && !unresolvedNameMap.has(key)) {
      unresolvedNameMap.set(key, trimmedName);
    }
  });

  const existingByName = new Map<string, BillingProductRecord>();
  if (unresolvedNameMap.size > 0) {
    const nameQueries = Array.from(unresolvedNameMap.values()).map((name) => ({
      name: {
        equals: name,
        mode: "insensitive" as const,
      },
    }));

    const matchedProducts = await tx.product.findMany({
      where: {
        user_id: userId,
        OR: nameQueries,
      },
    });

    matchedProducts.forEach((product) => {
      const key = normalizeName(product.name);
      if (!existingByName.has(key)) {
        existingByName.set(key, product);
      }
    });
  }

  const resolvedItems: BillingInventoryResolvedItem[] = [];

  for (const item of items) {
    const trimmedName = item.name.trim();
    if (!trimmedName) {
      throw createAppError("Item name is required for billing inventory sync.", 422);
    }

    const billedQuantity = toBilledQuantity(item.quantity);
    if (billedQuantity <= 0) {
      throw createAppError(
        `Invalid billed quantity for "${trimmedName}".`,
        422,
      );
    }

    let product =
      (item.product_id ? productsById.get(item.product_id) : undefined) ??
      existingByName.get(normalizeName(trimmedName));

    if (!product) {
      logMissingBillingProduct({
        userId,
        itemName: trimmedName,
        requestedProductId: item.product_id,
      });

      resolvedItems.push({
        product_id: null,
        name: trimmedName,
        quantity: billedQuantity,
        price: item.price,
        nonInventoryItem: true,
        tax_rate: item.tax_rate ?? undefined,
        gst_type: item.gst_type ?? undefined,
      });

      continue;
    }

    resolvedItems.push({
      product_id: product.id,
      name: trimmedName || product.name,
      quantity: billedQuantity,
      price: item.price,
      nonInventoryItem: false,
      tax_rate: item.tax_rate ?? undefined,
      gst_type: item.gst_type ?? undefined,
    });
  }

  return resolvedItems;
};

export const applyBillingSaleInventoryAdjustments = async (params: {
  tx: TransactionClient;
  warehouseId: number;
  items: BillingInventoryResolvedItem[];
  allowNegativeStock?: boolean;
  referenceId: number | string;
  referenceType: "invoice" | "sale";
}) => {
  const {
    tx,
    warehouseId,
    items,
    allowNegativeStock = DEFAULT_BILLING_INVENTORY_SETTINGS.allowNegativeStock,
    referenceId,
    referenceType,
  } = params;

  for (const item of items) {
    if (!item.product_id || item.nonInventoryItem) {
      continue;
    }

    try {
      await applyInventoryDelta({
        tx,
        productId: item.product_id,
        warehouseId,
        delta: -item.quantity,
        allowNegativeStock,
        reason: "SALE",
        note: JSON.stringify({
          type: "sale",
          warehouseId,
          referenceType,
          referenceId,
          quantity: item.quantity,
        }),
      });
    } catch (error) {
      if (
        !allowNegativeStock &&
        error instanceof Error &&
        ("statusCode" in error || "status" in error)
      ) {
        throw createAppError(`Insufficient stock for "${item.name}".`, 409);
      }

      throw error;
    }
  }
};

export const restoreBillingSaleInventoryAdjustments = async (params: {
  tx: TransactionClient;
  warehouseId: number;
  items: BillingInventoryResolvedItem[];
  referenceId: number | string;
  referenceType: "invoice" | "sale";
}) => {
  const { tx, warehouseId, items, referenceId, referenceType } = params;

  for (const item of items) {
    if (!item.product_id || item.nonInventoryItem) {
      continue;
    }

    await applyInventoryDelta({
      tx,
      productId: item.product_id,
      warehouseId,
      delta: item.quantity,
      allowNegativeStock: true,
      reason: "RETURN",
      note: JSON.stringify({
        type: "stock_restore",
        warehouseId,
        referenceType,
        referenceId,
        quantity: item.quantity,
      }),
    });
  }
};
