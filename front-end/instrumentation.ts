import {
  captureFrontendRequestError,
  loadFrontendSentry,
} from "./src/lib/observability/sentry";

export async function register() {
  const Sentry = await loadFrontendSentry();
  if (!Sentry) {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = (...args: unknown[]) => {
  void captureFrontendRequestError(...args);
};
