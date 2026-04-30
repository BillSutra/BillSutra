import {
  captureFrontendRequestError,
  loadNextjsSentry,
} from "./src/lib/observability/next-sentry";

export async function register() {
  const Sentry = await loadNextjsSentry();
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
