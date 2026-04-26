import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";

type TransactionClient = Prisma.TransactionClient;
export type InventoryIssueTypeValue =
  | "NEGATIVE_AFTER_SALE"
  | "NEGATIVE_BEFORE_PURCHASE";

const NEGATIVE_ISSUE_TYPES: InventoryIssueTypeValue[] = [
  "NEGATIVE_AFTER_SALE",
  "NEGATIVE_BEFORE_PURCHASE",
];

const toWholeQuantity = (value: unknown) => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
};

const stringifyMetadata = (value: Prisma.InputJsonValue | undefined) =>
  value === undefined ? null : JSON.stringify(value);

const getClient = (tx?: TransactionClient) => tx ?? prisma;

export const upsertInventoryIssue = async (params: {
  tx?: TransactionClient;
  productId: number;
  type: InventoryIssueTypeValue;
  quantity: number;
  metadata?: Prisma.InputJsonValue;
}) => {
  const client = getClient(params.tx);
  const normalizedQuantity = Math.abs(toWholeQuantity(params.quantity));

  if (normalizedQuantity <= 0) {
    return null;
  }

  const existingRows = await client.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    SELECT id
    FROM "inventory_issues"
    WHERE product_id = ${params.productId}
      AND type = ${params.type}::"InventoryIssueType"
      AND resolved = false
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const existing = existingRows[0];
  if (existing) {
    await client.$executeRaw(Prisma.sql`
      UPDATE "inventory_issues"
      SET
        quantity = ${normalizedQuantity},
        metadata = ${stringifyMetadata(params.metadata)}::jsonb,
        resolved_at = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existing.id}
    `);

    return { id: existing.id, quantity: normalizedQuantity };
  }

  const createdRows = await client.$queryRaw<Array<{ id: number }>>(Prisma.sql`
    INSERT INTO "inventory_issues" (
      product_id,
      type,
      quantity,
      resolved,
      metadata
    )
    VALUES (
      ${params.productId},
      ${params.type}::"InventoryIssueType",
      ${normalizedQuantity},
      false,
      ${stringifyMetadata(params.metadata)}::jsonb
    )
    RETURNING id
  `);

  return createdRows[0] ?? null;
};

export const resolveInventoryIssuesForProduct = async (params: {
  tx?: TransactionClient;
  productId: number;
  types?: InventoryIssueTypeValue[];
}) => {
  const client = getClient(params.tx);
  const typeFilter =
    params.types?.length
      ? Prisma.sql`AND type IN (${Prisma.join(
          params.types.map((type) => Prisma.sql`${type}::"InventoryIssueType"`),
        )})`
      : Prisma.empty;

  return client.$executeRaw(Prisma.sql`
    UPDATE "inventory_issues"
    SET
      resolved = true,
      resolved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ${params.productId}
      AND resolved = false
      ${typeFilter}
  `);
};

export const syncInventoryIssueStateForProduct = async (params: {
  tx?: TransactionClient;
  productId: number;
  stockOnHand: number;
}) => {
  if (toWholeQuantity(params.stockOnHand) >= 0) {
    return resolveInventoryIssuesForProduct({
      tx: params.tx,
      productId: params.productId,
      types: NEGATIVE_ISSUE_TYPES,
    });
  }

  return null;
};

export const listInventoryIssuesForUser = async (params: {
  userId: number;
  resolved?: boolean;
}) =>
  prisma.$queryRaw<
    Array<{
      id: number;
      product_id: number;
      type: InventoryIssueTypeValue;
      quantity: number;
      resolved: boolean;
      metadata: unknown;
      resolved_at: Date | null;
      created_at: Date;
      updated_at: Date;
      product_name: string;
      product_sku: string;
      product_stock_on_hand: number;
      product_last_auto_corrected_at: Date | null;
    }>
  >(Prisma.sql`
    SELECT
      ii.id,
      ii.product_id,
      ii.type,
      ii.quantity,
      ii.resolved,
      ii.metadata,
      ii.resolved_at,
      ii.created_at,
      ii.updated_at,
      p.name AS product_name,
      p.sku AS product_sku,
      p.stock_on_hand AS product_stock_on_hand,
      p.last_auto_corrected_at AS product_last_auto_corrected_at
    FROM "inventory_issues" ii
    INNER JOIN "products" p
      ON p.id = ii.product_id
    WHERE p.user_id = ${params.userId}
      ${params.resolved === undefined ? Prisma.empty : Prisma.sql`AND ii.resolved = ${params.resolved}`}
    ORDER BY ii.resolved ASC, ii.created_at DESC
  `);
