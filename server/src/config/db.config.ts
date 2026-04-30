import { Prisma, PrismaClient } from "@prisma/client";
import { initializeDatabaseConnections } from "./databaseUrl.js";
import { recordRequestDbQuery } from "../lib/requestPerformance.js";

type PrismaClientConstructorOptions = ConstructorParameters<
  typeof PrismaClient
>[0];

type PrismaClientRuntimeOverrideOptions = PrismaClientConstructorOptions & {
  __internal?: {
    configOverride?: (
      config: Record<string, unknown>,
    ) => Record<string, unknown>;
  };
};

const resolvePositiveNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const isTestRun =
  process.env.NODE_ENV === "test" ||
  process.argv.includes("--test") ||
  process.env.npm_lifecycle_event?.startsWith("test:") === true;

initializeDatabaseConnections();

const shouldForceLocalQueryEngine = () => {
  const databaseUrl = process.env.DATABASE_URL?.trim().toLowerCase() ?? "";

  return (
    databaseUrl.startsWith("postgresql://") ||
    databaseUrl.startsWith("postgres://")
  );
};

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const fullQueryLoggingEnabled = process.env.PRISMA_LOG_QUERIES === "true";
const slowQueryThresholdMs = resolvePositiveNumber(
  process.env.PRISMA_SLOW_QUERY_MS,
) ?? 250;
const shouldAttachQueryLogging =
  fullQueryLoggingEnabled || slowQueryThresholdMs > 0;

const prismaClientOptions: PrismaClientRuntimeOverrideOptions = {
  log: shouldAttachQueryLogging
    ? [
        "error",
        {
          emit: "event",
          level: "query",
        },
      ]
    : ["error"],
  transactionOptions: {
    maxWait: 30000,
    timeout: 30000,
  },
};

if (shouldForceLocalQueryEngine()) {
  // Some Prisma client artifacts can be generated with copyEngine=false,
  // which incorrectly routes plain Postgres URLs through the Accelerate path.
  prismaClientOptions.__internal = {
    configOverride: (config) => ({
      ...config,
      copyEngine: true,
    }),
  };
}

const createTestPrismaStub = () => {
  const delegates = new Map<string | symbol, Record<string, unknown>>();

  return new Proxy(
    {},
    {
      get(_target, prop) {
        // Prevent accidental real DB operations.
        if (
          typeof prop === "string" &&
          (prop.startsWith("$") || prop === "then")
        ) {
          throw new Error(
            "Prisma client is unavailable in test bootstrap mode. Run prisma generate and set DATABASE_URL when a test needs DB access.",
          );
        }

        // Return a stable, per-delegate proxy so tests can monkey-patch
        // individual methods (e.g. prisma.customer.findFirst = ...).
        if (!delegates.has(prop)) {
          const delegateObj: Record<string, unknown> = {};
          delegates.set(
            prop,
            new Proxy(delegateObj, {
              get(dt, method) {
                if (method in dt) return dt[method as string];
                // Default: throw so un-mocked calls are caught early.
                return () => {
                  throw new Error(
                    `Prisma delegate "${String(prop)}.${String(method)}" is not mocked. Provide a mock in your test.`,
                  );
                };
              },
              set(dt, method, value) {
                dt[method as string] = value;
                return true;
              },
            }),
          );
        }

        return delegates.get(prop);
      },
      set(_target, prop, value) {
        delegates.set(prop, value);
        return true;
      },
    },
  ) as PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  (isTestRun
    ? createTestPrismaStub()
    : new PrismaClient(
        prismaClientOptions as PrismaClientConstructorOptions,
      ));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

if (!isTestRun && shouldAttachQueryLogging) {
  (
    prisma as PrismaClient & {
      $on: (
        eventType: "query",
        callback: (event: {
          duration: number;
          target: string;
          query: string;
          params: string;
        }) => void,
      ) => void;
    }
  ).$on("query", (event) => {
    if (!fullQueryLoggingEnabled && event.duration < slowQueryThresholdMs) {
      recordRequestDbQuery(
        event.query.replace(/\s+/g, " ").trim(),
        event.duration,
      );
      return;
    }

    const normalizedQuery = event.query.replace(/\s+/g, " ").trim();
    recordRequestDbQuery(normalizedQuery, event.duration);
    const trimmedQuery =
      normalizedQuery.length > 600
        ? `${normalizedQuery.slice(0, 597)}...`
        : normalizedQuery;

    console.info("[db.query]", {
      durationMs: event.duration,
      target: event.target,
      query: trimmedQuery,
      params: fullQueryLoggingEnabled ? event.params : undefined,
    });
  });
}

export type DatabaseConnectivityProbe = {
  durationMs: number;
  database: string | null;
  currentUser: string | null;
  serverVersion: string | null;
};

export const verifyDatabaseConnectivity = async (): Promise<DatabaseConnectivityProbe | null> => {
  if (isTestRun) {
    return null;
  }

  const startedAt = Date.now();
  await prisma.$connect();

  const rows = await prisma.$queryRaw<
    Array<{
      current_database: string | null;
      current_user: string | null;
      version: string | null;
    }>
  >(Prisma.sql`
    SELECT
      current_database()::text AS current_database,
      current_user::text AS current_user,
      version()::text AS version
  `);

  const row = rows[0] ?? null;

  return {
    durationMs: Date.now() - startedAt,
    database: row?.current_database ?? null,
    currentUser: row?.current_user ?? null,
    serverVersion: row?.version ?? null,
  };
};

export const disconnectDatabase = async () => {
  if (isTestRun) {
    return;
  }

  await prisma.$disconnect();
};

export default prisma;
