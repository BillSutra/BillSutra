const DEFAULT_BACKEND_URL = "http://localhost:7000";

const normalizeBackendUrl = (rawValue?: string): string => {
  const trimmed = rawValue?.trim();

  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }

  // Accept values like :7000, 7000, localhost:7000, or full http(s) URLs.
  if (/^:\d+$/.test(trimmed)) {
    return `http://localhost${trimmed}`;
  }

  if (/^\d+$/.test(trimmed)) {
    return `http://localhost:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+:\d+$/i.test(trimmed)) {
    return `http://${trimmed}`;
  }

  return trimmed;
};

class Env {
  static APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

  static BACKEND_URL = normalizeBackendUrl(process.env.NEXT_PUBLIC_BACKEND_URL);

  static SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

  static SENTRY_ENVIRONMENT =
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NODE_ENV ??
    "development";

  static SENTRY_TRACES_SAMPLE_RATE =
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "";

  static POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

  static POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";

  static ANALYTICS_OPT_OUT_DEFAULT =
    process.env.NEXT_PUBLIC_ANALYTICS_OPT_OUT_DEFAULT ?? "false";

  static USE_SECURE_AUTH =
    process.env.NEXT_PUBLIC_USE_SECURE_AUTH ??
    process.env.USE_SECURE_AUTH ??
    "false";

  static USE_COOKIE_AUTH =
    process.env.NEXT_PUBLIC_USE_COOKIE_AUTH ??
    process.env.USE_COOKIE_AUTH ??
    "false";

  static USE_DYNAMIC_STATUS =
    process.env.NEXT_PUBLIC_USE_DYNAMIC_STATUS ??
    process.env.USE_DYNAMIC_STATUS ??
    "false";
}

export default Env;
