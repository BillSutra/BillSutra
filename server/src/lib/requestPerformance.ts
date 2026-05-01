import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response, RequestHandler } from "express";

type PhaseStat = {
  totalMs: number;
  count: number;
};

type CacheEvent = {
  layer: string;
  key: string;
  hit: boolean;
  durationMs: number;
};

type AuthSummary = {
  source: "header" | "cookie" | "query" | "none";
  durationMs: number;
  outcome: "granted" | "rejected" | "service_unavailable";
};

type RequestPerformanceContext = {
  requestId: string;
  method: string;
  path: string;
  startedAt: number;
  phases: Map<string, PhaseStat>;
  dbQueryCount: number;
  dbDurationMs: number;
  dbDuplicateQueryCount: number;
  dbQueries: Map<string, number>;
  cacheEvents: CacheEvent[];
  auth?: AuthSummary;
};

const requestPerformanceStore =
  new AsyncLocalStorage<RequestPerformanceContext>();

const PERF_LOG_ENV = process.env.PERFORMANCE_AUDIT_LOGS;

export const isRequestPerformanceEnabled = () => {
  if (PERF_LOG_ENV === "true") {
    return true;
  }

  if (PERF_LOG_ENV === "false") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
};

const getContext = () => requestPerformanceStore.getStore();

const addPhaseDuration = (name: string, durationMs: number) => {
  const context = getContext();
  if (!context || durationMs < 0) {
    return;
  }

  const current = context.phases.get(name);
  if (current) {
    current.totalMs += durationMs;
    current.count += 1;
    return;
  }

  context.phases.set(name, {
    totalMs: durationMs,
    count: 1,
  });
};

export const recordRequestPhase = (name: string, durationMs: number) => {
  addPhaseDuration(name, durationMs);
};

export const measureRequestPhase = async <T>(
  name: string,
  task: () => Promise<T>,
): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await task();
  } finally {
    addPhaseDuration(name, performance.now() - startedAt);
  }
};

export const recordRequestCacheEvent = (event: CacheEvent) => {
  const context = getContext();
  if (!context) {
    return;
  }

  context.cacheEvents.push(event);
};

export const recordRequestDbQuery = (query: string, durationMs: number) => {
  const context = getContext();
  if (!context) {
    return;
  }

  context.dbQueryCount += 1;
  context.dbDurationMs += durationMs;
  const currentCount = context.dbQueries.get(query) ?? 0;
  context.dbQueries.set(query, currentCount + 1);
  if (currentCount >= 1) {
    context.dbDuplicateQueryCount += 1;
  }
};

export const recordRequestAuthSummary = (summary: AuthSummary) => {
  const context = getContext();
  if (!context) {
    return;
  }

  context.auth = summary;
};

const serializePhaseEntries = (phases: Map<string, PhaseStat>) =>
  Array.from(phases.entries())
    .sort((left, right) => right[1].totalMs - left[1].totalMs)
    .map(([name, stat]) => ({
      name,
      totalMs: Number(stat.totalMs.toFixed(2)),
      count: stat.count,
      avgMs: Number((stat.totalMs / stat.count).toFixed(2)),
    }));

const serializeTopDuplicateQueries = (
  queries: Map<string, number>,
  limit = 5,
) =>
  Array.from(queries.entries())
    .filter(([, count]) => count > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([query, count]) => ({
      count,
      query: query.length > 240 ? `${query.slice(0, 237)}...` : query,
    }));

export const requestPerformanceMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!isRequestPerformanceEnabled() || !req.originalUrl.startsWith("/api")) {
    next();
    return;
  }

  const context: RequestPerformanceContext = {
    requestId: req.requestId ?? "unknown",
    method: req.method,
    path: req.originalUrl || req.url,
    startedAt: performance.now(),
    phases: new Map(),
    dbQueryCount: 0,
    dbDurationMs: 0,
    dbDuplicateQueryCount: 0,
    dbQueries: new Map(),
    cacheEvents: [],
  };

  requestPerformanceStore.run(context, () => {
    res.on("finish", () => {
      const totalMs = performance.now() - context.startedAt;

      console.info("[perf.request]", {
        requestId: context.requestId,
        method: context.method,
        path: context.path,
        statusCode: res.statusCode,
        totalMs: Number(totalMs.toFixed(2)),
        auth: context.auth,
        db: {
          queryCount: context.dbQueryCount,
          totalMs: Number(context.dbDurationMs.toFixed(2)),
          duplicateQueryCount: context.dbDuplicateQueryCount,
          topDuplicates: serializeTopDuplicateQueries(context.dbQueries),
        },
        cache: context.cacheEvents,
        phases: serializePhaseEntries(context.phases),
      });
    });

    next();
  });
};

export const withTimedMiddleware = (
  name: string,
  middleware: RequestHandler,
): RequestHandler => {
  return (req, res, next) => {
    if (!isRequestPerformanceEnabled()) {
      middleware(req, res, next);
      return;
    }

    const startedAt = performance.now();
    let settled = false;

    const complete = (err?: unknown) => {
      if (settled) {
        return;
      }

      settled = true;
      addPhaseDuration(`middleware.${name}`, performance.now() - startedAt);
      next(err);
    };

    const finalizeOnResponse = () => {
      if (settled) {
        return;
      }

      settled = true;
      addPhaseDuration(`middleware.${name}`, performance.now() - startedAt);
    };

    res.once("finish", finalizeOnResponse);
    res.once("close", finalizeOnResponse);

    try {
      const result = middleware(req, res, (err?: unknown) => {
        res.off("finish", finalizeOnResponse);
        res.off("close", finalizeOnResponse);
        complete(err);
      });

      if (result && typeof (result as PromiseLike<unknown>).then === "function") {
        void (result as PromiseLike<unknown>).then(
          () => undefined,
          (error) => {
            res.off("finish", finalizeOnResponse);
            res.off("close", finalizeOnResponse);
            complete(error);
          },
        );
      }
    } catch (error) {
      res.off("finish", finalizeOnResponse);
      res.off("close", finalizeOnResponse);
      complete(error);
    }
  };
};
