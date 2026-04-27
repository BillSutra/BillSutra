import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "..");

const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

let exportedConfig = nextConfig;

if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
  try {
    const { withSentryConfig } = await import("@sentry/nextjs");
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      webpack: {
        treeshake: {
          removeDebugLogging: true,
        },
      },
    });
  } catch (error) {
    console.warn(
      "[next.config] Sentry config skipped because @sentry/nextjs is not installed.",
      {
        message: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

export default exportedConfig;
