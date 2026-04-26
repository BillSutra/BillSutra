import { sanitizeInventoryForProduct } from "../../services/inventoryReconciliation.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const inventoryJobHandlers = {
  sanitizeInventory: async (job) => {
    return sanitizeInventoryForProduct({
      productId: job.data.productId,
      warehouseId: job.data.warehouseId,
    });
  },
} satisfies Pick<DefaultQueueJobHandlerMap, "sanitizeInventory">;
