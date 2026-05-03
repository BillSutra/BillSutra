import { Prisma, type Business, type User, type Worker } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";
import { getAccessTokenSecret } from "./authSecrets.js";

const DEFAULT_BUSINESS_NAME = "Bill Sutra Business";

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const resolveWorkerIdFromClaims = (decodedRecord: Record<string, unknown>) => {
  const directWorkerId =
    normalizeString(decodedRecord.workerId) ??
    normalizeString(decodedRecord.worker_id);

  if (directWorkerId) {
    return directWorkerId;
  }

  const actorId = normalizeString(decodedRecord.actorId);
  if (!actorId?.startsWith("worker:")) {
    return null;
  }

  const parsedWorkerId = actorId.slice("worker:".length).trim();
  return parsedWorkerId.length > 0 ? parsedWorkerId : null;
};

const normalizeBusinessName = (value?: string | null) =>
  normalizeString(value) ?? DEFAULT_BUSINESS_NAME;

const parseOwnerUserId = (ownerId: string) => {
  const ownerUserId = normalizeNumber(ownerId);
  if (!ownerUserId || ownerUserId <= 0) {
    throw new Error("Invalid business owner id");
  }

  return ownerUserId;
};

const isLegacyBusinessId = (businessId: string | null) =>
  typeof businessId === "string" && businessId.startsWith("legacy-business-");

type BusinessRecord = Pick<Business, "id" | "ownerId" | "name">;

const BUSINESS_TABLE_CACHE_TTL_MS = 60_000;
const tableAvailabilityCache = new Map<
  string,
  { value: boolean; checkedAt: number }
>();

const createLegacyBusinessRecord = (
  userId: number,
  preferredName?: string | null,
): BusinessRecord => ({
  id: `legacy-business-${userId}`,
  ownerId: String(userId),
  name: normalizeBusinessName(preferredName),
});

export const isBusinessTableMissingError = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021") {
    return false;
  }

  const meta = error.meta as { modelName?: string; table?: string } | undefined;

  return (
    meta?.modelName === "Business" ||
    meta?.table === "public.businesses" ||
    meta?.table === "businesses"
  );
};

const setTableAvailability = (tableName: string, value: boolean) => {
  tableAvailabilityCache.set(tableName, {
    value,
    checkedAt: Date.now(),
  });
};

const isTableAvailable = async (tableName: string) => {
  const cachedAvailability = tableAvailabilityCache.get(tableName);

  if (
    cachedAvailability &&
    Date.now() - cachedAvailability.checkedAt < BUSINESS_TABLE_CACHE_TTL_MS
  ) {
    return cachedAvailability.value;
  }

  const result = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `);

  const exists = result[0]?.exists === true;
  setTableAvailability(tableName, exists);
  return exists;
};

export const isBusinessTableAvailable = () => isTableAvailable("businesses");

export const isWorkersTableAvailable = () => isTableAvailable("workers");

export const isUserSessionVersionColumnAvailable = () =>
  isTableAvailable("users").then(async (usersTableAvailable) => {
    if (!usersTableAvailable) {
      return false;
    }

    const cached = tableAvailabilityCache.get("users.session_version");
    if (cached && Date.now() - cached.checkedAt < BUSINESS_TABLE_CACHE_TTL_MS) {
      return cached.value;
    }

    const result = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'session_version'
      ) AS "exists"
    `);

    const exists = result[0]?.exists === true;
    setTableAvailability("users.session_version", exists);
    return exists;
  });

export const getUserSessionVersionIfAvailable = async (userId: number) => {
  if (!(await isUserSessionVersionColumnAvailable())) {
    return null;
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{ session_version: number | null }>
    >(
      Prisma.sql`
        SELECT "session_version"
        FROM "users"
        WHERE "id" = ${userId}
        LIMIT 1
      `,
    );

    const value = rows[0]?.session_version;
    return typeof value === "number" ? value : 0;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")
    ) {
      setTableAvailability("users.session_version", false);
      return null;
    }

    throw error;
  }
};

export const findBusinessByOwnerIdIfAvailable = async (userId: number) => {
  if (!(await isBusinessTableAvailable())) {
    return null;
  }

  try {
    return await prisma.business.findUnique({
      where: { ownerId: String(userId) },
      select: { id: true },
    });
  } catch (error) {
    if (isBusinessTableMissingError(error)) {
      setTableAvailability("businesses", false);
      return null;
    }

    throw error;
  }
};

export const ensureBusinessForUser = async (
  userId: number,
  preferredName?: string | null,
) => {
  const name = normalizeBusinessName(preferredName);

  if (!(await isBusinessTableAvailable())) {
    return createLegacyBusinessRecord(userId, preferredName);
  }

  try {
    return await prisma.business.upsert({
      where: { ownerId: String(userId) },
      update: { name },
      create: {
        ownerId: String(userId),
        name,
      },
    });
  } catch (error) {
    if (isBusinessTableMissingError(error)) {
      setTableAvailability("businesses", false);
      return createLegacyBusinessRecord(userId, preferredName);
    }

    throw error;
  }
};

