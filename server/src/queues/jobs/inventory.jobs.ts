import { enqueueDefaultJob } from "../queue.js";

export const enqueueInventorySanitization = async (params: {
  productId: number;
  warehouseId?: number | null;
  triggeredBy: "invoice" | "sale" | "manual";
  referenceId?: number | string | null;
}) =>
  enqueueDefaultJob({
    jobName: "sanitizeInventory",
    data: params,
    jobId: `inventory:${params.productId}:warehouse:${params.warehouseId ?? "all"}:sanitize`,
  });
