import type { Request, Response } from "express";
import { verifyDatabaseConnectivity } from "../config/db.config.js";
import { getAnalyticsDailyStatsSupportStatus } from "../services/analyticsDailyStats.service.js";
import { isQueueWorkerAvailable } from "../queues/queue.js";
import {
  getRedisClient,
  isQueueEnabled,
  isRedisCacheEnabled,
  isRedisRateLimitEnabled,
} from "../redis/redisClient.js";
import { sendResponse } from "../utils/sendResponse.js";

const checkRedisHealth = async () => {
  const redisEnabled =
    isRedisCacheEnabled() || isRedisRateLimitEnabled() || isQueueEnabled();

  if (!redisEnabled) {
    return {
      enabled: false,
      status: "disabled" as const,
    };
  }

  try {
    const client = await getRedisClient();
    if (!client) {
      return {
        enabled: true,
        status: "unavailable" as const,
      };
    }

    await client.pttl("__health__:redis");
    return {
      enabled: true,
      status: "ok" as const,
    };
  } catch (error) {
    return {
      enabled: true,
      status: "error" as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
};

class HealthController {
  static async status(req: Request, res: Response) {
    return sendResponse(res, 200, {
      status: "ok",
      environment:
        process.env.APP_ENV?.trim() ||
        process.env.NODE_ENV?.trim() ||
        "development",
      requestId: req.requestId ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  static async readiness(req: Request, res: Response) {
    let databaseStatus: "ok" | "error" = "ok";
    let databaseError: string | null = null;

    try {
      await verifyDatabaseConnectivity();
    } catch (error) {
      databaseStatus = "error";
      databaseError =
        error instanceof Error ? error.message : String(error);
    }

    const redis = await checkRedisHealth();
    const queueWorkerAvailable = isQueueEnabled()
      ? await isQueueWorkerAvailable()
      : false;
    const analytics = getAnalyticsDailyStatsSupportStatus();

    const isReady =
      databaseStatus === "ok" &&
      (redis.status === "ok" || redis.status === "disabled");

    return sendResponse(res, isReady ? 200 : 503, {
      status: isReady ? "ready" : "degraded",
      environment:
        process.env.APP_ENV?.trim() ||
        process.env.NODE_ENV?.trim() ||
        "development",
      requestId: req.requestId ?? null,
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: databaseStatus,
          ...(databaseError ? { error: databaseError } : {}),
        },
        redis,
        queue: {
          enabled: isQueueEnabled(),
          workerAvailable: isQueueEnabled() ? queueWorkerAvailable : false,
        },
        analytics,
      },
    });
  }
}

export default HealthController;
