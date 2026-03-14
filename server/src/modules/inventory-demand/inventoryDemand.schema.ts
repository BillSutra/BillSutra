import { z } from "zod";

export const inventoryDemandQuerySchema = z.object({
    productId: z.coerce.number().int().positive().optional(),
});

export type InventoryDemandQuery = z.infer<typeof inventoryDemandQuerySchema>;

export const inventoryDemandPredictionSchema = z.object({
    product_id: z.number(),
    product_name: z.string(),
    stock_left: z.number(),
    predicted_daily_sales: z.number(),
    days_until_stockout: z.number(),
    recommended_reorder_quantity: z.number(),
    alert_level: z.enum(["critical", "warning", "normal"]),
});

export type InventoryDemandPrediction = z.infer<
    typeof inventoryDemandPredictionSchema
>;
