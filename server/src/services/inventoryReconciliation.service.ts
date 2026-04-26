import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import {
  syncInventoryIssueStateForProduct,
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

const getInventoryReconciliationMode = () => {
  const rawValue = process.env.INVENTORY_RECONCILIATION_MODE?.trim().toLowerCase();
  return rawValue === "auto_zero" ? "auto_zero" : "log_only";
};

const sanitizeInventoryForProductTx = async (params: {
  tx: TransactionClient;
  productId: number;
  warehouseId?: number | null;
}) => {
  const productRows = await params.tx.$queryRaw<
    Array<{ id: number; name: string; stock_on_hand: number }>
  >(Prisma.sql`
    SELECT id, name, stock_on_hand
    FROM "products"
    WHERE id = ${params.productId}
    FOR UPDATE
  `);

  const product = productRows[0];
  if (!product) {
    return {
      productId: params.productId,
      sanitized: false,
      reason: "product_not_found" as const,
    };
  }

  const inventoryRows = await params.tx.$queryRaw<
    Array<{ id: number; warehouse_id: number; quantity: number }>
  >(Prisma.sql`
    SELECT id, warehouse_id, quantity
    FROM "inventories"
    WHERE product_id = ${params.productId}
      ${params.warehouseId ? Prisma.sql`AND warehouse_id = ${params.warehouseId}` : Prisma.empty}
    FOR UPDATE
  `);

  const currentStock = toWholeQuantity(product.stock_on_hand);
  const negativeRows = inventoryRows.filter(
    (row) => toWholeQuantity(row.quantity) < 0,
  );

  if (currentStock >= 0 && negativeRows.length === 0) {
    await syncInventoryIssueStateForProduct({
      tx: params.tx,
      productId: params.productId,
      stockOnHand: currentStock,
    });

    return {
      productId: params.productId,
      sanitized: false,
      reason: "already_consistent" as const,
      stockOnHand: currentStock,
    };
  }

  const mode = getInventoryReconciliationMode();
  const issueQuantity = Math.abs(Math.min(currentStock, 0));

  await upsertInventoryIssue({
    tx: params.tx,
    productId: params.productId,
    type: "NEGATIVE_AFTER_SALE",
    quantity: issueQuantity || negativeRows.reduce((sum, row) => sum + Math.abs(toWholeQuantity(row.quantity)), 0),
    metadata: {
      source: "inventory_reconciliation",
      warehouseId: params.warehouseId ?? null,
      mode,
    },
  });

  if (mode === "log_only") {
    console.warn("[inventory] negative stock detected during reconciliation", {
      productId: params.productId,
      productName: product.name,
      warehouseId: params.warehouseId ?? null,
      stockOnHand: currentStock,
      negativeInventoryRows: negativeRows.length,
    });

    return {
      productId: params.productId,
      sanitized: false,
      reason: "log_only" as const,
      stockOnHand: currentStock,
      negativeInventoryRows: negativeRows.length,
    };
  }

  let correctionApplied = 0;
  for (const row of negativeRows) {
    const quantity = toWholeQuantity(row.quantity);
    if (quantity >= 0) {
      continue;
    }

    correctionApplied += Math.abs(quantity);
    await params.tx.inventory.update({
      where: { id: row.id },
      data: { quantity: 0 },
    });
  }

  const nextStock = Math.max(currentStock + correctionApplied, 0);
  await params.tx.$executeRaw(Prisma.sql`
    UPDATE "products"
    SET
      stock_on_hand = ${nextStock},
      last_auto_corrected_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${params.productId}
  `);

  await syncInventoryIssueStateForProduct({
    tx: params.tx,
    productId: params.productId,
    stockOnHand: nextStock,
  });

  console.warn("[inventory] auto-corrected negative stock", {
    productId: params.productId,
    productName: product.name,
    warehouseId: params.warehouseId ?? null,
    previousStockOnHand: currentStock,
    nextStockOnHand: nextStock,
    correctionApplied,
  });

  return {
    productId: params.productId,
    sanitized: true,
    reason: "auto_zero" as const,
    stockOnHand: nextStock,
    correctionApplied,
  };
};

export const sanitizeInventoryForProduct = async (params: {
  productId: number;
  warehouseId?: number | null;
}) =>
  prisma.$transaction((tx) =>
    sanitizeInventoryForProductTx({
      tx,
      productId: params.productId,
      warehouseId: params.warehouseId,
    }),
  );
