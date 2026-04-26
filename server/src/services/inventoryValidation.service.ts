import { Prisma } from "@prisma/client";
import type { StockReason } from "@prisma/client";
import AppError from "../utils/AppError.js";
import {
  resolveInventoryIssuesForProduct,
  upsertInventoryIssue,
} from "./inventoryIssue.service.js";

type TransactionClient = Prisma.TransactionClient;

const toWholeQuantity = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
};

const lockProductRow = async (tx: TransactionClient, productId: number) => {
  const rows = await tx.$queryRaw<Array<{ id: number; stock_on_hand: number }>>(
    Prisma.sql`
      SELECT id, stock_on_hand
      FROM "products"
      WHERE id = ${productId}
      FOR UPDATE
    `,
  );

  return rows[0] ?? null;
};

const lockInventoryRow = async (
  tx: TransactionClient,
  warehouseId: number,
  productId: number,
) => {
  const rows = await tx.$queryRaw<
    Array<{ id: number; quantity: number }>
  >(
    Prisma.sql`
      SELECT id, quantity
      FROM "inventories"
      WHERE warehouse_id = ${warehouseId}
        AND product_id = ${productId}
      FOR UPDATE
    `,
  );

  return rows[0] ?? null;
};

export const parseWarehouseIdFromNote = (note?: string | null) => {
  const match = note?.match(/Warehouse\s+(\d+)/i);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const applyInventoryDelta = async (params: {
  tx: TransactionClient;
  productId: number;
  warehouseId?: number | null;
  delta: number;
  allowNegativeStock?: boolean;
  reason: StockReason;
  note?: string | null;
}) => {
  const {
    tx,
    productId,
    warehouseId,
    delta,
    allowNegativeStock = false,
    reason,
    note,
  } = params;

  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError("Quantity change must be a non-zero whole number.", 400);
  }

  const productRow = await lockProductRow(tx, productId);
  if (!productRow) {
    throw new AppError("Product not found", 404);
  }

  const currentProductQuantity = toWholeQuantity(productRow.stock_on_hand);
  const nextProductQuantity = currentProductQuantity + delta;

  // Positive adjustments like purchases should always be able to recover
  // existing negative stock. We only block deductions that would push stock
  // further below zero when negative stock is not allowed.
  if (!allowNegativeStock && delta < 0 && nextProductQuantity < 0) {
    throw new AppError("Not enough quantity available", 409);
  }

  let nextInventoryQuantity: number | null = null;
  let currentInventoryQuantity: number | null = null;

  if (warehouseId) {
    const inventoryRow = await lockInventoryRow(tx, warehouseId, productId);
    currentInventoryQuantity = toWholeQuantity(inventoryRow?.quantity ?? 0);
    nextInventoryQuantity = currentInventoryQuantity + delta;

    if (!allowNegativeStock && delta < 0 && nextInventoryQuantity < 0) {
      throw new AppError("Not enough stock available", 409);
    }

    await tx.inventory.upsert({
      where: {
        warehouse_id_product_id: {
          warehouse_id: warehouseId,
          product_id: productId,
        },
      },
      update: {
        quantity: nextInventoryQuantity,
      },
      create: {
        warehouse_id: warehouseId,
        product_id: productId,
        quantity: nextInventoryQuantity,
      },
    });
  }

  await tx.product.update({
    where: { id: productId },
    data: { stock_on_hand: nextProductQuantity },
  });

  await tx.stockMovement.create({
    data: {
      product_id: productId,
      change: delta,
      reason,
      note: note ?? undefined,
    },
  });

  if (delta < 0 && nextProductQuantity < 0) {
    await upsertInventoryIssue({
      tx,
      productId,
      type: "NEGATIVE_AFTER_SALE",
      quantity: Math.abs(nextProductQuantity),
      metadata: {
        warehouseId: warehouseId ?? null,
        reason,
        note: note ?? null,
        stockOnHand: nextProductQuantity,
        inventoryQuantity: nextInventoryQuantity,
      },
    });
  }

  if (delta > 0 && currentProductQuantity < 0) {
    await upsertInventoryIssue({
      tx,
      productId,
      type: "NEGATIVE_BEFORE_PURCHASE",
      quantity: Math.abs(currentProductQuantity),
      metadata: {
        warehouseId: warehouseId ?? null,
        reason,
        note: note ?? null,
        stockOnHandBeforePurchase: currentProductQuantity,
        stockOnHandAfterPurchase: nextProductQuantity,
        inventoryQuantityBeforePurchase: currentInventoryQuantity,
        inventoryQuantityAfterPurchase: nextInventoryQuantity,
      },
    });
  }

  if (nextProductQuantity >= 0) {
    await resolveInventoryIssuesForProduct({
      tx,
      productId,
      types: ["NEGATIVE_AFTER_SALE", "NEGATIVE_BEFORE_PURCHASE"],
    });
  }

  return {
    productId,
    warehouseId: warehouseId ?? null,
    stockOnHand: nextProductQuantity,
    inventoryQuantity: nextInventoryQuantity,
    issueDetected: nextProductQuantity < 0,
  };
};
