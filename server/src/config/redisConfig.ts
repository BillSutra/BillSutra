type RedisRuntimeEnv = {
  NODE_ENV?: string;
  USE_REDIS_CACHE?: string;
  USE_REDIS_RATE_LIMIT?: string;
  USE_QUEUE?: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_USERNAME?: string;
  REDIS_PASSWORD?: string;
  REDIS_TOKEN?: string;
  REDIS_DB?: string;
  REDIS_TLS?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
};

type RedisFeatureFlags = {
  cache: boolean;
  rateLimit: boolean;
  queue: boolean;
};

type RedisRuntimeDefaults = {
  usesRest: boolean;
  usesTcp: boolean;
};

export type ResolvedUpstashRestConfig = {
  url: string;
  token: string;
  host: string;
};

export type ResolvedRedisTcpConfig = {
  source: "url" | "host_port";
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  useTls: boolean;
  fromUpstashUrl: boolean;
};

export type RedisRuntimeDiagnostics = {
  cacheEnabled: boolean;
  rateLimitEnabled: boolean;
  queueEnabled: boolean;
  sharedTransport: "upstash-rest" | "tcp" | "disabled";
  queueTransport: "tcp" | "disabled";
  restConfigured: boolean;
  tcpConfigured: boolean;
  restHost: string | null;
  tcpHost: string | null;
  tcpPort: number | null;
  tcpTls: boolean;
  queueCompatible: boolean;
  runtimeDefaults: RedisRuntimeDefaults;
};

export type ResolvedRedisRuntimeConfig = {
  features: RedisFeatureFlags;
  rest: ResolvedUpstashRestConfig | null;
  tcp: ResolvedRedisTcpConfig | null;
  sharedTransport: "upstash-rest" | "tcp" | "disabled";
  queueTransport: "tcp" | "disabled";
  diagnostics: RedisRuntimeDiagnostics;
};

type RedisConfigValidationIssue =
  | "upstash_rest_partial"
  | "upstash_rest_url"
  | "redis_url_protocol"
  | "redis_url_format"
  | "redis_host"
  | "redis_port"
  | "cache_transport_missing"
  | "queue_transport_missing"
  | "queue_transport_tls";

type RedisConfigValidationDetails = {
  issue: RedisConfigValidationIssue;
  feature?: "cache" | "rate_limit" | "queue";
  expectedEnv?: string[];
};

export class RedisConfigValidationError extends Error {
  readonly details: RedisConfigValidationDetails;

  constructor(message: string, details: RedisConfigValidationDetails) {
    super(message);
    this.name = "RedisConfigValidationError";
    this.details = details;
  }
}

const REDIS_LOG_PREFIX = "[startup.redis]";

const normalizeBooleanEnv = (value?: string | null) =>
  value?.trim().toLowerCase() === "true";

const normalizeStringEnv = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

const resolveFeatureFlags = (env: RedisRuntimeEnv): RedisFeatureFlags => ({
  cache: normalizeBooleanEnv(env.USE_REDIS_CACHE),
  rateLimit: normalizeBooleanEnv(env.USE_REDIS_RATE_LIMIT),
  queue: normalizeBooleanEnv(env.USE_QUEUE),
});

