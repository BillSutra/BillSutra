import { Prisma, type Business, type User, type Worker } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";

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

  const meta = error.meta as
    | { modelName?: string; table?: string }
    | undefined;

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
  user: Pick<User, "id" | "email" | "name">,
): Promise<AuthUser> => {
  const business = await ensureBusinessForUser(user.id, user.name);

  return {
    id: user.id,
    ownerUserId: user.id,
    actorId: `owner:${user.id}`,
    businessId: business.id,
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

  return {
    id: ownerUserId,
    ownerUserId,
    actorId: `worker:${worker.id}`,
    businessId: worker.businessId,
    role: worker.role === "ADMIN" ? "ADMIN" : "WORKER",
    accountType: "WORKER",
    name: worker.name,
    email: worker.email,
    workerId: worker.id,
  };
};

export const signAuthToken = (authUser: AuthUser) =>
  jwt.sign(authUser, process.env.JWT_SECRET as string, {
    expiresIn: "365d",
  });

export const createAuthBearerToken = (authUser: AuthUser) =>
  `Bearer ${signAuthToken(authUser)}`;

export const resolveAuthUserFromDecoded = async (
  decoded: string | jwt.JwtPayload | undefined,
): Promise<AuthUser | null> => {
  if (!decoded || typeof decoded === "string") {
    return null;
  }

  const ownerUserId =
    normalizeNumber((decoded as Record<string, unknown>).ownerUserId) ??
    normalizeNumber((decoded as Record<string, unknown>).id);
  const email = normalizeString((decoded as Record<string, unknown>).email);
  const name = normalizeString((decoded as Record<string, unknown>).name);

  if (!ownerUserId || !email || !name) {
    return null;
  }

  const businessId = normalizeString(
    (decoded as Record<string, unknown>).businessId,
  );
  const workerId = normalizeString((decoded as Record<string, unknown>).workerId);
  const role =
    normalizeString((decoded as Record<string, unknown>).role) === "WORKER"
      ? "WORKER"
      : "ADMIN";
  const accountType =
    normalizeString((decoded as Record<string, unknown>).accountType) ===
    "WORKER"
      ? "WORKER"
      : "OWNER";

  if (!businessId || (accountType === "OWNER" && isLegacyBusinessId(businessId))) {
    return buildOwnerAuthUser({ id: ownerUserId, email, name });
  }

  return {
    id: ownerUserId,
    ownerUserId,
    actorId:
      normalizeString((decoded as Record<string, unknown>).actorId) ??
      (workerId ? `worker:${workerId}` : `owner:${ownerUserId}`),
    businessId,
    role,
    accountType,
    name,
    email,
    workerId: workerId ?? undefined,
  };
};
