import { sanitizeInventoryForProduct } from "../../services/inventoryReconciliation.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const inventoryJobHandlers = {
  sanitizeInventory: async (job) => {
    return sanitizeInventoryForProduct({
      productId: job.data.payload.productId,
      warehouseId: job.data.payload.warehouseId,
    });
  },
} satisfies Pick<AppQueueJobHandlerMap, "sanitizeInventory">;
