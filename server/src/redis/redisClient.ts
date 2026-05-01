import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import { resolveRedisRuntimeConfig } from "../config/redisConfig.js";

const REDIS_LOG_PREFIX = "[redis]";

export type SharedRedisClient = {
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    options?: { ex?: number; px?: number },
  ) => Promise<unknown>;
  del: (...keys: string[]) => Promise<number>;
  scan: (
    cursor: string,
    options?: { match?: string; count?: number },
  ) => Promise<[string, string[]]>;
  incr: (key: string) => Promise<number>;
  expire: (key: string, ttlSeconds: number) => Promise<number>;
  pexpire: (key: string, ttlMs: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
  sAdd: (key: string, ...members: string[]) => Promise<number>;
  sMembers: (key: string) => Promise<string[]>;
};

const normalizeBooleanEnv = (value?: string | null) =>
  value?.trim().toLowerCase() === "true";

export const isRedisCacheEnabled = () =>
  normalizeBooleanEnv(process.env.USE_REDIS_CACHE);

export const isQueueEnabled = () => normalizeBooleanEnv(process.env.USE_QUEUE);

export const isRedisRateLimitEnabled = () =>
  normalizeBooleanEnv(process.env.USE_REDIS_RATE_LIMIT);

const isAnyRedisFeatureEnabled = () =>
  isRedisCacheEnabled() || isQueueEnabled() || isRedisRateLimitEnabled();

const attachRedisLogging = (client: IORedis, label: string) => {
  let readyLogged = false;

  client.on("ready", () => {
    if (readyLogged) return;
    readyLogged = true;
    const config = resolveRedisRuntimeConfig();
    console.info(`${REDIS_LOG_PREFIX} ${label} ready`, {
      transport: "tcp",
      host: config.tcp?.host ?? null,
      port: config.tcp?.port ?? null,
      db: config.tcp?.db ?? null,
      tls: config.tcp?.useTls ?? false,
    });
  });

  client.on("error", (error: Error) => {
    console.warn(`${REDIS_LOG_PREFIX} ${label} error`, {
      message: error.message,
    });
  });

  client.on("close", () => {
    console.warn(`${REDIS_LOG_PREFIX} ${label} closed`);
  });
};

const createSharedUpstashClient = (): SharedRedisClient => {
  const config = resolveRedisRuntimeConfig();
  if (!config.rest) {
    throw new Error("Upstash REST configuration is not available.");
  }

  const client = new UpstashRedis({
    url: config.rest.url,
    token: config.rest.token,
  });

  console.info(`${REDIS_LOG_PREFIX} shared ready`, {
    transport: "upstash-rest",
    host: config.rest.host,
  });

  const restClient = client as unknown as {
    expire: (key: string, ttlSeconds: number) => Promise<number>;
    sadd: (key: string, members: string[]) => Promise<number>;
    smembers: (key: string) => Promise<string[]>;
  };

  return {
    get: async (key) => {
      const result = await client.get<string>(key);
      return typeof result === "string"
        ? result
        : result === null
          ? null
          : JSON.stringify(result);
    },
    set: async (key, value, options) => {
      if (options?.px) {
        return client.set(key, value, { px: options.px });
      }

      if (options?.ex) {
        return client.set(key, value, { ex: options.ex });
      }

      return client.set(key, value);
    },
    del: async (...keys) => {
      if (keys.length === 0) {
        return 0;
      }

      return client.del(...keys);
    },
    scan: async (cursor, options) => {
      const [nextCursor, keys] = await client.scan(cursor, {
        match: options?.match,
        count: options?.count,
      });
      return [String(nextCursor), keys];
    },
    incr: async (key) => {
      return client.incr(key);
    },
    expire: async (key, ttlSeconds) => {
      return restClient.expire(key, ttlSeconds);
    },
    pexpire: async (key, ttlMs) => {
      return client.pexpire(key, ttlMs);
    },
    pttl: async (key) => {
      return client.pttl(key);
    },
    sAdd: async (key, ...members) => {
      if (!members.length) {
        return 0;
      }

      return restClient.sadd(key, members);
    },
    sMembers: async (key) => {
      return restClient.smembers(key);
    },
  };
};

const createTcpRedisOptions = (options?: {
  maxRetriesPerRequest?: number | null;
}) => {
  const config = resolveRedisRuntimeConfig();
  if (!config.tcp) {
    throw new Error("TCP Redis configuration is not available.");
  }

  return {
    host: config.tcp.host,
    port: config.tcp.port,
    username: config.tcp.username,
    password: config.tcp.password,
    db: config.tcp.db,
    connectTimeout: 5_000,
    lazyConnect: true,
    maxRetriesPerRequest:
      options?.maxRetriesPerRequest === undefined
        ? 1
        : options.maxRetriesPerRequest,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 2_000),
    ...(config.tcp.useTls
      ? {
          tls: {
            servername: config.tcp.host,
          },
        }
      : {}),
  };
};

