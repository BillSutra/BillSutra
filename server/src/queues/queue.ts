import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type {
  DefaultQueueJobDataMap,
  DefaultQueueJobName,
} from "./types.js";
import {
  getBullmqRedisConnection,
  isQueueEnabled,
} from "../redis/queue/index.js";

export const DEFAULT_QUEUE_NAME = "default";
const QUEUE_HEARTBEAT_KEY = "queues:default:worker:heartbeat";
const QUEUE_HEARTBEAT_TTL_SECONDS = 45;

const QUEUE_LOG_PREFIX = "[queues]";

let defaultQueue:
  | Queue<
      DefaultQueueJobDataMap[DefaultQueueJobName],
      unknown,
      DefaultQueueJobName
    >
  | null = null;

export const getDefaultQueue = () => {
  return defaultQueue;
};

export const markQueueWorkerHeartbeat = async () => {
  const connection = await getBullmqRedisConnection();
  if (!connection) {
    return false;
  }

  await connection.set(
    QUEUE_HEARTBEAT_KEY,
    String(Date.now()),
    "EX",
    QUEUE_HEARTBEAT_TTL_SECONDS,
  );
  return true;
};

export const isQueueWorkerAvailable = async () => {
  const connection = await getBullmqRedisConnection();
  if (!connection) {
    return false;
  }

  try {
    const heartbeat = await connection.get(QUEUE_HEARTBEAT_KEY);
    return Boolean(heartbeat);
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

export const enqueueDefaultJob = async <TName extends DefaultQueueJobName>({
  jobName,
  data,
  jobId,
  options,
}: {
  jobName: TName;
  data: DefaultQueueJobDataMap[TName];
  jobId?: string;
  options?: Omit<JobsOptions, "jobId">;
}) => {
  if (!isQueueEnabled()) {
    return { queued: false as const, reason: "disabled" as const };
  }

  const queue = getDefaultQueue();
  if (!queue) {
    const connection = await getBullmqRedisConnection();
    if (!connection) {
      return {
        queued: false as const,
        reason: "connection_unavailable" as const,
      };
    }

    defaultQueue = new Queue(DEFAULT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }

  if (!defaultQueue) {
    return { queued: false as const, reason: "connection_unavailable" as const };
  }

  const workerAvailable = await isQueueWorkerAvailable();
  if (!workerAvailable) {
    // Migration-safe fallback: if the worker is down, callers stay synchronous.
    return { queued: false as const, reason: "worker_unavailable" as const };
  }

  try {
    const job = await defaultQueue.add(jobName, data, {
      ...(options ?? {}),
      ...(jobId ? { jobId } : {}),
    });

    console.info(`${QUEUE_LOG_PREFIX} enqueued`, {
      queue: DEFAULT_QUEUE_NAME,
      jobId: String(job.id ?? jobId ?? ""),
      jobName,
    });

    return {
      queued: true as const,
      jobId: String(job.id ?? jobId ?? ""),
    };
  } catch (error) {
    console.error(`${QUEUE_LOG_PREFIX} enqueue failed`, {
      queue: DEFAULT_QUEUE_NAME,
      jobId: jobId ?? null,
      jobName,
      message: error instanceof Error ? error.message : String(error),
    });
    return { queued: false as const, reason: "enqueue_failed" as const };
  }
};
