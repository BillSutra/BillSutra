import prisma from "../../config/db.config.js";
import type { InventoryDemandPrediction } from "./inventoryDemand.schema.js";

const toNumber = (value: unknown) => Number(value ?? 0);

/**
 * Calculate predicted daily sales based on 30-day sales history
 * Uses only PAID and PARTIALLY_PAID sales
 */
const calculatePredictedDailySales = (
    totalQuantitySold: number,
    days: number,
): number => {
    if (days === 0 || totalQuantitySold === 0) return 0;
    return totalQuantitySold / days;
};

/**
 * Calculate days until stockout
 */
const calculateDaysUntilStockout = (
    currentStock: number,
    predictedDailySales: number,
): number => {
    if (predictedDailySales === 0) return Infinity;
    return currentStock / predictedDailySales;
};

/**
 * Calculate recommended reorder quantity
 * Uses 14 days buffer (2 weeks)
 */
const calculateReorderQuantity = (predictedDailySales: number): number => {
    const bufferDays = 14;
    const reorderQty = Math.ceil(predictedDailySales * bufferDays);
    return Math.max(reorderQty, 1); // Minimum 1
};

/**
 * Determine alert level based on days until stockout
 */
const getAlertLevel = (
    daysUntilStockout: number,
): "critical" | "warning" | "normal" => {
    if (daysUntilStockout <= 3) return "critical";
    if (daysUntilStockout <= 7) return "warning";
    return "normal";
};

/**
 * Get inventory demand predictions for a user
 * Optionally filter by specific product
 */
export const getInventoryDemandPredictions = async (
    userId: number,
    productId?: number,
): Promise<InventoryDemandPrediction[]> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setTime(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch products for the user
    const products = await prisma.product.findMany({
        where: {
            user_id: userId,
            ...(productId && { id: productId }),
        },
        select: {
            id: true,
            name: true,
            stock_on_hand: true,
        },
    });

    if (products.length === 0) {
        return [];
    }

    const recentSalesByProduct = await prisma.saleItem.groupBy({
        by: ["product_id"],
        where: {
            product_id: {
                in: products.map((product) => product.id),
            },
            sale: {
                user_id: userId,
                sale_date: {
                    gte: thirtyDaysAgo,
                },
                paymentStatus: {
                    in: ["PAID", "PARTIALLY_PAID"],
                },
            },
        },
        _sum: {
            quantity: true,
        },
    });

    const quantitySoldByProductId = new Map<number, number>(
        recentSalesByProduct.flatMap((entry) =>
            entry.product_id == null
                ? []
                : [[entry.product_id, toNumber(entry._sum.quantity)]],
        ),
    );

    // Calculate predictions for each product
    const predictions: InventoryDemandPrediction[] = products.map((product) => {
        const currentStock = product.stock_on_hand ?? 0;
        const quantitySold30Days =
            quantitySoldByProductId.get(product.id) ?? 0;

        // Use 30-day average for more recent predictions
        const predictedDailySales = calculatePredictedDailySales(
            quantitySold30Days,
            30,
        );

        // Calculate stockout metrics
        const daysUntilStockout = calculateDaysUntilStockout(
            currentStock,
            predictedDailySales,
        );

        const recommendedReorderQuantity =
            calculateReorderQuantity(predictedDailySales);

        // Determine alert level
        const alertLevel = getAlertLevel(daysUntilStockout);

        return {
            product_id: product.id,
            product_name: product.name,
            stock_left: currentStock,
            predicted_daily_sales: Math.round(predictedDailySales * 100) / 100, // Round to 2 decimals
            days_until_stockout:
                daysUntilStockout === Infinity ? 999 : Math.round(daysUntilStockout), // Show 999 for infinity
            recommended_reorder_quantity: recommendedReorderQuantity,
            alert_level: alertLevel,
        };
    });

    // Sort by days_until_stockout (lowest first - critical products first)
    predictions.sort((a, b) => a.days_until_stockout - b.days_until_stockout);

    return predictions;
};

/**
 * Get top N products at risk of stockout (alert_level !== "normal")
 */
export const getTopRiskProducts = async (
    userId: number,
    limit: number = 5,
): Promise<InventoryDemandPrediction[]> => {
    const predictions = await getInventoryDemandPredictions(userId);
    return predictions
        .filter((p) => p.alert_level !== "normal")
        .slice(0, limit);
};
