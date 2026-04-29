import * as Sentry from "@sentry/nextjs";
import {
  buildSharedSentryInitOptions,
  parseFrontendSentryTraceSampleRate,
} from "./src/lib/observability/sentry-options";

Sentry.init(
  buildSharedSentryInitOptions({
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development",
    release:
      process.env.SENTRY_RELEASE || process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: parseFrontendSentryTraceSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE ||
        process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    ),
  }) as Parameters<typeof Sentry.init>[0],
);
