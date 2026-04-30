type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

type SentryScope = {
  setLevel: (level: SeverityLevel) => void;
  setTag: (key: string, value: string) => void;
  setContext: (name: string, value: Record<string, unknown>) => void;
};

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown) => void;
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
    sentryModulePromise = import("@sentry/browser")
      .then((module) => module as unknown as SentryModule)
      .catch((error) => {
        if (!sentryMissingLogged) {
          sentryMissingLogged = true;
          console.warn(
            "[observability] Frontend Sentry disabled because the browser SDK is unavailable.",
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
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

export type { SeverityLevel, SentryModule, SentryScope };
