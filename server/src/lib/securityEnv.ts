import { resolveAuthSecrets } from "./authSecrets.js";

const normalizeString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const assertPairedEnv = (
  leftName: string,
  leftValue: string | null,
  rightName: string,
  rightValue: string | null,
) => {
  if ((leftValue && !rightValue) || (!leftValue && rightValue)) {
    throw new Error(
      `${leftName} and ${rightName} must be configured together`,
    );
  }
};

export const validateSecurityEnv = (
  env: NodeJS.ProcessEnv = process.env,
) => {
  const isProd = env.NODE_ENV === "production";
  resolveAuthSecrets(env);

  if (
    isProd &&
    !normalizeString(
      env.CORS_ORIGINS ??
        env.CORS_ORIGIN ??
        env.FRONTEND_URL ??
        env.APP_URL,
    )
  ) {
    throw new Error(
      "CORS_ORIGINS, CORS_ORIGIN, FRONTEND_URL, or APP_URL must be configured in production",
    );
  }

  assertPairedEnv(
    "EMAIL_USER",
    normalizeString(env.EMAIL_USER),
    "EMAIL_PASS",
    normalizeString(env.EMAIL_PASS),
  );

  assertPairedEnv(
    "RAZORPAY_KEY_ID",
    normalizeString(env.RAZORPAY_KEY_ID),
    "RAZORPAY_KEY_SECRET",
    normalizeString(env.RAZORPAY_KEY_SECRET),
  );

  if (isProd && env.USE_REDIS_RATE_LIMIT !== "true") {
    console.warn(
      "[security] Redis-backed rate limiting is disabled in production.",
    );
  }
};
