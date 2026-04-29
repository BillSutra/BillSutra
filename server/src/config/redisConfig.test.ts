import assert from "node:assert/strict";
import test from "node:test";
import {
  RedisConfigValidationError,
  resolveRedisRuntimeConfig,
} from "./redisConfig.js";

test("prefers Upstash REST for shared Redis features", () => {
  const resolved = resolveRedisRuntimeConfig({
    NODE_ENV: "production",
    USE_REDIS_CACHE: "true",
    USE_REDIS_RATE_LIMIT: "true",
    UPSTASH_REDIS_REST_URL: "https://demo-redis.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "token-value",
  });

  assert.equal(resolved.sharedTransport, "upstash-rest");
  assert.equal(resolved.queueTransport, "disabled");
  assert.equal(resolved.diagnostics.restConfigured, true);
  assert.equal(resolved.diagnostics.tcpConfigured, false);
});

test("allows BullMQ when a TLS Redis URL is provided", () => {
  const resolved = resolveRedisRuntimeConfig({
    NODE_ENV: "production",
    USE_QUEUE: "true",
    REDIS_URL: "rediss://default:secret@demo-redis.upstash.io:6379",
  });

  assert.equal(resolved.sharedTransport, "tcp");
  assert.equal(resolved.queueTransport, "tcp");
  assert.equal(resolved.diagnostics.tcpTls, true);
});

test("rejects queue mode when only Upstash REST credentials are provided", () => {
  assert.throws(
    () =>
      resolveRedisRuntimeConfig({
        NODE_ENV: "production",
        USE_QUEUE: "true",
        UPSTASH_REDIS_REST_URL: "https://demo-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token-value",
      }),
    (error: unknown) => {
      assert.ok(error instanceof RedisConfigValidationError);
      assert.equal(error.details.issue, "queue_transport_missing");
      assert.match(error.message, /BullMQ cannot run on Upstash REST alone/i);
      return true;
    },
  );
});

test("rejects https REDIS_URL values and points callers to the REST env vars", () => {
  assert.throws(
    () =>
      resolveRedisRuntimeConfig({
        NODE_ENV: "production",
        USE_REDIS_CACHE: "true",
        REDIS_URL: "https://demo-redis.upstash.io",
      }),
    (error: unknown) => {
      assert.ok(error instanceof RedisConfigValidationError);
      assert.equal(error.details.issue, "redis_url_protocol");
      assert.match(error.message, /UPSTASH_REDIS_REST_URL/);
      return true;
    },
  );
});
