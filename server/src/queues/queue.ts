import { randomUUID } from "node:crypto";
import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import {
  getBullmqRedisConnection,
  isQueueEnabled,
} from "../redis/queue/index.js";
import { getCache, setCache } from "../redis/cache.js";
import {
  APP_QUEUE_DEFINITIONS,
  APP_QUEUE_JOB_TO_QUEUE,
  APP_QUEUE_NAMES,
  type AppQueueContextInput,
  type AppQueueJobEnvelope,
  type AppQueueJobName,
  type AppQueueJobPayloadMap,
  type AppQueueJobStatus,
  type AppQueueJobStatusRecord,
  type AppQueueName,
  type QueueContextMetadata,
} from "./types.js";

const WORKER_HEARTBEAT_KEY = "queues:worker:heartbeat";
const WORKER_HEARTBEAT_TTL_SECONDS = 45;
const JOB_STATUS_KEY_PREFIX = "queues:job-status";
const JOB_STATUS_TTL_SECONDS = Math.max(
  Number(process.env.QUEUE_JOB_STATUS_TTL_SECONDS ?? 7 * 24 * 60 * 60),
  60,
);
const QUEUE_LOG_PREFIX = "[queues]";

const queueInstances = new Map<
  AppQueueName,
  Queue<
    AppQueueJobEnvelope<AppQueueJobPayloadMap[AppQueueJobName]>,
    unknown,
    AppQueueJobName
  >
>();

const normalizeMetadata = (
  metadata?: QueueContextMetadata,
): QueueContextMetadata => {
  if (!metadata) {
    return {};
  }

  const entries = Object.entries(metadata).filter(([, value]) => {
    return (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  });

  return Object.fromEntries(entries);
};

export const buildQueueContext = (
  input?: AppQueueContextInput,
) => ({
  businessId: input?.businessId?.trim() || null,
  userId:
    typeof input?.userId === "number" && Number.isFinite(input.userId)
      ? input.userId
      : null,
  actorId: input?.actorId?.trim() || null,
  correlationId: input?.correlationId?.trim() || randomUUID(),
  metadata: normalizeMetadata(input?.metadata),
});

const buildJobStatusKey = (jobId: string) => `${JOB_STATUS_KEY_PREFIX}:${jobId}`;

const logQueueEvent = (
  event:
    | "heartbeat"
    | "enqueued"
    | "worker_unavailable"
    | "enqueue_failed"
    | "status_updated",
  detail: Record<string, unknown>,
) => {
  const logger =
    event === "enqueue_failed" ? console.error : console.info;
  logger(`${QUEUE_LOG_PREFIX} ${event}`, detail);
};

const writeQueueJobStatus = async (record: AppQueueJobStatusRecord) => {
  await setCache(buildJobStatusKey(record.jobId), record, JOB_STATUS_TTL_SECONDS);
  logQueueEvent("status_updated", {
    jobId: record.jobId,
    queueName: record.queueName,
    jobName: record.jobName,
    status: record.status,
  });
};

export const getQueueJobStatus = async (jobId: string) =>
  getCache<AppQueueJobStatusRecord>(buildJobStatusKey(jobId));

export const markQueueJobLifecycle = async (params: {
  jobId: string;
  queueName: AppQueueName;
  jobName: AppQueueJobName;
  context: ReturnType<typeof buildQueueContext>;
  status: AppQueueJobStatus;
  attemptsMade?: number;
  result?: unknown;
  error?: Error | null;
  queuedAt?: string;
}) => {
  const existing = await getQueueJobStatus(params.jobId);
  const now = new Date().toISOString();

  const nextRecord: AppQueueJobStatusRecord = {
    jobId: params.jobId,
    queueName: params.queueName,
    jobName: params.jobName,
    status: params.status,
    queuedAt: params.queuedAt ?? existing?.queuedAt ?? now,
    updatedAt: now,
    startedAt:
      params.status === "active"
        ? now
        : existing?.startedAt ?? null,
    completedAt:
      params.status === "completed"
        ? now
        : existing?.completedAt ?? null,
    failedAt:
      params.status === "failed"
        ? now
        : existing?.failedAt ?? null,
    attemptsMade:
      typeof params.attemptsMade === "number"
        ? params.attemptsMade
        : existing?.attemptsMade ?? 0,
    businessId: params.context.businessId,
    userId: params.context.userId,
    actorId: params.context.actorId,
    correlationId: params.context.correlationId,
    metadata: params.context.metadata,
    result:
      params.status === "completed"
        ? params.result
        : existing?.result,
    error:
      params.status === "failed" && params.error
        ? { message: params.error.message }
        : null,
  };

  await writeQueueJobStatus(nextRecord);
  return nextRecord;
};

const resolveQueueDefaults = (queueName: AppQueueName) => {
  const definition = APP_QUEUE_DEFINITIONS[queueName];
  return {
    attempts: definition.defaultAttempts,
    backoff: {
      type: "exponential",
      delay: definition.defaultBackoffMs,
    },
    removeOnComplete: definition.removeOnComplete,
    removeOnFail: definition.removeOnFail,
  };
};

const getQueueInstance = async (queueName: AppQueueName) => {
  const existing = queueInstances.get(queueName);
  if (existing) {
    return existing;
  }

  const connection = await getBullmqRedisConnection();
  if (!connection) {
    return null;
  }

  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: resolveQueueDefaults(queueName),
  }) as Queue<
    AppQueueJobEnvelope<AppQueueJobPayloadMap[AppQueueJobName]>,
    unknown,
    AppQueueJobName
  >;
  queueInstances.set(queueName, queue);
  return queue;
};

