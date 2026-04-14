import type { Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";
import { getInventoryInsights } from "../services/inventoryInsights.service.js";

class InventoryInsightsController {
  static async index(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const warehouseIdRaw =
      typeof req.query.warehouseId === "string"
        ? Number(req.query.warehouseId)
        : undefined;
    const warehouseId =
      Number.isFinite(warehouseIdRaw) && (warehouseIdRaw ?? 0) > 0
        ? warehouseIdRaw
        : undefined;

    try {
      const data = await getInventoryInsights(userId, { warehouseId });
      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("[InventoryInsights] Failed to load insights", error);
      return sendResponse(res, 500, {
        message: "Failed to load smart inventory insights",
      });
    }
  }
}

export default InventoryInsightsController;
