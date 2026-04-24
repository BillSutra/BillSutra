import { Queue, Worker } from "bullmq";
import { deliverInvoiceEmail } from "./invoiceEmail.service.js";
import type { InvoiceEmailPreviewPayload } from "../../emails/types.js";

const INVOICE_QUEUE_NAME = "invoice-queue";

type InvoiceEmailJobData = {
  userId: number;
  invoiceId: number;
  requestedEmail?: string | null;
  previewPayload?: InvoiceEmailPreviewPayload | null;
};

const getRedisConnection = () => {
  const enabled =
    process.env.INVOICE_QUEUE_ENABLED?.trim() === "true" ||
    Boolean(process.env.REDIS_HOST?.trim());

  if (!enabled) {
    return null;
  }

  return {
    host: process.env.REDIS_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    maxRetriesPerRequest: null as null,
  };
};

let invoiceQueue: Queue<InvoiceEmailJobData> | null = null;
let invoiceWorker: Worker<InvoiceEmailJobData> | null = null;

const getInvoiceQueue = () => {
  const connection = getRedisConnection();
  if (!connection) {
    return null;
  }

  if (!invoiceQueue) {
    invoiceQueue = new Queue<InvoiceEmailJobData>(INVOICE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: 50,
        removeOnFail: 100,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
      },
    });
  }

  return invoiceQueue;
};

export const startInvoiceQueueWorker = () => {
  const connection = getRedisConnection();
  if (!connection || invoiceWorker) {
    return;
  }

  invoiceWorker = new Worker<InvoiceEmailJobData>(
    INVOICE_QUEUE_NAME,
    async (job) => {
      if (job.name !== "deliver-invoice-email") {
        return;
      }

      await deliverInvoiceEmail({
        userId: job.data.userId,
        invoiceId: job.data.invoiceId,
        requestedEmail: job.data.requestedEmail,
        previewPayload: job.data.previewPayload,
      });
    },
    {
      connection,
      concurrency: 2,
    },
  );

  invoiceWorker.on("completed", (job) => {
    console.info("[invoice.queue] job completed", {
      id: job.id,
      name: job.name,
    });
  });

  invoiceWorker.on("failed", (job, error) => {
    console.error("[invoice.queue] job failed", {
      id: job?.id,
      name: job?.name,
      message: error.message,
    });
  });
};

export const enqueueInvoiceEmailDelivery = async ({
  userId,
  invoiceId,
  requestedEmail,
  previewPayload,
}: InvoiceEmailJobData) => {
  const queue = getInvoiceQueue();
  if (!queue) {
    return { queued: false as const };
  }

  const job = await queue.add("deliver-invoice-email", {
    userId,
    invoiceId,
    requestedEmail,
    previewPayload,
  });

  return {
    queued: true as const,
    jobId: job.id ?? null,
  };
};
