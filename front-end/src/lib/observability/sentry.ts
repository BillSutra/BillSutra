type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

type SentryScope = {
  setLevel: (level: SeverityLevel) => void;
  setTag: (key: string, value: string) => void;
  setContext: (name: string, value: Record<string, unknown>) => void;
};

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown) => void;
  captureRequestError?: (...args: unknown[]) => unknown;
  captureRouterTransitionStart?: (...args: unknown[]) => unknown;
  setUser: (user: Record<string, unknown> | null) => void;
  withScope: (callback: (scope: SentryScope) => void) => void;
};

let sentryModulePromise: Promise<SentryModule | null> | null = null;
let sentryInitStarted = false;
let sentryMissingLogged = false;

const isSentryEnabled = () => Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

export const loadFrontendSentry = async (): Promise<SentryModule | null> => {
  if (!isSentryEnabled()) {
    return null;
  }

  if (!sentryModulePromise) {
    sentryModulePromise = import("@sentry/nextjs")
      .then((module) => module as unknown as SentryModule)
      .catch((error) => {
        if (!sentryMissingLogged) {
          sentryMissingLogged = true;
          console.warn("[observability] Frontend Sentry disabled because @sentry/nextjs is not installed.", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
        return null;
      });
  }

  return sentryModulePromise;
};

export const initFrontendSentry = async (
  options: Record<string, unknown>,
) => {
  if (sentryInitStarted || !isSentryEnabled()) {
    return;
  }

  sentryInitStarted = true;
  const Sentry = await loadFrontendSentry();
  if (!Sentry) {
    return;
  }

  Sentry.init(options);
};

export const captureFrontendSentryException = async (error: unknown) => {
  const Sentry = await loadFrontendSentry();
  Sentry?.captureException(error);
};

export const captureFrontendRouterTransitionStart = async (
  ...args: unknown[]
) => {
  const Sentry = await loadFrontendSentry();
  Sentry?.captureRouterTransitionStart?.(...args);
};

export const captureFrontendRequestError = async (...args: unknown[]) => {
  const Sentry = await loadFrontendSentry();
  Sentry?.captureRequestError?.(...args);
};

export type { SeverityLevel, SentryModule, SentryScope };
