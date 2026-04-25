import { emailJobHandlers } from "./email.worker.js";
import { exportJobHandlers } from "./export.worker.js";
import { notificationJobHandlers } from "./notification.worker.js";
import { pdfJobHandlers } from "./pdf.worker.js";
import type { DefaultQueueJob, DefaultQueueJobHandlerMap } from "../types.js";

const jobHandlers: DefaultQueueJobHandlerMap = {
  ...pdfJobHandlers,
  ...emailJobHandlers,
  ...exportJobHandlers,
  ...notificationJobHandlers,
};

export const processDefaultQueueJob = async (job: DefaultQueueJob) => {
  const handler = jobHandlers[job.name];

  if (!handler) {
    throw new Error(`No queue handler registered for job ${job.name}`);
  }

  return handler(job as never);
};
