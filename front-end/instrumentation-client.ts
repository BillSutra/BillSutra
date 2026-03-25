import * as Sentry from "@sentry/nextjs";

const parseSampleRate = (value: string | undefined) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return process.env.NODE_ENV === "production" ? 0.2 : 1;
  }

  return Math.min(1, Math.max(0, numericValue));
};

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development",
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  tracesSampleRate: parseSampleRate(
    process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  ),
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