const resolveUpstashRestConfig = (
  env: RedisRuntimeEnv,
): ResolvedUpstashRestConfig | null => {
  const url = normalizeStringEnv(env.UPSTASH_REDIS_REST_URL);
  const token = normalizeStringEnv(env.UPSTASH_REDIS_REST_TOKEN);

  if (!url && !token) {
    return null;
  }

  if (!url || !token) {
    throw new RedisConfigValidationError(
      "Upstash REST Redis configuration is incomplete. Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      {
        issue: "upstash_rest_partial",
        expectedEnv: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new RedisConfigValidationError(
      "UPSTASH_REDIS_REST_URL is invalid. Expected an https:// Upstash REST endpoint.",
      {
        issue: "upstash_rest_url",
        expectedEnv: ["UPSTASH_REDIS_REST_URL"],
      },
    );
  }

  if (parsed.protocol !== "https:") {
    throw new RedisConfigValidationError(
      "UPSTASH_REDIS_REST_URL must use https://.",
      {
        issue: "upstash_rest_url",
        expectedEnv: ["UPSTASH_REDIS_REST_URL"],
      },
    );
  }

  return {
    url,
    token,
    host: parsed.hostname || null,
  } as ResolvedUpstashRestConfig;
};

const parseRedisDb = (value: string | undefined) => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const resolveRedisTcpConfig = (
  env: RedisRuntimeEnv,
): ResolvedRedisTcpConfig | null => {
  const redisUrl = normalizeStringEnv(env.REDIS_URL);

  if (redisUrl) {
    if (/^https?:\/\//i.test(redisUrl)) {
      throw new RedisConfigValidationError(
        "REDIS_URL must use redis:// or rediss://. For Upstash REST endpoints, use UPSTASH_REDIS_REST_URL instead.",
        {
          issue: "redis_url_protocol",
          expectedEnv: ["REDIS_URL", "UPSTASH_REDIS_REST_URL"],
        },
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(redisUrl);
    } catch {
      throw new RedisConfigValidationError("REDIS_URL is invalid.", {
        issue: "redis_url_format",
        expectedEnv: ["REDIS_URL"],
      });
    }

    if (!["redis:", "rediss:"].includes(parsed.protocol)) {
      throw new RedisConfigValidationError(
        "REDIS_URL must use redis:// or rediss://.",
        {
          issue: "redis_url_protocol",
          expectedEnv: ["REDIS_URL"],
        },
      );
    }

    const pathname = parsed.pathname?.replace(/^\//, "");

    return {
      source: "url",
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username
        ? decodeURIComponent(parsed.username)
        : undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      db:
        pathname && !Number.isNaN(Number(pathname))
          ? Number(pathname)
          : parseRedisDb(env.REDIS_DB),
      useTls:
        parsed.protocol === "rediss:" ||
        normalizeBooleanEnv(env.REDIS_TLS),
      fromUpstashUrl: /\.upstash\.io$/i.test(parsed.hostname),
    };
  }

  const host = normalizeStringEnv(env.REDIS_HOST);
  const port = normalizeStringEnv(env.REDIS_PORT);
  const username = normalizeStringEnv(env.REDIS_USERNAME);
  const password =
    normalizeStringEnv(env.REDIS_PASSWORD) ?? normalizeStringEnv(env.REDIS_TOKEN);
  const db = normalizeStringEnv(env.REDIS_DB);
  const tls = normalizeStringEnv(env.REDIS_TLS);

  if (!host && !port && !username && !password && !db && !tls) {
    return null;
  }

  if (!host) {
    throw new RedisConfigValidationError(
      "REDIS_HOST is required when REDIS_URL is not provided.",
      {
        issue: "redis_host",
        expectedEnv: ["REDIS_HOST"],
      },
    );
  }

  const parsedPort = Number.parseInt(port ?? "6379", 10);
  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new RedisConfigValidationError("REDIS_PORT must be a positive integer.", {
      issue: "redis_port",
      expectedEnv: ["REDIS_PORT"],
    });
  }

  return {
    source: "host_port",
    host,
    port: parsedPort,
    username,
    password,
    db: parseRedisDb(db),
    useTls: normalizeBooleanEnv(env.REDIS_TLS),
    fromUpstashUrl: /\.upstash\.io$/i.test(host),
  };
};

export const resolveRedisRuntimeConfig = (
  env: RedisRuntimeEnv = process.env as RedisRuntimeEnv,
): ResolvedRedisRuntimeConfig => {
  const features = resolveFeatureFlags(env);
  const rest = resolveUpstashRestConfig(env);
  const tcp = resolveRedisTcpConfig(env);

  const sharedTransport = rest ? "upstash-rest" : tcp ? "tcp" : "disabled";
  const queueTransport = features.queue && tcp ? "tcp" : "disabled";

  if ((features.cache || features.rateLimit) && sharedTransport === "disabled") {
    throw new RedisConfigValidationError(
      "Redis-backed cache/rate-limit features are enabled but no Redis configuration is available. Configure Upstash REST (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN) or TCP Redis (REDIS_URL).",
      {
        issue: "cache_transport_missing",
        feature: features.cache ? "cache" : "rate_limit",
        expectedEnv: [
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
          "REDIS_URL",
        ],
      },
    );
  }

  if (features.queue && !tcp) {
    throw new RedisConfigValidationError(
      "USE_QUEUE=true requires a TCP Redis connection. BullMQ cannot run on Upstash REST alone. Configure REDIS_URL with a rediss:// endpoint or disable USE_QUEUE.",
      {
        issue: "queue_transport_missing",
        feature: "queue",
        expectedEnv: ["REDIS_URL"],
      },
    );
  }

  if (
    features.queue &&
    tcp &&
    env.NODE_ENV === "production" &&
    !tcp.useTls
  ) {
    throw new RedisConfigValidationError(
      "USE_QUEUE=true in production requires TLS-enabled Redis. Use a rediss:// REDIS_URL for Upstash or enable REDIS_TLS=true.",
      {
        issue: "queue_transport_tls",
        feature: "queue",
        expectedEnv: ["REDIS_URL", "REDIS_TLS"],
      },
    );
  }

  return {
    features,
    rest,
    tcp,
    sharedTransport,
    queueTransport,
    diagnostics: {
      cacheEnabled: features.cache,
      rateLimitEnabled: features.rateLimit,
      queueEnabled: features.queue,
      sharedTransport,
      queueTransport,
      restConfigured: Boolean(rest),
      tcpConfigured: Boolean(tcp),
      restHost: rest?.host ?? null,
      tcpHost: tcp?.host ?? null,
      tcpPort: tcp?.port ?? null,
      tcpTls: tcp?.useTls ?? false,
      queueCompatible: Boolean(tcp),
      runtimeDefaults: {
        usesRest: Boolean(rest),
        usesTcp: Boolean(tcp),
      },
    },
  };
};

export const initializeRedisConfig = (
  env: RedisRuntimeEnv = process.env as RedisRuntimeEnv,
) => resolveRedisRuntimeConfig(env);

export const logRedisStartupDiagnostics = (
  resolved: ResolvedRedisRuntimeConfig,
) => {
  console.info(`${REDIS_LOG_PREFIX} configuration validated`, resolved.diagnostics);

  if (
    resolved.features.queue &&
    (resolved.tcp?.fromUpstashUrl || resolved.rest?.host?.includes(".upstash.io"))
  ) {
    console.warn(
      `${REDIS_LOG_PREFIX} BullMQ on Upstash is supported, but BullMQ polls Redis continuously. Upstash recommends a Fixed plan to avoid high per-request costs.`,
      {
        queueTransport: resolved.queueTransport,
        restConfigured: Boolean(resolved.rest),
        tcpHost: resolved.tcp?.host ?? null,
      },
    );
  }
};

export const logRedisStartupFailure = (error: unknown) => {
  if (error instanceof RedisConfigValidationError) {
    console.error(`${REDIS_LOG_PREFIX} invalid Redis configuration`, {
      issue: error.details.issue,
      feature: error.details.feature ?? null,
      expectedEnv: error.details.expectedEnv ?? [],
    });
    return;
  }

  console.error(`${REDIS_LOG_PREFIX} Redis configuration failed`, {
    error: error instanceof Error ? error.message : String(error),
  });
};
