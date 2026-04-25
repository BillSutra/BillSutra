import { executeQueuedExportEmail } from "../../modules/export/export.service.js";
import type { DefaultQueueJobHandlerMap } from "../types.js";

export const exportJobHandlers: Pick<
  DefaultQueueJobHandlerMap,
  "sendExportEmail"
> = {
  sendExportEmail: async (job) =>
    executeQueuedExportEmail(
      {
        id: job.data.userId,
        actorId: job.data.actorId,
        email: job.data.email,
      },
      job.data.payload,
    ),
};
