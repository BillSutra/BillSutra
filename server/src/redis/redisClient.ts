import IORedis from "ioredis";

const REDIS_LOG_PREFIX = "[redis]";

const normalizeBooleanEnv = (value?: string | null) =>
  value?.trim().toLowerCase() === "true";

const normalizeStringEnv = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export const isRedisCacheEnabled = () =>
  normalizeBooleanEnv(process.env.USE_REDIS_CACHE);

export const isQueueEnabled = () => normalizeBooleanEnv(process.env.USE_QUEUE);

export const isRedisRateLimitEnabled = () =>
  normalizeBooleanEnv(process.env.USE_REDIS_RATE_LIMIT);

const isAnyRedisFeatureEnabled = () =>
  isRedisCacheEnabled() || isQueueEnabled() || isRedisRateLimitEnabled();

const resolveRedisEndpoint = () => {
  const redisUrl = normalizeStringEnv(process.env.REDIS_URL);
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    const pathname = parsed.pathname?.replace(/^\//, "");

    return {
      source: "url" as const,
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db:
        pathname && !Number.isNaN(Number(pathname))
          ? Number(pathname)
          : Number(process.env.REDIS_DB ?? 0),
      useTls:
        parsed.protocol === "rediss:" ||
        normalizeBooleanEnv(process.env.REDIS_TLS),
    };
  }

  return {
    source: "host_port" as const,
    host: process.env.REDIS_HOST?.trim() || "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? 6379),
    username: normalizeStringEnv(process.env.REDIS_USERNAME),
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
    useTls: normalizeBooleanEnv(process.env.REDIS_TLS),
  };
};

const resolveRedisConnectionOptions = (options?: {
  maxRetriesPerRequest?: number | null;
}) => {
  const endpoint = resolveRedisEndpoint();

  return {
    host: endpoint.host,
    port: endpoint.port,
    username: endpoint.username,
    password: endpoint.password,
    db: endpoint.db,
    connectTimeout: 5_000,
    lazyConnect: true,
    maxRetriesPerRequest:
      options?.maxRetriesPerRequest === undefined
        ? 1
        : options.maxRetriesPerRequest,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 2_000),
    ...(endpoint.useTls
      ? {
          tls: {
            servername: endpoint.host,
          },
        }
      : {}),
  };
};

const attachRedisLogging = (client: IORedis, label: string) => {
  let readyLogged = false;

  client.on("ready", () => {
    if (readyLogged) return;
    readyLogged = true;
    const endpoint = resolveRedisEndpoint();
    console.info(`${REDIS_LOG_PREFIX} ${label} ready`, {
      source: endpoint.source,
      host: endpoint.host,
      port: endpoint.port,
      db: endpoint.db,
      tls: endpoint.useTls,
    });
  });

  client.on("error", (error) => {
    console.warn(`${REDIS_LOG_PREFIX} ${label} error`, {
      message: error.message,
    });
  });

  client.on("close", () => {
    console.warn(`${REDIS_LOG_PREFIX} ${label} closed`);
  });
};

let redisClient: IORedis | null = null;
let bullmqRedisClient: IORedis | null = null;

const connectClientIfNeeded = async (client: IORedis) => {
  if (client.status === "wait") {
    await client.connect();
  }

  return client;
};

export const getRedisClient = async () => {
  if (!isAnyRedisFeatureEnabled()) {
    return null;
  }

  if (!redisClient) {
    redisClient = new IORedis(resolveRedisConnectionOptions());
    attachRedisLogging(redisClient, "cache");
  }

  try {
    return await connectClientIfNeeded(redisClient);
  } catch (error) {
    console.warn(`${REDIS_LOG_PREFIX} cache connect failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

export const getBullmqRedisConnection = async () => {
  if (!isQueueEnabled()) {
    return null;
  }

  if (!bullmqRedisClient) {
    bullmqRedisClient = new IORedis(
      resolveRedisConnectionOptions({ maxRetriesPerRequest: null }),
    );
    attachRedisLogging(bullmqRedisClient, "bullmq");
  }

  try {
    return await connectClientIfNeeded(bullmqRedisClient);
  } catch (error) {
    console.warn(`${REDIS_LOG_PREFIX} bullmq connect failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
