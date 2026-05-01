import path from "path";
import { existsSync, readFileSync } from "fs";
import { parse } from "dotenv";
import { fileURLToPath } from "url";

const SERVER_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const SHADOW_AUDIT_KEYS = new Set([
  "ACCESS_TOKEN_SECRET",
  "APP_ENV",
  "APP_URL",
  "BACKEND_URL",
  "CORS_ORIGIN",
  "CORS_ORIGINS",
  "DATABASE_URL",
  "EMAIL_PASS",
  "EMAIL_USER",
  "FRONTEND_URL",
  "JWT_SECRET",
  "PORT",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "REDIS_URL",
  "REFRESH_TOKEN_SECRET",
  "UPSTASH_REDIS_REST_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "USE_QUEUE",
  "USE_REDIS_CACHE",
  "USE_REDIS_RATE_LIMIT",
]);

const normalize = (value?: string | null) => value?.trim() ?? "";
const isTruthy = (value?: string | null) =>
  normalize(value).toLowerCase() === "true";

const normalizeEnvName = (value?: string | null) => {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) {
    return "development";
  }

  if (normalized === "prod") {
    return "production";
  }

  if (normalized === "dev") {
    return "development";
  }

  return normalized;
};

const describe = (value: string) => {
  const normalized = normalize(value);

  if (!normalized) {
    return "empty";
  }

  return `length=${normalized.length}`;
};

const resolveRuntimeEnvName = () =>
  normalizeEnvName(
    process.env.SERVER_ENV ??
      process.env.APP_ENV ??
      process.env.NODE_ENV ??
      "development",
  );

const resolveEnvPath = (value: string) =>
  path.isAbsolute(value) ? value : path.resolve(SERVER_ROOT, value);

const resolveEnvFileCandidates = () => {
  const explicitEnvFile = normalize(process.env.SERVER_ENV_FILE);
  if (explicitEnvFile) {
    return [resolveEnvPath(explicitEnvFile)];
  }

  const runtimeEnvName = resolveRuntimeEnvName();
  const envFiles = [".env", `.env.${runtimeEnvName}`];

  if (runtimeEnvName === "development") {
    envFiles.push(".env.local");
  }

  envFiles.push(`.env.${runtimeEnvName}.local`);

  return Array.from(
    new Set(envFiles.map((fileName) => path.resolve(SERVER_ROOT, fileName))),
  );
};

export const loadServerEnv = () => {
  const envPaths = resolveEnvFileCandidates().filter((envPath) =>
    existsSync(envPath),
  );

  if (envPaths.length === 0) {
    return;
  }

  const mergedEntries = new Map<string, string>();

  for (const envPath of envPaths) {
    const fileContents = readFileSync(envPath, "utf8");
    const parsedFile = parse(fileContents);
    for (const [key, value] of Object.entries(parsedFile)) {
      mergedEntries.set(key, value);
    }
  }

  const shadowedEntries = Array.from(mergedEntries.entries()).filter(([key, fileValue]) => {
    if (!SHADOW_AUDIT_KEYS.has(key)) {
      return false;
    }

    const existingValue = process.env[key];
    return normalize(existingValue) !== "" && existingValue !== fileValue;
  });

  const allowProcessOverride = isTruthy(
    process.env.SERVER_ENV_ALLOW_PROCESS_OVERRIDE,
  );

  for (const [key, value] of mergedEntries) {
    if (allowProcessOverride && normalize(process.env[key]) !== "") {
      continue;
    }

    process.env[key] = value;
  }

  for (const [key, fileValue] of shadowedEntries) {
    const processValue = process.env[key] ?? "";
    console.warn(
      allowProcessOverride
        ? "[env] Process environment is overriding .env"
        : "[env] .env replaced an existing process environment value",
      {
        key,
        processValue: describe(processValue),
        dotEnvValue: describe(fileValue),
      },
    );
  }
};
