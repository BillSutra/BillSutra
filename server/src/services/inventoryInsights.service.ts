import prisma from "../config/db.config.js";

const INVENTORY_INSIGHTS_CACHE_MS = Number(
  process.env.INVENTORY_INSIGHTS_CACHE_MS ?? 6 * 60 * 60 * 1000,
);
const DEFAULT_SLOW_MOVING_DAYS = 15;
const DEFAULT_PREDICTION_WINDOW_DAYS = 30;
const DEFAULT_STOCKOUT_WARNING_DAYS = 5;

type InventoryInsightsCacheEntry = {
  expiresAt: number;
  payload: InventoryInsightsResponse;
};

const inventoryInsightsCache = new Map<string, InventoryInsightsCacheEntry>();

export type InventoryInsightType =
  | "low_stock"
  | "out_of_stock"
  | "prediction"
  | "slow_moving"
  | "reorder_reminder"
  | "supplier_suggestion";

export type InventoryInsightSeverity = "critical" | "warning" | "info";

export type InventoryInsight = {
  id: string;
  productId: string;
  productName: string;
  warehouseId: number | null;
  warehouseName: string | null;
  type: InventoryInsightType;
  message: string;
  severity: InventoryInsightSeverity;
  suggestedQuantity?: number;
  suggestedSupplierId?: number | null;
  suggestedSupplierName?: string | null;
  daysToStockout?: number | null;
  avgDailySales?: number;
  unitCost?: number;
  stockLeft: number;
  threshold?: number;
  referenceKey: string;
};

export type InventoryInsightsResponse = {
  generatedAt: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
  insights: InventoryInsight[];
};

type InventoryInsightsOptions = {
  warehouseId?: number;
  useCache?: boolean;
};

const buildCacheKey = (userId: number, warehouseId?: number) =>
  `${userId}|${warehouseId ?? "all"}`;

const getCachedInsights = (cacheKey: string) => {
  const cached = inventoryInsightsCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    inventoryInsightsCache.delete(cacheKey);
    return null;
  }

  return cached.payload;
};

const setCachedInsights = (
  cacheKey: string,
  payload: InventoryInsightsResponse,
) => {
  inventoryInsightsCache.set(cacheKey, {
    expiresAt: Date.now() + INVENTORY_INSIGHTS_CACHE_MS,
    payload,
  });
};

export const invalidateInventoryInsightsCacheByUser = (userId: number) => {
  const prefix = `${userId}|`;
  for (const key of inventoryInsightsCache.keys()) {
    if (key.startsWith(prefix)) {
      inventoryInsightsCache.delete(key);
    }
  }
};

const daysBetween = (left: Date, right: Date) =>
  Math.floor((left.getTime() - right.getTime()) / (24 * 60 * 60 * 1000));

const roundToTwo = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toReferenceKey = (
  type: InventoryInsightType,
  productId: number,
  warehouseId?: number | null,
) => `${type}:${productId}:${warehouseId ?? "all"}`;

const pushInsight = (
  insights: InventoryInsight[],
  seen: Set<string>,
  insight: Omit<InventoryInsight, "id">,
) => {
  if (seen.has(insight.referenceKey)) {
    return;
  }

  seen.add(insight.referenceKey);
  insights.push({
    ...insight,
    id: insight.referenceKey,
  });
};