export const buildOwnerAuthUser = async (
  user: Pick<User, "id" | "email" | "name" | "is_email_verified">,
): Promise<AuthUser> => {
  const [business, sessionVersion] = await Promise.all([
    ensureBusinessForUser(user.id, user.name),
    getUserSessionVersionIfAvailable(user.id),
  ]);

  return {
    id: user.id,
    ownerUserId: user.id,
    actorId: `owner:${user.id}`,
    businessId: business.id,
    sessionVersion: sessionVersion ?? 0,
    isEmailVerified: user.is_email_verified,
    latestSessionVersion: sessionVersion ?? 0,
    role: "ADMIN",
    accountType: "OWNER",
    name: user.name,
    email: user.email,
  };
};

export const buildWorkerAuthUser = async (
  worker: Pick<Worker, "id" | "email" | "name" | "role" | "businessId">,
): Promise<AuthUser> => {
  if (!(await isBusinessTableAvailable())) {
    throw new Error(
      "Worker login requires the businesses table migration to be applied",
    );
  }

  let business: Pick<Business, "ownerId"> | null = null;

  try {
    business = await prisma.business.findUnique({
      where: { id: worker.businessId },
      select: { ownerId: true },
    });
  } catch (error) {
    if (isBusinessTableMissingError(error)) {
      setTableAvailability("businesses", false);
      throw new Error(
        "Worker login requires the businesses table migration to be applied",
      );
    }

    throw error;
  }

  if (!business) {
    throw new Error("Business not found for worker");
  }

  const ownerUserId = parseOwnerUserId(business.ownerId);

  const ownerSessionVersion =
    await getUserSessionVersionIfAvailable(ownerUserId);

  return {
    id: ownerUserId,
    ownerUserId,
    actorId: `worker:${worker.id}`,
    businessId: worker.businessId,
    sessionVersion: ownerSessionVersion ?? 0,
    isEmailVerified: true,
    role: "WORKER",
    accountType: "WORKER",
    name: worker.name,
    email: worker.email,
    workerId: worker.id,
    latestSessionVersion: ownerSessionVersion ?? 0,
  };
};

const DEFAULT_ACCESS_TOKEN_TTL = "15m";
const DEFAULT_STANDARD_SESSION_TTL = "1d";
const DEFAULT_REMEMBER_ME_SESSION_TTL = "7d";
const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const parseDurationToMs = (value: string, fallbackMs: number) => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return fallbackMs;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 1000;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return amount;
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return fallbackMs;
  }
};

export type AuthSessionPreferences = {
  rememberMe?: boolean;
};

export type ResolvedAuthSessionPreferences = {
  rememberMe: boolean;
  refreshTokenTtl: string;
  refreshTokenMaxAgeMs: number;
  sessionExpiresAt: number;
  cookieMaxAgeMs: number;
};

export const normalizeRememberMe = (value: unknown) =>
  value === true || value === "true" || value === 1 || value === "1";

export const getAccessTokenTtl = () =>
  process.env.ACCESS_TOKEN_EXPIRES?.trim() ||
  process.env.ACCESS_TOKEN_TTL?.trim() ||
  DEFAULT_ACCESS_TOKEN_TTL;

export const getAccessTokenMaxAgeMs = () =>
  parseDurationToMs(getAccessTokenTtl(), 15 * 60 * 1000);

export const getAccessTokenExpiresAt = () =>
  Date.now() + getAccessTokenMaxAgeMs();

export const getCookieMaxAgeMs = () =>
  parseDurationToMs(
    process.env.COOKIE_MAX_AGE?.trim() || DEFAULT_REMEMBER_ME_SESSION_TTL,
    DEFAULT_COOKIE_MAX_AGE_MS,
  );

export const getStandardSessionTtl = () =>
  process.env.DEFAULT_REFRESH_TOKEN_EXPIRES?.trim() ||
  process.env.SESSION_TOKEN_EXPIRES?.trim() ||
  DEFAULT_STANDARD_SESSION_TTL;

export const getRememberMeSessionTtl = () =>
  process.env.REFRESH_TOKEN_EXPIRES?.trim() ||
  process.env.REFRESH_TOKEN_TTL?.trim() ||
  DEFAULT_REMEMBER_ME_SESSION_TTL;

export const resolveAuthSessionPreferences = (
  preferences?: AuthSessionPreferences,
): ResolvedAuthSessionPreferences => {
  const rememberMe = normalizeRememberMe(preferences?.rememberMe);
  const refreshTokenTtl = rememberMe
    ? getRememberMeSessionTtl()
    : getStandardSessionTtl();
  const fallbackMs = rememberMe
    ? DEFAULT_COOKIE_MAX_AGE_MS
    : 24 * 60 * 60 * 1000;
  const configuredCookieMaxAgeMs = getCookieMaxAgeMs();
  const refreshTokenMaxAgeMs = Math.min(
    parseDurationToMs(refreshTokenTtl, fallbackMs),
    rememberMe
      ? configuredCookieMaxAgeMs
      : Math.min(configuredCookieMaxAgeMs, 24 * 60 * 60 * 1000),
  );

  return {
    rememberMe,
    refreshTokenTtl,
    refreshTokenMaxAgeMs,
    sessionExpiresAt: Date.now() + refreshTokenMaxAgeMs,
    cookieMaxAgeMs: configuredCookieMaxAgeMs,
  };
};

