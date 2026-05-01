import { enqueueQueueJob } from "../queue.js";
import type { AppQueueContextInput } from "../types.js";

export const enqueueInventorySanitization = async (params: {
  productId: number;
  warehouseId?: number | null;
  triggeredBy: "invoice" | "sale" | "manual";
  referenceId?: number | string | null;
  context?: AppQueueContextInput;
}) =>
  enqueueQueueJob({
    jobName: "sanitizeInventory",
    payload: {
      productId: params.productId,
      warehouseId: params.warehouseId,
      triggeredBy: params.triggeredBy,
      referenceId: params.referenceId,
    },
    context: {
      ...params.context,
      metadata: {
        ...(params.context?.metadata ?? {}),
        productId: params.productId,
        warehouseId: params.warehouseId ?? null,
        triggeredBy: params.triggeredBy,
        referenceId:
          typeof params.referenceId === "number" ||
          typeof params.referenceId === "string"
            ? params.referenceId
            : null,
        task: "inventory_sanitization",
      },
    },
    jobId: `inventory:${params.productId}:warehouse:${params.warehouseId ?? "all"}:sanitize`,
  });
