import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthSecrets } from "./authSecrets.js";
import { validateSecurityEnv } from "./securityEnv.js";

test("development mode generates strong auth secret fallbacks", () => {
  const env = {
    NODE_ENV: "development",
    JWT_SECRET: "short",
    REFRESH_TOKEN_SECRET: "",
  } as NodeJS.ProcessEnv;

  validateSecurityEnv(env);
  const resolved = resolveAuthSecrets({
    NODE_ENV: "development",
    JWT_SECRET: "short",
    REFRESH_TOKEN_SECRET: "",
  } as NodeJS.ProcessEnv);

  assert.equal(resolved.isProduction, false);
  assert.ok(resolved.jwtSecret.length >= 32);
  assert.ok(resolved.accessTokenSecret.length >= 32);
  assert.ok(resolved.refreshTokenSecret.length >= 32);
  assert.equal(env.JWT_SECRET?.length ? env.JWT_SECRET.length >= 32 : false, true);
  assert.equal(
    env.ACCESS_TOKEN_SECRET === env.JWT_SECRET,
    true,
  );
  assert.equal(
    env.REFRESH_TOKEN_SECRET === env.JWT_SECRET,
    true,
  );
  assert.deepEqual(resolved.generatedFallbacks.sort(), [
    "ACCESS_TOKEN_SECRET",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
  ]);
});

test("production mode rejects weak refresh token secrets", () => {
  assert.throws(
    () =>
      validateSecurityEnv({
        NODE_ENV: "production",
        JWT_SECRET: "a".repeat(48),
        REFRESH_TOKEN_SECRET: "too-short",
        CORS_ORIGIN: "https://app.example.com",
      } as NodeJS.ProcessEnv),
    /REFRESH_TOKEN_SECRET must be at least 32 characters long/,
  );
});

test("production mode accepts a separate strong access token secret", () => {
  const env = {
    NODE_ENV: "production",
    JWT_SECRET: "j".repeat(48),
    ACCESS_TOKEN_SECRET: "a".repeat(48),
    REFRESH_TOKEN_SECRET: "r".repeat(48),
    CORS_ORIGIN: "https://app.example.com",
  } as NodeJS.ProcessEnv;

  validateSecurityEnv(env);
  const resolved = resolveAuthSecrets(env);

  assert.equal(resolved.accessTokenSecret, "a".repeat(48));
  assert.equal(resolved.refreshTokenSecret, "r".repeat(48));
  assert.equal(resolved.jwtSecret, "j".repeat(48));
});
