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
  "signature",
  "client_secret",
]);

const MAX_DEPTH = 4;

const sanitizeValue = (value: unknown, depth = 0): unknown => {
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
    return value.map((entry) => sanitizeValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase())
          ? "[redacted]"
          : sanitizeValue(nested, depth + 1),
      ]),
    );
  }

  return String(value);
};

const parseSampleRate = (
  value: string | undefined,
  fallbackProd = 0.2,
  fallbackDev = 1,
) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return process.env.NODE_ENV === "production" ? fallbackProd : fallbackDev;
  }

  return Math.min(1, Math.max(0, numericValue));
};

export const buildSharedSentryInitOptions = (overrides: Record<string, unknown>) => {
  const ignoreErrors = [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications.",
    "Network request failed",
    "Load failed",
  ];

  const denyUrls = [
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /extensions\//i,
  ];

  return {
    sendDefaultPii: false,
    ignoreErrors,
    denyUrls,
    beforeSend(event: unknown) {
      return sanitizeValue(event);
    },
    beforeBreadcrumb(breadcrumb: unknown) {
      return sanitizeValue(breadcrumb);
    },
    ...overrides,
  };
};

export const parseFrontendSentryTraceSampleRate = (value: string | undefined) =>
  parseSampleRate(value, 0.2, 1);
