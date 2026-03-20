import { PrismaClient } from "@prisma/client";

const resolvePositiveNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const normalizeDatabaseUrl = () => {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const normalizedUrl = rawUrl.replace(/^"(.*)"$/, "$1");
  const url = new URL(normalizedUrl);
  const configuredConnectionLimit = resolvePositiveNumber(
    process.env.PRISMA_CONNECTION_LIMIT,
  );
  const configuredPoolTimeout = resolvePositiveNumber(
    process.env.PRISMA_POOL_TIMEOUT,
  );
  const existingConnectionLimit = resolvePositiveNumber(
    url.searchParams.get("connection_limit"),
  );
  const existingPoolTimeout = resolvePositiveNumber(
    url.searchParams.get("pool_timeout"),
  );
  const normalizedConnectionLimit = String(
    configuredConnectionLimit ?? Math.max(existingConnectionLimit ?? 0, 10),
  );
  const normalizedPoolTimeout = String(
    configuredPoolTimeout ?? Math.max(existingPoolTimeout ?? 0, 30),
  );

  url.searchParams.set("connection_limit", normalizedConnectionLimit);
  url.searchParams.set("pool_timeout", normalizedPoolTimeout);

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