export const signAuthToken = (
  authUser: AuthUser,
  preferences?: AuthSessionPreferences,
) => {
  const unifiedRole = authUser.accountType === "WORKER" ? "worker" : "user";

  return jwt.sign(
    {
      ...authUser,
      id: authUser.id,
      email: authUser.email,
      role: unifiedRole,
      legacyRole: authUser.role,
      token_type: "access_v2",
      remember_me: normalizeRememberMe(preferences?.rememberMe),
    },
    getAccessTokenSecret(),
    {
      expiresIn: getAccessTokenTtl() as jwt.SignOptions["expiresIn"],
    },
  );
};

export const createAuthBearerToken = (authUser: AuthUser) =>
  `Bearer ${signAuthToken(authUser)}`;

export const resolveRememberMeFromDecoded = (
  decoded: string | jwt.JwtPayload | undefined,
) => {
  if (!decoded || typeof decoded === "string") {
    return false;
  }

  const decodedRecord = decoded as Record<string, unknown>;
  return normalizeRememberMe(
    decodedRecord.rememberMe ?? decodedRecord.remember_me,
  );
};

export const hasSupportedAccessTokenType = (
  decoded: string | jwt.JwtPayload | undefined,
) => {
  if (!decoded || typeof decoded === "string") {
    return false;
  }

  const decodedRecord = decoded as Record<string, unknown>;
  const tokenType =
    typeof decodedRecord.token_type === "string"
      ? decodedRecord.token_type.trim()
      : "";

  if (!tokenType) {
    return true;
  }

  return tokenType === "access_v2";
};

export const resolveAuthUserFromDecoded = async (
  decoded: string | jwt.JwtPayload | undefined,
): Promise<AuthUser | null> => {
  if (!decoded || typeof decoded === "string") {
    return null;
  }

  const decodedRecord = decoded as Record<string, unknown>;

  const ownerUserId =
    normalizeNumber(decodedRecord.ownerUserId) ??
    normalizeNumber(decodedRecord.id);
  const email = normalizeString(decodedRecord.email);
  const name = normalizeString(decodedRecord.name);

  if (!ownerUserId || !email || !name) {
    return null;
  }

  const businessId = normalizeString(decodedRecord.businessId);
  const sessionVersion = normalizeNumber(decodedRecord.sessionVersion) ?? 0;
  const tokenEmailVerification: boolean | null =
    typeof decodedRecord.isEmailVerified === "boolean"
      ? decodedRecord.isEmailVerified
      : typeof decodedRecord.is_email_verified === "boolean"
        ? decodedRecord.is_email_verified
        : null;
  const accountType =
    normalizeString(decodedRecord.accountType) === "WORKER" ? "WORKER" : "OWNER";
  const workerId = resolveWorkerIdFromClaims(decodedRecord);
  const tokenRole =
    normalizeString(decodedRecord.legacyRole) ??
    normalizeString(decodedRecord.role);
  const role =
    accountType === "WORKER"
      ? "WORKER"
      : tokenRole === "WORKER"
        ? "WORKER"
        : "ADMIN";

  if (
    !businessId ||
    (accountType === "OWNER" && isLegacyBusinessId(businessId))
  ) {
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        email: true,
        name: true,
        is_email_verified: true,
      },
    });

    if (!owner) {
      return null;
    }

    return buildOwnerAuthUser(owner);
  }

  let isEmailVerified =
    tokenEmailVerification ?? (accountType === "WORKER");

  if (accountType === "OWNER") {
    const owner = await prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        is_email_verified: true,
        session_version: true,
      },
    });

    if (!owner) {
      return null;
    }

    isEmailVerified = owner.is_email_verified;
    return {
      id: ownerUserId,
      ownerUserId,
      actorId:
        normalizeString(decodedRecord.actorId) ??
        (workerId ? `worker:${workerId}` : `owner:${ownerUserId}`),
      businessId,
      sessionVersion,
      latestSessionVersion: owner.session_version ?? 0,
      isEmailVerified,
      role,
      accountType,
      name,
      email,
      workerId: workerId ?? undefined,
      rememberMe: resolveRememberMeFromDecoded(decoded),
    };
  }

  return {
    id: ownerUserId,
    ownerUserId,
    actorId:
      normalizeString(decodedRecord.actorId) ??
      (workerId ? `worker:${workerId}` : `owner:${ownerUserId}`),
    businessId,
    sessionVersion,
    latestSessionVersion: null,
    isEmailVerified,
    role,
    accountType,
    name,
    email,
    workerId: workerId ?? undefined,
    rememberMe: resolveRememberMeFromDecoded(decoded),
  };
};