const connectClientIfNeeded = async (client: IORedis) => {
  if (client.status === "wait") {
    await client.connect();
  }

  return client;
};

let sharedRedisClient: SharedRedisClient | null = null;
let sharedTcpRedisClient: IORedis | null = null;
let bullmqRedisClient: IORedis | null = null;
let sharedRedisClientLogged = false;

type ClosableTcpRedisClient = IORedis & {
  quit: () => Promise<unknown>;
  disconnect: () => void;
};

export const getRedisClient = async (): Promise<SharedRedisClient | null> => {
  if (!isAnyRedisFeatureEnabled()) {
    return null;
  }

  const config = resolveRedisRuntimeConfig();
  if (config.sharedTransport === "disabled") {
    return null;
  }

  if (!sharedRedisClient) {
    if (config.sharedTransport === "upstash-rest") {
      sharedRedisClient = createSharedUpstashClient();
      sharedRedisClientLogged = true;
    } else {
      sharedTcpRedisClient = new IORedis(createTcpRedisOptions());
      attachRedisLogging(sharedTcpRedisClient, "shared");
      const tcpRedisClient = sharedTcpRedisClient as IORedis & {
        expire: (key: string, ttlSeconds: number) => Promise<number>;
        sadd: (key: string, ...members: string[]) => Promise<number>;
        smembers: (key: string) => Promise<string[]>;
      };
      sharedRedisClient = {
        get: (key) => sharedTcpRedisClient!.get(key),
        set: (key, value, options) => {
          if (options?.px) {
            return sharedTcpRedisClient!.set(key, value, "PX", options.px);
          }

          if (options?.ex) {
            return sharedTcpRedisClient!.set(key, value, "EX", options.ex);
          }

          return sharedTcpRedisClient!.set(key, value);
        },
        del: (...keys) => {
          if (keys.length === 0) {
            return Promise.resolve(0);
          }

          return sharedTcpRedisClient!.del(...keys);
        },
        scan: async (cursor, options) => {
          const [nextCursor, keys] = await sharedTcpRedisClient!.scan(
            cursor,
            "MATCH",
            options?.match ?? "*",
            "COUNT",
            options?.count ?? 100,
          );
          return [nextCursor, keys];
        },
        incr: (key) => sharedTcpRedisClient!.incr(key),
        expire: (key, ttlSeconds) =>
          tcpRedisClient.expire(key, ttlSeconds),
        pexpire: (key, ttlMs) =>
          sharedTcpRedisClient!.pexpire(key, ttlMs) as Promise<number>,
        pttl: (key) => sharedTcpRedisClient!.pttl(key) as Promise<number>,
        sAdd: (key, ...members) => {
          if (!members.length) {
            return Promise.resolve(0);
          }

          return tcpRedisClient.sadd(key, ...members);
        },
        sMembers: (key) => tcpRedisClient.smembers(key),
      };
    }
  }

  if (config.sharedTransport === "tcp" && sharedRedisClient && !sharedRedisClientLogged) {
    sharedRedisClientLogged = true;
  }

  if (config.sharedTransport === "tcp") {
    try {
      if (!sharedTcpRedisClient) {
        return null;
      }

      await connectClientIfNeeded(sharedTcpRedisClient);
      return sharedRedisClient;
    } catch (error) {
      console.warn(`${REDIS_LOG_PREFIX} shared connect failed`, {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  return sharedRedisClient;
};

export const getBullmqRedisConnection = async () => {
  if (!isQueueEnabled()) {
    return null;
  }

  const config = resolveRedisRuntimeConfig();
  if (!config.tcp) {
    return null;
  }

  if (!bullmqRedisClient) {
    bullmqRedisClient = new IORedis(
      createTcpRedisOptions({ maxRetriesPerRequest: null }),
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

export const disconnectRedisClients = async () => {
  const shutdownTasks: Array<Promise<unknown>> = [];
  const queueClose = (client: IORedis | null) => {
    if (!client) {
      return;
    }

    const closableClient = client as unknown as ClosableTcpRedisClient;
    shutdownTasks.push(
      closableClient.quit().catch(() => {
        closableClient.disconnect();
      }),
    );
  };

  queueClose(sharedTcpRedisClient);

  if (bullmqRedisClient && bullmqRedisClient !== sharedTcpRedisClient) {
    queueClose(bullmqRedisClient);
  }

  await Promise.allSettled(shutdownTasks);

  sharedRedisClient = null;
  sharedTcpRedisClient = null;
  bullmqRedisClient = null;
  sharedRedisClientLogged = false;
};
