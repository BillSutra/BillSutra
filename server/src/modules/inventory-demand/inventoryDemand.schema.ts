import { z } from "zod";

const positiveIntArraySchema = z
    .union([
        z
            .string()
            .transform((value) =>
                value
                    .split(",")
                    .map((part) => Number(part.trim()))
                    .filter((value) => Number.isInteger(value) && value > 0),
            ),
        z.array(z.coerce.number().int().positive()),
    ])
    .optional();

export const inventoryDemandQuerySchema = z.object({
    productId: z.coerce.number().int().positive().optional(),
    warehouseId: z.coerce.number().int().positive().optional(),
    productIds: positiveIntArraySchema,
    categoryId: z.coerce.number().int().positive().optional(),
    supplierId: z.coerce.number().int().positive().optional(),
    alertLevel: z.enum(["critical", "warning", "normal"]).optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
});

export type InventoryDemandQuery = z.infer<typeof inventoryDemandQuerySchema>;

export const inventoryDemandPredictionSchema = z.object({
    product_id: z.number(),
    product_name: z.string(),
    warehouse_id: z.number().nullable().optional(),
    stock_left: z.number(),
    predicted_daily_sales: z.number(),
    days_until_stockout: z.number(),
    recommended_reorder_quantity: z.number(),
    alert_level: z.enum(["critical", "warning", "normal"]),
    unit_cost: z.number(),
    basis_window_days: z.number(),
    confidence: z.number(),
});

export type InventoryDemandPrediction = z.infer<
    typeof inventoryDemandPredictionSchema
>;

export const inventoryDemandMetadataSchema = z.object({
    generatedAt: z.string(),
    basisWindowDays: z.number(),
    dataCoverageDays: z.number(),
    warehouseScope: z.object({
        warehouseId: z.number().nullable(),
        mode: z.enum(["all", "warehouse"]),
    }),
});

export type InventoryDemandMetadata = z.infer<
    typeof inventoryDemandMetadataSchema
>;
