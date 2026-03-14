import { PrismaClient } from "@prisma/client";

const normalizeDatabaseUrl = () => {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const normalizedUrl = rawUrl.replace(/^"(.*)"$/, "$1");
  const url = new URL(normalizedUrl);

  url.searchParams.set("connection_limit", "3");
  url.searchParams.set("pool_timeout", "30");
  url.searchParams.set("sslmode", "require");

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
