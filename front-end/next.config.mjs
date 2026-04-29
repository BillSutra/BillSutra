import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "..");
const runtimeAppEnv = (
  process.env.APP_ENV ??
  process.env.NEXT_PUBLIC_APP_ENV ??
  process.env.NODE_ENV ??
  "development"
)
  .trim()
  .toLowerCase();

const parseEnvFile = (filePath) => {
  const entries = {};
  const fileContents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of fileContents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const cleanedLine = line.startsWith("export ")
      ? line.slice("export ".length).trim()
      : line;
    const separatorIndex = cleanedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = cleanedLine.slice(0, separatorIndex).trim();
    let value = cleanedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
};

const loadFrontendEnvFiles = () => {
  const candidates = [".env", `.env.${runtimeAppEnv}`];

  if (runtimeAppEnv === "development") {
    candidates.push(".env.local");
  }

  candidates.push(`.env.${runtimeAppEnv}.local`);

  for (const candidate of candidates) {
    const resolvedPath = path.join(configDir, candidate);
    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    const parsed = parseEnvFile(resolvedPath);
    for (const [key, value] of Object.entries(parsed)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
};

loadFrontendEnvFiles();

const nextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps:
    process.env.NEXT_ENABLE_BROWSER_SOURCEMAPS === "true",
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
