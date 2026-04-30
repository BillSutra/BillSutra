import {
  captureFrontendRouterTransitionStart,
} from "./src/lib/observability/next-sentry";
import { initFrontendSentry } from "./src/lib/observability/sentry";
import {
  buildSharedSentryInitOptions,
  parseFrontendSentryTraceSampleRate,
} from "./src/lib/observability/sentry-options";

void initFrontendSentry(
  buildSharedSentryInitOptions({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development",
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: parseFrontendSentryTraceSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
  }),
);

export const onRouterTransitionStart = (...args: unknown[]) => {
  void captureFrontendRouterTransitionStart(...args);
};