export const markQueueWorkerHeartbeat = async () => {
  const connection = await getBullmqRedisConnection();
  if (!connection) {
    return false;
  }

  await connection.set(
    WORKER_HEARTBEAT_KEY,
    String(Date.now()),
    "EX",
    WORKER_HEARTBEAT_TTL_SECONDS,
  );
  logQueueEvent("heartbeat", {
    queueNames: APP_QUEUE_NAMES,
  });
  return true;
};

export const isQueueWorkerAvailable = async () => {
  const connection = await getBullmqRedisConnection();
  if (!connection) {
    return false;
  }

  try {
    return Boolean(await connection.get(WORKER_HEARTBEAT_KEY));
  } catch (error) {
    console.warn(`${QUEUE_LOG_PREFIX} heartbeat lookup failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
};

export const startQueueWorkerHeartbeat = () => {
  if (!isQueueEnabled()) {
    return () => {};
  }

  let cancelled = false;
  const beat = async () => {
    if (cancelled) {
      return;
    }

    try {
      await markQueueWorkerHeartbeat();
    } catch (error) {
      console.warn(`${QUEUE_LOG_PREFIX} worker heartbeat failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void beat();
  const interval = setInterval(() => {
    void beat();
  }, 15_000);
  interval.unref();

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const enqueueQueueJob = async <TName extends AppQueueJobName>(params: {
  jobName: TName;
  payload: AppQueueJobPayloadMap[TName];
  context?: AppQueueContextInput;
  jobId?: string;
  options?: Omit<JobsOptions, "jobId">;
}) => {
  if (!isQueueEnabled()) {
    return { queued: false as const, reason: "disabled" as const };
  }

  const queueName = APP_QUEUE_JOB_TO_QUEUE[params.jobName];
  const queue = await getQueueInstance(queueName);
  if (!queue) {
    return {
      queued: false as const,
      reason: "connection_unavailable" as const,
    };
  }

  const workerAvailable = await isQueueWorkerAvailable();
  if (!workerAvailable) {
    logQueueEvent("worker_unavailable", {
      queueName,
      jobName: params.jobName,
      jobId: params.jobId ?? null,
    });
    return { queued: false as const, reason: "worker_unavailable" as const };
  }

  const context = buildQueueContext(params.context);
  const jobData: AppQueueJobEnvelope<AppQueueJobPayloadMap[TName]> = {
    version: 1,
    queuedAt: new Date().toISOString(),
    context,
    payload: params.payload,
  };

  try {
    const job = await queue.add(params.jobName, jobData as never, {
      ...(params.options ?? {}),
      ...(params.jobId ? { jobId: params.jobId } : {}),
    });
    const resolvedJobId = String(job.id ?? params.jobId ?? "");

    await markQueueJobLifecycle({
      jobId: resolvedJobId,
      queueName,
      jobName: params.jobName,
      context,
      status: "queued",
      queuedAt: jobData.queuedAt,
    });

    logQueueEvent("enqueued", {
      queueName,
      jobName: params.jobName,
      jobId: resolvedJobId,
      correlationId: context.correlationId,
      priority: APP_QUEUE_DEFINITIONS[queueName].priority,
    });

    return {
      queued: true as const,
      jobId: resolvedJobId,
      queueName,
      trackingId: resolvedJobId,
    };
  } catch (error) {
    logQueueEvent("enqueue_failed", {
      queueName,
      jobName: params.jobName,
      jobId: params.jobId ?? null,
      message: error instanceof Error ? error.message : String(error),
    });
    return { queued: false as const, reason: "enqueue_failed" as const };
  }
};
