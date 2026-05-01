import type { Request } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { hashSecretValue } from "../lib/modernAuth.js";
import {
  REFRESH_TOKEN_COOKIE_ALIAS,
  REFRESH_TOKEN_COOKIE_NAME,
  parseCookies,
} from "../lib/authCookies.js";

type SessionRecord = {
  id: string;
  token_hash: string;
  device_name: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  last_used_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

const TABLE_CACHE_TTL_MS = 60_000;
let tableAvailability: { exists: boolean; checkedAt: number } | null = null;
const prismaUnsafe = prisma as any;

const isRefreshTokenTableMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === "P2021" || error.code === "P2022");

const isRefreshTokenTableAvailable = async () => {
  const now = Date.now();
  if (tableAvailability && now - tableAvailability.checkedAt < TABLE_CACHE_TTL_MS) {
    return tableAvailability.exists;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'refresh_tokens'
      ) AS "exists"
    `);

    tableAvailability = {
      exists: rows[0]?.exists === true,
      checkedAt: now,
    };

    return tableAvailability.exists;
  } catch {
    tableAvailability = { exists: false, checkedAt: now };
    return false;
  }
};

const readRefreshTokenFromRequest = (req: Request) => {
  const cookies = parseCookies(req.headers.cookie);
  return (
    cookies.get(REFRESH_TOKEN_COOKIE_NAME) ??
    cookies.get(REFRESH_TOKEN_COOKIE_ALIAS) ??
    null
  );
};

export const listActiveDeviceSessions = async (userId: number, req?: Request) => {
  if (!(await isRefreshTokenTableAvailable())) {
    return [];
  }

  const currentTokenHash = req
    ? (() => {
        const refreshToken = readRefreshTokenFromRequest(req);
        return refreshToken ? hashSecretValue(refreshToken) : null;
      })()
    : null;

  try {
    const rows = await prisma.$queryRaw<SessionRecord[]>(Prisma.sql`
      SELECT
        id,
        token_hash,
        device_name,
        ip_address,
        user_agent,
        created_at,
        last_used_at,
        expires_at,
        revoked_at
      FROM "refresh_tokens"
      WHERE "user_id" = ${userId}
        AND "revoked_at" IS NULL
        AND "expires_at" > CURRENT_TIMESTAMP
      ORDER BY "last_used_at" DESC, "created_at" DESC
    `);

    return rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name ?? "Unknown device",
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.created_at.toISOString(),
      lastUsedAt: row.last_used_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      isCurrent:
        currentTokenHash !== null && row.token_hash === currentTokenHash,
    }));
  } catch (error) {
    if (isRefreshTokenTableMissingError(error)) {
      tableAvailability = { exists: false, checkedAt: Date.now() };
      return [];
    }

    throw error;
  }
};

export const getCurrentRefreshSessionId = async (req: Request, userId: number) => {
  if (!(await isRefreshTokenTableAvailable())) {
    return null;
  }

  const refreshToken = readRefreshTokenFromRequest(req);
  if (!refreshToken) {
    return null;
  }

  try {
    const record = await prismaUnsafe.refreshToken.findFirst({
      where: {
        user_id: userId,
        token_hash: hashSecretValue(refreshToken),
      },
      select: {
        id: true,
      },
    });

    return record?.id ?? null;
  } catch (error) {
    if (isRefreshTokenTableMissingError(error)) {
      tableAvailability = { exists: false, checkedAt: Date.now() };
      return null;
    }

    throw error;
  }
};

export const revokeRefreshSessionById = async (
  userId: number,
  sessionId: string,
  reason = "manual_revoke",
) => {
  if (!(await isRefreshTokenTableAvailable())) {
    return false;
  }

  try {
    const result = await prismaUnsafe.refreshToken.updateMany({
      where: {
        id: sessionId,
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        revoked_reason: reason,
      },
    });

    return result.count > 0;
  } catch (error) {
    if (isRefreshTokenTableMissingError(error)) {
      tableAvailability = { exists: false, checkedAt: Date.now() };
      return false;
    }

    throw error;
  }
};

export const revokeOtherRefreshSessions = async (
  userId: number,
  currentSessionId?: string | null,
  reason = "logout_other_devices",
) => {
  if (!(await isRefreshTokenTableAvailable())) {
    return 0;
  }

  try {
    const result = await prismaUnsafe.refreshToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
        ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
      },
      data: {
        revoked_at: new Date(),
        revoked_reason: reason,
      },
    });

    return result.count;
  } catch (error) {
    if (isRefreshTokenTableMissingError(error)) {
      tableAvailability = { exists: false, checkedAt: Date.now() };
      return 0;
    }

    throw error;
  }
};
