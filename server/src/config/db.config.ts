import { PrismaClient } from "@prisma/client";

const normalizeDatabaseUrl = () => {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const normalizedUrl = rawUrl.replace(/^"(.*)"$/, "$1");
  const url = new URL(normalizedUrl);
  const configuredConnectionLimit =
    process.env.PRISMA_CONNECTION_LIMIT?.trim() || "10";
  const configuredPoolTimeout =
    process.env.PRISMA_POOL_TIMEOUT?.trim() || "30";

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", configuredConnectionLimit);
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", configuredPoolTimeout);
  }

  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
  }

  return url.toString();
};

process.env.DATABASE_URL = normalizeDatabaseUrl();

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
    transactionOptions: {
      maxWait: 30000,
      timeout: 30000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
