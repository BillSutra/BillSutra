type NextSentryModule = {
  captureRequestError?: (...args: unknown[]) => unknown;
  captureRouterTransitionStart?: (...args: unknown[]) => unknown;
};

let nextSentryModulePromise: Promise<NextSentryModule | null> | null = null;
let nextSentryMissingLogged = false;

const isSentryEnabled = () =>
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || process.env.SENTRY_DSN?.trim());

export const loadNextjsSentry = async (): Promise<NextSentryModule | null> => {
  if (!isSentryEnabled()) {
    return null;
  }

  if (!nextSentryModulePromise) {
    nextSentryModulePromise = import("@sentry/nextjs")
      .then((module) => module as unknown as NextSentryModule)
      .catch((error) => {
        if (!nextSentryMissingLogged) {
          nextSentryMissingLogged = true;
          console.warn(
            "[observability] Next.js Sentry helpers disabled because @sentry/nextjs is unavailable.",
            {
              message: error instanceof Error ? error.message : String(error),
            },
          );
        }
        return null;
      });
  }

  return nextSentryModulePromise;
};

export const captureFrontendRouterTransitionStart = async (
  ...args: unknown[]
) => {
  const Sentry = await loadNextjsSentry();
  Sentry?.captureRouterTransitionStart?.(...args);
};

export const captureFrontendRequestError = async (...args: unknown[]) => {
  const Sentry = await loadNextjsSentry();
  Sentry?.captureRequestError?.(...args);
};
