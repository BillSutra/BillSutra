import crypto from "crypto";

const SECRET_MIN_LENGTH = 32;

type RuntimeEnv = NodeJS.ProcessEnv;
type SecretSource =
  | "JWT_SECRET"
  | "ACCESS_TOKEN_SECRET"
  | "REFRESH_TOKEN_SECRET"
  | "generated";

export type ResolvedAuthSecrets = {
  isProduction: boolean;
  jwtSecret: string;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  jwtSecretSource: SecretSource;
  accessTokenSecretSource: SecretSource;
  refreshTokenSecretSource: SecretSource;
  generatedFallbacks: string[];
};

const normalizeSecret = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const isStrongSecret = (value?: string | null) => {
  const normalized = normalizeSecret(value);
  return Boolean(normalized && normalized.length >= SECRET_MIN_LENGTH);
};

const generateSecret = () => crypto.randomBytes(48).toString("base64url");

const assertStrongSecret = (name: string, value?: string | null) => {
  const normalized = normalizeSecret(value);

  if (!normalized) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  if (normalized.length < SECRET_MIN_LENGTH) {
    throw new Error(`${name} must be at least ${SECRET_MIN_LENGTH} characters long`);
  }

  return normalized;
};

export const resolveAuthSecrets = (
  env: RuntimeEnv = process.env,
): ResolvedAuthSecrets => {
  const isProduction = env.NODE_ENV === "production";
  const generatedFallbacks: string[] = [];

  let jwtSecret = normalizeSecret(env.JWT_SECRET);
  let accessTokenSecret = normalizeSecret(env.ACCESS_TOKEN_SECRET);
  let refreshTokenSecret = normalizeSecret(env.REFRESH_TOKEN_SECRET);

  let jwtSecretSource: SecretSource = "JWT_SECRET";
  let accessTokenSecretSource: SecretSource = "ACCESS_TOKEN_SECRET";
  let refreshTokenSecretSource: SecretSource = "REFRESH_TOKEN_SECRET";

  if (isProduction) {
    jwtSecret = assertStrongSecret("JWT_SECRET", jwtSecret);
    if (accessTokenSecret) {
      accessTokenSecret = assertStrongSecret(
        "ACCESS_TOKEN_SECRET",
        accessTokenSecret,
      );
    }
    refreshTokenSecret = assertStrongSecret(
      "REFRESH_TOKEN_SECRET",
      refreshTokenSecret,
    );
  } else {
    if (!isStrongSecret(jwtSecret)) {
      jwtSecret = generateSecret();
      env.JWT_SECRET = jwtSecret;
      jwtSecretSource = "generated";
      generatedFallbacks.push("JWT_SECRET");
    }

    if (!isStrongSecret(accessTokenSecret)) {
      accessTokenSecret = jwtSecret;
      if (accessTokenSecret) {
        env.ACCESS_TOKEN_SECRET = accessTokenSecret;
      }
      accessTokenSecretSource =
        jwtSecretSource === "generated" ? "generated" : "JWT_SECRET";
      generatedFallbacks.push("ACCESS_TOKEN_SECRET");
    }

    if (!isStrongSecret(refreshTokenSecret)) {
      refreshTokenSecret = jwtSecret;
      if (refreshTokenSecret) {
        env.REFRESH_TOKEN_SECRET = refreshTokenSecret;
      }
      refreshTokenSecretSource =
        jwtSecretSource === "generated" ? "generated" : "JWT_SECRET";
      generatedFallbacks.push("REFRESH_TOKEN_SECRET");
    }
  }

  if (!jwtSecret) {
    throw new Error("JWT_SECRET could not be resolved");
  }

  if (!accessTokenSecret) {
    accessTokenSecret = jwtSecret;
    accessTokenSecretSource = "JWT_SECRET";
  }

  if (!refreshTokenSecret) {
    refreshTokenSecret = jwtSecret;
    refreshTokenSecretSource = "JWT_SECRET";
  }

  env.JWT_SECRET = jwtSecret;
  env.ACCESS_TOKEN_SECRET = accessTokenSecret;
  env.REFRESH_TOKEN_SECRET = refreshTokenSecret;

  return {
    isProduction,
    jwtSecret,
    accessTokenSecret,
    refreshTokenSecret,
    jwtSecretSource,
    accessTokenSecretSource,
    refreshTokenSecretSource,
    generatedFallbacks: [...new Set(generatedFallbacks)],
  };
};

export const getJwtSecret = (env: RuntimeEnv = process.env) =>
  resolveAuthSecrets(env).jwtSecret;

export const getAccessTokenSecret = (env: RuntimeEnv = process.env) =>
  resolveAuthSecrets(env).accessTokenSecret;

export const getRefreshTokenSecret = (env: RuntimeEnv = process.env) =>
  resolveAuthSecrets(env).refreshTokenSecret;

export const logAuthSecretDiagnostics = (resolved: ResolvedAuthSecrets) => {
  console.info("[startup.auth] auth secret configuration validated", {
    isProduction: resolved.isProduction,
    jwtSecretSource: resolved.jwtSecretSource,
    accessTokenSecretSource: resolved.accessTokenSecretSource,
    refreshTokenSecretSource: resolved.refreshTokenSecretSource,
    jwtSecretLength: resolved.jwtSecret.length,
    accessTokenSecretLength: resolved.accessTokenSecret.length,
    refreshTokenSecretLength: resolved.refreshTokenSecret.length,
    generatedFallbacks: resolved.generatedFallbacks,
  });

  if (resolved.generatedFallbacks.length > 0) {
    console.warn(
      "[startup.auth] Generated development-only auth secret fallbacks for missing or weak values. Update server/.env with permanent 32+ character secrets before sharing the environment or deploying.",
      {
        generatedFallbacks: resolved.generatedFallbacks,
      },
    );
  }

  if (resolved.refreshTokenSecret === resolved.jwtSecret) {
    console.warn(
      "[security] REFRESH_TOKEN_SECRET resolves to the same value as JWT_SECRET. Separate secrets are recommended.",
    );
  }

  if (resolved.accessTokenSecret === resolved.jwtSecret) {
    console.info(
      "[startup.auth] ACCESS_TOKEN_SECRET is not set separately; JWT_SECRET is being used for access tokens.",
    );
  }
};