const severityRank: Record<InventoryInsightSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export const getInventoryInsights = async (
  userId: number,
  options: InventoryInsightsOptions = {},
): Promise<InventoryInsightsResponse> => {
  const cacheKey = buildCacheKey(userId, options.warehouseId);
  if (options.useCache !== false) {
    const cached = getCachedInsights(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const now = new Date();
  const predictionStart = new Date(now);
  predictionStart.setDate(
    predictionStart.getDate() - DEFAULT_PREDICTION_WINDOW_DAYS,
  );

  const slowMovingCutoff = new Date(now);
  slowMovingCutoff.setDate(
    slowMovingCutoff.getDate() - DEFAULT_SLOW_MOVING_DAYS,
  );

  const inventoryRows = await prisma.inventory.findMany({
    where: {
      warehouse: {
        user_id: userId,
      },
      ...(options.warehouseId ? { warehouse_id: options.warehouseId } : {}),
    },
    include: {
      warehouse: {
        select: {
          id: true,
          name: true,
        },
      },
      product: {
        select: {
          id: true,
          name: true,
          stock_on_hand: true,
          reorder_level: true,
          cost: true,
          price: true,
          category_id: true,
          created_at: true,
        },
      },
    },
    orderBy: [{ warehouse_id: "asc" }, { product_id: "asc" }],
  });

  if (!inventoryRows.length) {
    const emptyPayload: InventoryInsightsResponse = {
      generatedAt: now.toISOString(),
      summary: { critical: 0, warning: 0, info: 0, total: 0 },
      insights: [],
    };
    setCachedInsights(cacheKey, emptyPayload);
    return emptyPayload;
  }

  const productIds = Array.from(
    new Set(inventoryRows.map((row) => row.product.id)),
  );

  const [salesWindowRows, recentSalesRows, purchaseRows, suppliers] =
    await Promise.all([
      prisma.saleItem.findMany({
        where: {
          product_id: { in: productIds },
          sale: {
            user_id: userId,
            sale_date: { gte: predictionStart },
            status: "COMPLETED",
          },
        },
        select: {
          product_id: true,
          quantity: true,
          sale: {
            select: {
              sale_date: true,
            },
          },
        },
      }),
      prisma.saleItem.findMany({
        where: {
          product_id: { in: productIds },
          sale: {
            user_id: userId,
            sale_date: { gte: slowMovingCutoff },
            status: "COMPLETED",
          },
        },
        select: {
          product_id: true,
        },
      }),
      prisma.purchaseItem.findMany({
        where: {
          product_id: { in: productIds },
          purchase: {
            user_id: userId,
          },
        },
        select: {
          product_id: true,
          unit_cost: true,
          purchase: {
            select: {
              supplier_id: true,
              purchase_date: true,
            },
          },
        },
        orderBy: {
          purchase: {
            purchase_date: "desc",
          },
        },
      }),
      prisma.supplier.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          name: true,
          updated_at: true,
        },
      }),
    ]);

  const soldRecently = new Set<number>();
  recentSalesRows.forEach((row) => {
    if (row.product_id !== null) {
      soldRecently.add(row.product_id);
    }
  });

  const salesSummary = new Map<
    number,
    { totalQuantity: number; lastSaleDate: Date | null }
  >();
  salesWindowRows.forEach((row) => {
    if (row.product_id === null) {
      return;
    }

    const current = salesSummary.get(row.product_id) ?? {
      totalQuantity: 0,
      lastSaleDate: null,
    };

    salesSummary.set(row.product_id, {
      totalQuantity: current.totalQuantity + row.quantity,
      lastSaleDate:
        !current.lastSaleDate || row.sale.sale_date > current.lastSaleDate
          ? row.sale.sale_date
          : current.lastSaleDate,
    });
  });

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const supplierStatsByProductId = new Map<
    number,
    Map<number, { bestUnitCost: number; latestPurchaseDate: Date | null; hits: number }>
  >();

  purchaseRows.forEach((row) => {
    if (row.product_id === null || row.purchase.supplier_id === null) {
      return;
    }

    const supplierMap =
      supplierStatsByProductId.get(row.product_id) ?? new Map<number, {
        bestUnitCost: number;
        latestPurchaseDate: Date | null;
        hits: number;
      }>();
    const current = supplierMap.get(row.purchase.supplier_id) ?? {
      bestUnitCost: Number.POSITIVE_INFINITY,
      latestPurchaseDate: null,
      hits: 0,
    };

    supplierMap.set(row.purchase.supplier_id, {
      bestUnitCost: Math.min(current.bestUnitCost, Number(row.unit_cost)),
      latestPurchaseDate:
        !current.latestPurchaseDate ||
        row.purchase.purchase_date > current.latestPurchaseDate
          ? row.purchase.purchase_date
          : current.latestPurchaseDate,
      hits: current.hits + 1,
    });

    supplierStatsByProductId.set(row.product_id, supplierMap);
  });

  const insights: InventoryInsight[] = [];
  const seen = new Set<string>();

  inventoryRows.forEach((row) => {
    const currentStock = row.quantity;
    const threshold = row.product.reorder_level > 0 ? row.product.reorder_level : 5;
    const sales = salesSummary.get(row.product.id);
    const avgDailySales = roundToTwo(
      (sales?.totalQuantity ?? 0) / DEFAULT_PREDICTION_WINDOW_DAYS,
    );
    const daysToStockout =
      avgDailySales > 0 ? Math.max(0, Math.ceil(currentStock / avgDailySales)) : null;
    const suggestedQuantity =
      avgDailySales > 0
        ? Math.max(
            Math.ceil(avgDailySales * 14) - currentStock,
            row.product.reorder_level > 0 ? row.product.reorder_level - currentStock : 0,
            1,
          )
        : undefined;

    const baseInsight = {
      productId: String(row.product.id),
      productName: row.product.name,
      warehouseId: row.warehouse.id,
      warehouseName: row.warehouse.name,
      stockLeft: currentStock,
      threshold,
      avgDailySales,
      daysToStockout,
      suggestedQuantity,
      unitCost: Number(row.product.cost ?? row.product.price ?? 0),
    };

    if (currentStock === 0) {
      pushInsight(insights, seen, {
        ...baseInsight,
        type: "out_of_stock",
        severity: "critical",
        message: `${row.product.name} is out of stock. You may lose sales.`,
        referenceKey: toReferenceKey(
          "out_of_stock",
          row.product.id,
          row.warehouse.id,
        ),
      });
    } else if (currentStock < threshold) {
      pushInsight(insights, seen, {
        ...baseInsight,
        type: "low_stock",
        severity: currentStock <= Math.max(1, Math.floor(threshold / 2))
          ? "critical"
          : "warning",
        message: `${row.product.name} stock is low (${currentStock} left). Consider restocking.`,
        referenceKey: toReferenceKey(
          "low_stock",
          row.product.id,
          row.warehouse.id,
        ),
      });
    }

    if (
      currentStock > 0 &&
      row.product.created_at <= slowMovingCutoff &&
      !soldRecently.has(row.product.id)
    ) {
      pushInsight(insights, seen, {
        ...baseInsight,
        type: "slow_moving",
        severity: "warning",
        message: `${row.product.name} has not sold in the last ${DEFAULT_SLOW_MOVING_DAYS} days.`,
        referenceKey: toReferenceKey(
          "slow_moving",
          row.product.id,
          row.warehouse.id,
        ),
      });
    }

    if (
      currentStock > 0 &&
      avgDailySales > 0 &&
      daysToStockout !== null &&
      daysToStockout < DEFAULT_STOCKOUT_WARNING_DAYS
    ) {
      pushInsight(insights, seen, {
        ...baseInsight,
        type: "prediction",
        severity: daysToStockout <= 2 ? "critical" : "warning",
        message: `${row.product.name} will run out of stock in ${daysToStockout} day${daysToStockout === 1 ? "" : "s"}.`,
        referenceKey: toReferenceKey(
          "prediction",
          row.product.id,
          row.warehouse.id,
        ),
      });
    }

    if (
      currentStock >= 0 &&
      avgDailySales > 0 &&
      suggestedQuantity &&
      suggestedQuantity > 0 &&
      (currentStock < threshold ||
        (daysToStockout !== null && daysToStockout < 10))
    ) {
      pushInsight(insights, seen, {
        ...baseInsight,
        type: "reorder_reminder",
        severity: currentStock === 0 ? "critical" : "info",
        message: `Reorder ${suggestedQuantity} units of ${row.product.name} to avoid stockout.`,
        referenceKey: toReferenceKey(
          "reorder_reminder",
          row.product.id,
          row.warehouse.id,
        ),
      });
    }

    const supplierStats = supplierStatsByProductId.get(row.product.id);
    if (supplierStats?.size && suggestedQuantity && suggestedQuantity > 0) {
      const rankedSuppliers = Array.from(supplierStats.entries())
        .map(([supplierId, stats]) => {
          const supplier = supplierById.get(supplierId);
          if (!supplier) {
            return null;
          }

          const recencyDays = stats.latestPurchaseDate
            ? daysBetween(now, stats.latestPurchaseDate)
            : 999;
          const availabilityScore = row.product.category_id !== null ? 2 : 1;

          return {
            supplier,
            stats,
            score:
              stats.bestUnitCost -
              Math.min(stats.hits, 5) * 0.1 +
              recencyDays * 0.01 -
              availabilityScore,
          };
        })
        .filter(
          (
            candidate,
          ): candidate is NonNullable<typeof candidate> => candidate !== null,
        )
        .sort((left, right) => left.score - right.score);

      const bestSupplier = rankedSuppliers[0];
      if (bestSupplier) {
        pushInsight(insights, seen, {
          ...baseInsight,
          type: "supplier_suggestion",
          severity: "info",
          suggestedSupplierId: bestSupplier.supplier.id,
          suggestedSupplierName: bestSupplier.supplier.name,
          message: `Buy ${row.product.name} from ${bestSupplier.supplier.name} for better pricing.`,
          referenceKey: toReferenceKey(
            "supplier_suggestion",
            row.product.id,
            row.warehouse.id,
          ),
        });
      }
    }
  });

  insights.sort((left, right) => {
    const severityDiff = severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return (left.daysToStockout ?? 9999) - (right.daysToStockout ?? 9999);
  });

  const response: InventoryInsightsResponse = {
    generatedAt: now.toISOString(),
    summary: {
      critical: insights.filter((insight) => insight.severity === "critical").length,
      warning: insights.filter((insight) => insight.severity === "warning").length,
      info: insights.filter((insight) => insight.severity === "info").length,
      total: insights.length,
    },
    insights,
  };

  setCachedInsights(cacheKey, response);
  return response;
};

export const warmInventoryInsightsCache = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  for (const user of users) {
    try {
      await getInventoryInsights(user.id, { useCache: false });
    } catch (error) {
      console.error(
        `[InventoryInsightsJob] Failed to warm cache for user ${user.id}`,
        error,
      );
    }
  }
};
