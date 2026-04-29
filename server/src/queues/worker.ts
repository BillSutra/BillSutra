import { Worker } from "bullmq";
import { loadServerEnv } from "../config/loadEnv.js";
import {
  initializeRedisConfig,
  logRedisStartupDiagnostics,
  logRedisStartupFailure,
  RedisConfigValidationError,
} from "../config/redisConfig.js";
import { getBullmqRedisConnection, isQueueEnabled } from "../redis/queue/index.js";
import {
  APP_QUEUE_DEFINITIONS,
  APP_QUEUE_NAMES,
  type AppQueueJob,
  type AppQueueName,
} from "./types.js";
import {
  markQueueJobLifecycle,
  startQueueWorkerHeartbeat,
} from "./queue.js";
import { processQueueJob } from "./workers/index.js";

loadServerEnv();

const QUEUE_WORKER_LOG_PREFIX = "[queues.worker]";

const logWorkerEvent = (
  event: "started" | "job_started" | "job_succeeded" | "job_failed" | "shutdown",
  detail: Record<string, unknown>,
) => {
  const logger = event === "job_failed" ? console.error : console.info;
  logger(`${QUEUE_WORKER_LOG_PREFIX} ${event}`, detail);
};

const toJobContext = (job: AppQueueJob) => job.data.context;

const registerWorkerLifecycleLogging = (
  queueName: AppQueueName,
  worker: Worker,
) => {
  worker.on("active", (job) => {
    const resolvedJob = job as AppQueueJob;
    const jobId = String(resolvedJob.id ?? "");

    void markQueueJobLifecycle({
      jobId,
      queueName,
      jobName: resolvedJob.name,
      context: toJobContext(resolvedJob),
      status: "active",
      attemptsMade: resolvedJob.attemptsMade,
      queuedAt: resolvedJob.data.queuedAt,
    });

    logWorkerEvent("job_started", {
      queueName,
      jobId,
      jobName: resolvedJob.name,
      correlationId: resolvedJob.data.context.correlationId,
      attemptsMade: resolvedJob.attemptsMade ?? 0,
    });
  });

  worker.on("completed", (job) => {
    const resolvedJob = job as AppQueueJob;
    const jobId = String(resolvedJob.id ?? "");

    void markQueueJobLifecycle({
      jobId,
      queueName,
      jobName: resolvedJob.name,
      context: toJobContext(resolvedJob),
      status: "completed",
      attemptsMade: resolvedJob.attemptsMade,
      queuedAt: resolvedJob.data.queuedAt,
      result: resolvedJob.returnvalue,
    });

    logWorkerEvent("job_succeeded", {
      queueName,
      jobId,
      jobName: resolvedJob.name,
      correlationId: resolvedJob.data.context.correlationId,
      attemptsMade: resolvedJob.attemptsMade ?? 0,
    });
  });

  worker.on("failed", (job, error) => {
    const resolvedJob = job as AppQueueJob | undefined;
    const jobId = resolvedJob?.id ? String(resolvedJob.id) : "";
    const context = resolvedJob?.data.context;

    if (resolvedJob && jobId && context) {
      void markQueueJobLifecycle({
        jobId,
        queueName,
        jobName: resolvedJob.name,
        context,
        status: "failed",
        attemptsMade: resolvedJob.attemptsMade,
        queuedAt: resolvedJob.data.queuedAt,
        error,
      });
    }

    logWorkerEvent("job_failed", {
      queueName,
      jobId: jobId || null,
      jobName: resolvedJob?.name ?? null,
      correlationId: context?.correlationId ?? null,
      attemptsMade: resolvedJob?.attemptsMade ?? 0,
      message: error.message,
    });
  });
};

const startWorker = async () => {
  const resolvedRedisConfig = initializeRedisConfig();
  logRedisStartupDiagnostics(resolvedRedisConfig);

  if (!isQueueEnabled()) {
    console.info(`${QUEUE_WORKER_LOG_PREFIX} USE_QUEUE is disabled; worker not started`);
    return;
  }

  const connection = await getBullmqRedisConnection();
  if (!connection) {
    throw new Error("Queue connection is not available.");
  }

  const stopHeartbeat = startQueueWorkerHeartbeat();
  const workers = APP_QUEUE_NAMES.map((queueName) => {
    const definition = APP_QUEUE_DEFINITIONS[queueName];
    const worker = new Worker(queueName, processQueueJob, {
      connection,
      concurrency: definition.concurrency,
      ...(definition.limiter ? { limiter: definition.limiter } : {}),
    });

    registerWorkerLifecycleLogging(queueName, worker);
    return { queueName, worker, definition };
  });

  const shutdown = async (signal: string) => {
    logWorkerEvent("shutdown", {
      signal,
      queues: APP_QUEUE_NAMES,
    });
    stopHeartbeat();
    await Promise.all(workers.map(({ worker }) => worker.close()));
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  for (const { queueName, definition } of workers) {
    logWorkerEvent("started", {
      queueName,
      concurrency: definition.concurrency,
      attempts: definition.defaultAttempts,
      backoffMs: definition.defaultBackoffMs,
      priority: definition.priority,
      rateLimit: definition.limiter ?? null,
    });
  }
};

void startWorker().catch((error) => {
  if (error instanceof RedisConfigValidationError) {
    logRedisStartupFailure(error);
  }
  console.error("[queues.worker] failed to start", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
