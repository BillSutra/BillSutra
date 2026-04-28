const isProd = process.env.NODE_ENV === "production";

const normalizeString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const assertStrongSecret = (name: string, value?: string | null) => {
  const normalized = normalizeString(value);
  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (normalized.length < 32) {
    throw new Error(`${name} must be at least 32 characters long`);
  }
};

export const validateSecurityEnv = () => {
  assertStrongSecret("JWT_SECRET", process.env.JWT_SECRET);

  const refreshSecret = normalizeString(process.env.REFRESH_TOKEN_SECRET);
  if (isProd) {
    assertStrongSecret("REFRESH_TOKEN_SECRET", refreshSecret);
  } else if (refreshSecret && refreshSecret.length < 32) {
    throw new Error("REFRESH_TOKEN_SECRET must be at least 32 characters long");
  }

  if (refreshSecret && refreshSecret === normalizeString(process.env.JWT_SECRET)) {
    console.warn(
      "[security] REFRESH_TOKEN_SECRET matches JWT_SECRET. Separate secrets are recommended.",
    );
  }

  if (isProd && !normalizeString(process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL)) {
    throw new Error(
      "CORS_ORIGINS or FRONTEND_URL must be configured in production",
    );
  }

  if (isProd && process.env.USE_REDIS_RATE_LIMIT !== "true") {
    console.warn(
      "[security] Redis-backed rate limiting is disabled in production.",
    );
  }
};
