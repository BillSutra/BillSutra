import {
  resolveFrontendBackendUrl,
  validateFrontendEnv,
} from "./runtimeEnv";

validateFrontendEnv();

class Env {
  static APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

  static BACKEND_URL = resolveFrontendBackendUrl();

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
