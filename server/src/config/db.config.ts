import { PrismaClient } from "@prisma/client";

const resolvePositiveNumber = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const stripWrappingQuotes = (value: string) =>
  value.trim().replace(/^"(.*)"$/, "$1");

const tryParseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const safeEncodeUrlComponent = (value: string) => {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
};

const sanitizePostgresCredentials = (value: string) => {
  const protocolMatch = value.match(/^([a-z0-9+.-]+):\/\//i);

  if (!protocolMatch) {
    return value;
  }

  const protocol = protocolMatch[1].toLowerCase();

  if (!["postgresql", "postgres"].includes(protocol)) {
    return value;
  }

  const remainder = value.slice(protocolMatch[0].length);
  const slashIndex = remainder.indexOf("/");
  const authority = slashIndex >= 0 ? remainder.slice(0, slashIndex) : remainder;
  const suffix = slashIndex >= 0 ? remainder.slice(slashIndex) : "";
  const lastAtIndex = authority.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return value;
  }

  const authSegment = authority.slice(0, lastAtIndex);
  const hostSegment = authority.slice(lastAtIndex + 1);
  const separatorIndex = authSegment.indexOf(":");

  if (separatorIndex === -1) {
    return value;
  }

  const username = authSegment.slice(0, separatorIndex);
  const password = authSegment.slice(separatorIndex + 1);

  return `${protocol}://${safeEncodeUrlComponent(username)}:${safeEncodeUrlComponent(password)}@${hostSegment}${suffix}`;
};

const normalizeDatabaseUrl = () => {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const normalizedUrl = stripWrappingQuotes(rawUrl);
  const sanitizedUrl = sanitizePostgresCredentials(normalizedUrl);
  const url = tryParseUrl(sanitizedUrl);

  if (!url) {
    throw new Error(
      "DATABASE_URL is invalid. URL-encode special characters in the database username and password.",
    );
  }

  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    return url.toString();
  }

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
