import { analyticsJobHandlers } from "./analytics.worker.js";
import { emailJobHandlers } from "./email.worker.js";
import { exportJobHandlers } from "./export.worker.js";
import { inventoryJobHandlers } from "./inventory.worker.js";
import { notificationJobHandlers } from "./notification.worker.js";
import { pdfJobHandlers } from "./pdf.worker.js";
import type { AppQueueJob, AppQueueJobHandlerMap } from "../types.js";

const jobHandlers: AppQueueJobHandlerMap = {
  ...analyticsJobHandlers,
  ...pdfJobHandlers,
  ...emailJobHandlers,
  ...exportJobHandlers,
  ...inventoryJobHandlers,
  ...notificationJobHandlers,
};

export const processQueueJob = async (job: AppQueueJob) => {
  const handler = jobHandlers[job.name];

  if (!handler) {
    throw new Error(`No queue handler registered for job ${job.name}`);
  }

  return handler(job as never);
};
