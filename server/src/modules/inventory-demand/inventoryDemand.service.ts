import prisma from "../../config/db.config.js";
import type {
    InventoryDemandMetadata,
    InventoryDemandPrediction,
} from "./inventoryDemand.schema.js";

const toNumber = (value: unknown) => Number(value ?? 0);

type InventoryDemandFilters = {
    productId?: number;
    warehouseId?: number;
    productIds?: number[];
    categoryId?: number;
    supplierId?: number;
    alertLevel?: "critical" | "warning" | "normal";
    limit?: number;
};

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

const getConfidenceScore = (quantitySold30Days: number): number => {
    if (quantitySold30Days <= 0) return 0.35;
    if (quantitySold30Days < 10) return 0.55;
    if (quantitySold30Days < 30) return 0.72;
    return 0.88;
};

/**
 * Get inventory demand predictions for a user
 * Supports batched filtering for operational workflows
 */
export const getInventoryDemandPredictions = async (
    userId: number,
    filters: InventoryDemandFilters = {},
): Promise<{
    predictions: InventoryDemandPrediction[];
    metadata: InventoryDemandMetadata;
}> => {
    const {
        productId,
        warehouseId,
        productIds,
        categoryId,
        supplierId,
        alertLevel,
        limit,
    } = filters;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setTime(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch products for the user
    const products = await prisma.product.findMany({
        where: {
            user_id: userId,
            ...(productId && { id: productId }),
            ...(productIds?.length
                ? {
                      id: {
                          in: productIds,
                      },
                  }
                : {}),
            ...(categoryId ? { category_id: categoryId } : {}),
            ...(supplierId
                ? {
                      purchaseItems: {
                          some: {
                              purchase: {
                                  user_id: userId,
                                  supplier_id: supplierId,
                              },
                          },
                      },
                  }
                : {}),
        },
        select: {
            id: true,
            name: true,
            stock_on_hand: true,
            cost: true,
            price: true,
        },
    });

    if (products.length === 0) {
        return {
            predictions: [],
            metadata: {
                generatedAt: new Date().toISOString(),
                basisWindowDays: 30,
                dataCoverageDays: 30,
                warehouseScope: {
                    warehouseId: warehouseId ?? null,
                    mode: warehouseId ? "warehouse" : "all",
                },
            },
        };
    }

    const warehouseInventoryByProductId = warehouseId
        ? new Map(
              (
                  await prisma.inventory.findMany({
                      where: {
                          warehouse_id: warehouseId,
                          product_id: {
                              in: products.map((product) => product.id),
                          },
                      },
                      select: {
                          product_id: true,
                          quantity: true,
                      },
                  })
              ).map((inventory) => [inventory.product_id, inventory.quantity]),
          )
        : null;

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
        const currentStock = warehouseInventoryByProductId
            ? warehouseInventoryByProductId.get(product.id) ?? 0
            : product.stock_on_hand ?? 0;
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
        const confidence = getConfidenceScore(quantitySold30Days);

        return {
            product_id: product.id,
            product_name: product.name,
            warehouse_id: warehouseId ?? null,
            stock_left: currentStock,
            predicted_daily_sales: Math.round(predictedDailySales * 100) / 100, // Round to 2 decimals
            days_until_stockout:
                daysUntilStockout === Infinity ? 999 : Math.round(daysUntilStockout), // Show 999 for infinity
            recommended_reorder_quantity: recommendedReorderQuantity,
            alert_level: alertLevel,
            unit_cost: toNumber(product.cost ?? product.price),
            basis_window_days: 30,
            confidence,
        };
    });

    // Sort by days_until_stockout (lowest first - critical products first)
    predictions.sort((a, b) => a.days_until_stockout - b.days_until_stockout);

    const filteredPredictions = predictions.filter((prediction) =>
        alertLevel ? prediction.alert_level === alertLevel : true,
    );

    return {
        predictions:
            typeof limit === "number"
                ? filteredPredictions.slice(0, limit)
                : filteredPredictions,
        metadata: {
            generatedAt: new Date().toISOString(),
            basisWindowDays: 30,
            dataCoverageDays: 30,
            warehouseScope: {
                warehouseId: warehouseId ?? null,
                mode: warehouseId ? "warehouse" : "all",
            },
        },
    };
};

/**
 * Get top N products at risk of stockout (alert_level !== "normal")
 */
export const getTopRiskProducts = async (
    userId: number,
    limit: number = 5,
): Promise<InventoryDemandPrediction[]> => {
    const { predictions } = await getInventoryDemandPredictions(userId);
    return predictions
        .filter((p) => p.alert_level !== "normal")
        .slice(0, limit);
};
