import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import InventoryDemandController from "./inventoryDemand.controller.js";

const router = Router();

/**
 * GET /api/inventory-demand/predictions
 * Get inventory demand predictions for all products
 * Optional query: ?productId=xxx
 */
router.get(
    "/predictions",
    AuthMiddleware,
    InventoryDemandController.getPredictions,
);

/**
 * GET /api/inventory-demand/alerts
 * Get top risk products that need attention
 */
router.get(
    "/alerts",
    AuthMiddleware,
    InventoryDemandController.getTopRiskAlerts,
);

export default router;
