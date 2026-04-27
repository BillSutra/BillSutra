import axios from "axios";
import {
  loadFrontendSentry,
  type SeverityLevel,
} from "./sentry";

type TelemetryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | TelemetryValue[]
  | { [key: string]: TelemetryValue };

type CaptureContext = {
  level?: SeverityLevel;
  tags?: Record<string, string | number | boolean | null | undefined>;
  extra?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "confirm_password",
  "token",
  "authorization",
  "cookie",
  "secret",
  "otp",
  "challenge",
  "challenge_id",
  "transaction_id",
  "reference",
]);

const MAX_DEPTH = 4;

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

const isSentryEnabled = () => Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

const isCriticalRoute = (url: string) =>
  ["/payments", "/auth/", "/invoices", "/purchases", "/sales"].some((segment) =>
    url.includes(segment),
  );

export const setFrontendObservabilityUser = (user?: {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  businessId?: string | null;
  accountType?: string | null;
} | null) => {
  if (!isSentryEnabled()) {
    return;
  }

  void loadFrontendSentry().then((Sentry) => {
    if (!Sentry) {
      return;
    }

    if (!user?.id) {
      Sentry.setUser(null);
      return;
    }

    Sentry.setUser({
      id: user.id,
      email: user.email ?? undefined,
      role: user.role ?? undefined,
      businessId: user.businessId ?? undefined,
      accountType: user.accountType ?? undefined,
    });
  });
};

export const captureFrontendException = (
  error: unknown,
  context?: CaptureContext,
) => {
  if (!isSentryEnabled()) {
    return;
  }

  void loadFrontendSentry().then((Sentry) => {
    if (!Sentry) {
      return;
    }

    Sentry.withScope((scope) => {
      scope.setLevel(context?.level ?? "error");

      Object.entries(context?.tags ?? {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          scope.setTag(key, String(value));
        }
      });

      if (context?.extra) {
        scope.setContext(
          "extra",
          sanitizeTelemetryValue(context.extra) as Record<string, unknown>,
        );
      }

      Sentry.captureException(error);
    });
  });
};

export const captureApiFailure = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    captureFrontendException(error, {
      tags: {
        source: "axios",
        has_response: false,
      },
    });
    return;
  }

  const status = error.response?.status ?? 0;
  const url = error.config?.url ?? "unknown";
  const method = (error.config?.method ?? "get").toUpperCase();
  const shouldCapture =
    status === 0 || status >= 500 || isCriticalRoute(url);

  if (!shouldCapture) {
    return;
  }

  captureFrontendException(error, {
    level: status >= 500 || status === 0 ? "error" : "warning",
    tags: {
      source: "axios",
      status_code: status || "network_error",
      method,
      url,
    },
    extra: {
      request: {
        url,
        method,
        params: error.config?.params,
        data: error.config?.data,
      },
      response: {
        status,
        data: error.response?.data,
      },
    },
  });
};

export const captureReactQueryError = (
  source: "query" | "mutation",
  error: unknown,
  details: Record<string, unknown>,
) => {
  captureFrontendException(error, {
    level: "warning",
    tags: {
      source: `react-query.${source}`,
    },
    extra: details,
  });
};

export const sanitizeObservabilityPayload = (value: unknown) =>
  sanitizeTelemetryValue(value);
