import { executeQueuedExportEmail } from "../../modules/export/export.service.js";
import type { AppQueueJobHandlerMap } from "../types.js";

export const exportJobHandlers: Pick<
  AppQueueJobHandlerMap,
  "sendExportEmail"
> = {
  sendExportEmail: async (job) =>
    executeQueuedExportEmail(
      {
        id: job.data.context.userId as number,
        actorId: job.data.context.actorId ?? undefined,
        businessId: job.data.context.businessId ?? undefined,
        email: job.data.payload.email,
      },
      job.data.payload.payload,
    ),
};
