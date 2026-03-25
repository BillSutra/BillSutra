import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import * as Sentry from "@sentry/node";

type TelemetryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TelemetryValue[]
  | { [key: string]: TelemetryValue };

type CaptureContext = {
  level?: Sentry.SeverityLevel;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "confirm_password",
  "token",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "otp",
  "otp_code",
  "passcode",
  "challenge",
  "challenge_id",
  "transaction_id",
  "provider_response",
  "signature",
]);

const MAX_DEPTH = 4;
const DEFAULT_DEV_SAMPLE_RATE = 1;
const DEFAULT_PROD_SAMPLE_RATE = 0.2;
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1_200;

const parseSampleRate = (value: string | undefined) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return process.env.NODE_ENV === "production"
      ? DEFAULT_PROD_SAMPLE_RATE
      : DEFAULT_DEV_SAMPLE_RATE;
  }

  return Math.min(1, Math.max(0, numericValue));
};

const shouldInitializeObservability = () =>
  Boolean(process.env.SENTRY_DSN?.trim());

const getObservabilityEnvironment = () =>
  process.env.SENTRY_ENVIRONMENT?.trim() ||
  process.env.NODE_ENV ||
  "development";

const getSlowRequestThreshold = () => {
  const threshold = Number(process.env.SENTRY_SLOW_REQUEST_THRESHOLD_MS);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
  }

  return threshold;
};

const sanitizeTelemetryValue = (
  value: unknown,
  depth = 0,
): TelemetryValue => {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return "[truncated]";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeTelemetryValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase())
          ? "[redacted]"
          : sanitizeTelemetryValue(nestedValue, depth + 1),
      ],
    );

    return Object.fromEntries(entries);
  }

  return String(value);
};

const buildRequestContext = (req: Request) => ({
  requestId: req.requestId,
  method: req.method,
  path: req.originalUrl || req.url,
  params: sanitizeTelemetryValue(req.params),
  query: sanitizeTelemetryValue(req.query),
  body: sanitizeTelemetryValue(req.body),
});

const buildUserPayload = (req: Request) =>
  req.user
    ? {
        id: String(req.user.id),
        email: req.user.email,
        role: req.user.role,
        businessId: req.user.businessId,
        accountType: req.user.accountType,
      }
    : null;

export const initServerObservability = () => {
  if (!shouldInitializeObservability()) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: getObservabilityEnvironment(),
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    integrations: [
      Sentry.httpIntegration({ spans: true }),
      Sentry.expressIntegration(),
    ],
    sendDefaultPii: false,
  });
};

export const requestObservabilityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.requestId = req.headers["x-request-id"]?.toString() || randomUUID();
  req.requestStartedAt = Date.now();
  res.setHeader("x-request-id", req.requestId);

  const startedAt = req.requestStartedAt;
  res.on("finish", () => {
    if (!shouldInitializeObservability()) {
      return;
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs < getSlowRequestThreshold()) {
      return;
    }

    Sentry.withScope((scope) => {
      scope.setLevel("warning");
      scope.setTag("kind", "slow_request");
      scope.setTag("request_id", req.requestId ?? "unknown");
      scope.setTag("method", req.method);
      scope.setTag("status_code", res.statusCode);
      scope.setUser(buildUserPayload(req));
      scope.setContext("request", buildRequestContext(req));
      scope.setContext("performance", {
        durationMs,
        thresholdMs: getSlowRequestThreshold(),
      });
      Sentry.captureMessage(`Slow request: ${req.method} ${req.originalUrl}`);
    });
  });

  next();
};

export const setObservabilityUser = (authUser: AuthUser | null | undefined) => {
  if (!shouldInitializeObservability()) {
    return;
  }

  if (!authUser) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: String(authUser.id),
    email: authUser.email,
    role: authUser.role,
    businessId: authUser.businessId,
    accountType: authUser.accountType,
  });
};

export const captureServerException = (
  error: unknown,
  req: Request,
  context?: CaptureContext,
) => {
  if (!shouldInitializeObservability()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(context?.level ?? "error");
    scope.setUser(buildUserPayload(req));
    scope.setTag("environment", getObservabilityEnvironment());
    scope.setTag("endpoint", req.originalUrl || req.url);
    scope.setTag("method", req.method);
    scope.setTag("request_id", req.requestId ?? "unknown");

    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        scope.setTag(key, String(value));
      }
    });

    scope.setContext("request", buildRequestContext(req));

    const headers = sanitizeTelemetryValue({
      "user-agent": req.headers["user-agent"],
      referer: req.headers.referer,
      origin: req.headers.origin,
    });
    scope.setContext("headers", headers as Record<string, TelemetryValue>);

    if (context?.extra) {
      scope.setContext(
        "extra",
        sanitizeTelemetryValue(context.extra) as Record<string, TelemetryValue>,
      );
    }

    Sentry.captureException(error);
  });
};

export const captureServerMessage = (
  message: string,
  req: Request,
  context?: CaptureContext,
) => {
  if (!shouldInitializeObservability()) {
    return;
  }

  Sentry.withScope((scope) => {
    scope.setLevel(context?.level ?? "warning");
    scope.setUser(buildUserPayload(req));
    scope.setTag("environment", getObservabilityEnvironment());
    scope.setTag("endpoint", req.originalUrl || req.url);
    scope.setTag("method", req.method);
    scope.setTag("request_id", req.requestId ?? "unknown");

    Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        scope.setTag(key, String(value));
      }
    });

    scope.setContext("request", buildRequestContext(req));

    if (context?.extra) {
      scope.setContext(
        "extra",
        sanitizeTelemetryValue(context.extra) as Record<string, TelemetryValue>,
      );
    }

    Sentry.captureMessage(message);
  });
};

export const flushObservability = async (timeoutMs = 2_000) => {
  if (!shouldInitializeObservability()) {
    return;
  }

  await Sentry.flush(timeoutMs);
};
