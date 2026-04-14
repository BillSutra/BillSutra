import { Prisma, StockReason } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;
type BillingProductRecord = Awaited<ReturnType<TransactionClient["product"]["create"]>>;

export type BillingInventoryItemInput = {
  product_id?: number | null;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
};

export type BillingInventoryResolvedItem = {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
  tax_rate?: number | null;
};

const DEFAULT_WAREHOUSE_NAME = "Main Warehouse";
const DEFAULT_WAREHOUSE_LOCATION = "Auto-created for billing sync";
const DEFAULT_GST_RATE = 18;

const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const createAppError = (message: string, status = 400) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

const buildAutoSku = (name: string, attempt: number) => {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  const suffix =
    attempt === 0
      ? timestamp
      : `${timestamp}${String(attempt).padStart(2, "0")}`;

  return `AUTO-${base || "ITEM"}-${suffix}`.slice(0, 191);
};

const createAutoProduct = async (
  tx: TransactionClient,
  userId: number,
  item: BillingInventoryItemInput,
) => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return await tx.product.create({
        data: {
          user_id: userId,
          name: item.name.trim(),
          sku: buildAutoSku(item.name, attempt),
          price: item.price,
          cost: item.price,
          gst_rate: item.tax_rate ?? DEFAULT_GST_RATE,
          stock_on_hand: 0,
          reorder_level: 0,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw createAppError("Unable to auto-create product for billing.", 500);
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
  options?: {
    autoCreateProducts?: boolean;
  },
): Promise<BillingInventoryResolvedItem[]> => {
  const autoCreateProducts = options?.autoCreateProducts !== false;
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

  const createdByName = new Map<string, BillingProductRecord>();

  const resolvedItems: BillingInventoryResolvedItem[] = [];

  for (const item of items) {
    const trimmedName = item.name.trim();
    if (!trimmedName) {
      throw createAppError("Item name is required for billing inventory sync.", 422);
    }

    let product =
      (item.product_id ? productsById.get(item.product_id) : undefined) ??
      existingByName.get(normalizeName(trimmedName));

    if (!product) {
      if (!autoCreateProducts) {
        throw createAppError(`Product "${trimmedName}" not found.`, 404);
      }

      const cacheKey = normalizeName(trimmedName);
      product = createdByName.get(cacheKey);
      if (!product) {
        product = await createAutoProduct(tx, userId, {
          ...item,
          name: trimmedName,
        });
        createdByName.set(cacheKey, product);
      }
    }

    resolvedItems.push({
      product_id: product.id,
      name: trimmedName || product.name,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.tax_rate ?? undefined,
    });
  }

  return resolvedItems;
};

export const applyBillingSaleInventoryAdjustments = async (params: {
  tx: TransactionClient;
  warehouseId: number;
  items: BillingInventoryResolvedItem[];
  referenceId: number | string;
  referenceType: "invoice" | "sale";
}) => {
  const { tx, warehouseId, items, referenceId, referenceType } = params;

  for (const item of items) {
    await tx.product.update({
      where: { id: item.product_id },
      data: { stock_on_hand: { decrement: item.quantity } },
    });

    await tx.inventory.upsert({
      where: {
        warehouse_id_product_id: {
          warehouse_id: warehouseId,
          product_id: item.product_id,
        },
      },
      update: { quantity: { decrement: item.quantity } },
      create: {
        warehouse_id: warehouseId,
        product_id: item.product_id,
        quantity: -item.quantity,
      },
    });

    await tx.stockMovement.create({
      data: {
        product_id: item.product_id,
        change: -item.quantity,
        reason: StockReason.SALE,
        note: JSON.stringify({
          type: "sale",
          warehouseId,
          referenceType,
          referenceId,
          quantity: item.quantity,
        }),
      },
    });
  }
};
