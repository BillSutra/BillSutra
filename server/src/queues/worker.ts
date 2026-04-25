import "dotenv/config";
import { Worker } from "bullmq";
import {
  DEFAULT_QUEUE_NAME,
  startQueueWorkerHeartbeat,
} from "./queue.js";
import {
  getBullmqRedisConnection,
  isQueueEnabled,
} from "../redis/queue/index.js";
import { processDefaultQueueJob } from "./workers/index.js";

const startWorker = async () => {
  if (!isQueueEnabled()) {
    console.info("[queues.worker] USE_QUEUE is disabled; worker not started");
    return;
  }

  const connection = await getBullmqRedisConnection();
  if (!connection) {
    throw new Error("Queue connection is not available.");
  }

  const stopHeartbeat = startQueueWorkerHeartbeat();

  const worker = new Worker(DEFAULT_QUEUE_NAME, processDefaultQueueJob, {
    connection,
    concurrency: 4,
  });

  worker.on("active", (job) => {
    console.info("[queues.worker] job started", {
      queue: DEFAULT_QUEUE_NAME,
      jobId: String(job.id ?? ""),
      jobName: job.name,
    });
  });

  worker.on("completed", (job) => {
    console.info("[queues.worker] job succeeded", {
      queue: DEFAULT_QUEUE_NAME,
      jobId: String(job.id ?? ""),
      jobName: job.name,
    });
  });

  worker.on("failed", (job, error) => {
    console.error("[queues.worker] job failed", {
      queue: DEFAULT_QUEUE_NAME,
      jobId: job?.id ? String(job.id) : null,
      jobName: job?.name ?? null,
      message: error.message,
    });
  });

  const shutdown = async (signal: string) => {
    console.info("[queues.worker] shutting down", { signal });
    stopHeartbeat();
    await worker.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  console.info("[queues.worker] started", {
    queue: DEFAULT_QUEUE_NAME,
  });
};

void startWorker().catch((error) => {
  console.error("[queues.worker] failed to start", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
