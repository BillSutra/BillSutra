import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import {
    getInventoryDemandPredictions,
    getTopRiskProducts,
} from "./inventoryDemand.service.js";
import { inventoryDemandQuerySchema } from "./inventoryDemand.schema.js";

class InventoryDemandController {
    static async getPredictions(req: Request, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return sendResponse(res, 401, { message: "Unauthorized" });
        }

        try {
            // Validate query parameters
            const queryResult = inventoryDemandQuerySchema.safeParse(req.query);
            if (!queryResult.success) {
                return sendResponse(res, 400, {
                    message: "Invalid query parameters",
                    errors: queryResult.error.errors,
                });
            }

            const {
                productId,
                warehouseId,
                productIds,
                categoryId,
                supplierId,
                alertLevel,
                limit,
            } = queryResult.data;

            // Get predictions
            const { predictions, metadata } = await getInventoryDemandPredictions(
                userId,
                {
                    productId,
                    warehouseId,
                    productIds,
                    categoryId,
                    supplierId,
                    alertLevel,
                    limit,
                },
            );

            return sendResponse(res, 200, {
                data: {
                    predictions,
                    count: predictions.length,
                    metadata,
                },
            });
        } catch (error) {
            console.error("[InventoryDemand] Error in getPredictions:", error);
            return sendResponse(res, 500, {
                message: "Failed to fetch inventory demand predictions",
            });
        }
    }

    static async getTopRiskAlerts(req: Request, res: Response) {
        const userId = req.user?.id;
        if (!userId) {
            return sendResponse(res, 401, { message: "Unauthorized" });
        }

        try {
            // Get top risk products
            const riskProducts = await getTopRiskProducts(userId, 5);

            return sendResponse(res, 200, {
                data: {
                    alerts: riskProducts,
                    count: riskProducts.length,
                },
            });
        } catch (error) {
            console.error("[InventoryDemand] Error in getTopRiskAlerts:", error);
            return sendResponse(res, 500, {
                message: "Failed to fetch inventory risk alerts",
            });
        }
    }
}

export default InventoryDemandController;
