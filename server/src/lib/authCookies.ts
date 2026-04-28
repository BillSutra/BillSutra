import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";
import { hashSecretValue } from "./modernAuth.js";
import {
  getAccessTokenExpiresAt,
  getAccessTokenMaxAgeMs,
  getUserSessionVersionIfAvailable,
  resolveAuthSessionPreferences,
  resolveRememberMeFromDecoded,
  resolveAuthUserFromDecoded,
  signAuthToken,
} from "./authSession.js";

export const ACCESS_TOKEN_COOKIE_NAME = "bill_sutra_access_token";
export const REFRESH_TOKEN_COOKIE_NAME = "bill_sutra_refresh_token";
export const ACCESS_TOKEN_COOKIE_ALIAS = "accessToken";
export const REFRESH_TOKEN_COOKIE_ALIAS = "refreshToken";

const TABLE_CACHE_TTL_MS = 60_000;

const tableAvailabilityCache = new Map<string, { value: boolean; checkedAt: number }>();

const setTableAvailability = (tableName: string, value: boolean) => {
  tableAvailabilityCache.set(tableName, {
    value,
    checkedAt: Date.now(),
  });
};

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

const isProd = process.env.NODE_ENV === "production";
const authLogEnabled = process.env.AUTH_LOGGING_ENABLED !== "false";

const logAuth = (
  event: string,
  detail?: Record<string, unknown>,
  level: "info" | "warn" = "info",
) => {
  if (!authLogEnabled) {
    return;
  }

  const logger = level === "warn" ? console.warn : console.info;
  logger(`[auth] ${event}`, detail ?? {});
};

const isRefreshTokensTableMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021";

const isRefreshTokensTableAvailable = async () => {
  const cached = tableAvailabilityCache.get("refresh_tokens");
  if (cached && Date.now() - cached.checkedAt < TABLE_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'refresh_tokens'
      ) AS "exists"
    `);

    const exists = result[0]?.exists === true;
    setTableAvailability("refresh_tokens", exists);
    return exists;
  } catch {
    setTableAvailability("refresh_tokens", false);
    return false;
  }
};

export const parseCookies = (cookieHeader?: string | null) => {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  cookieHeader.split(";").forEach((entry) => {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      return;
    }

    cookies.set(key, decodeURIComponent(value));
  });

  return cookies;
};

export const getCookieValue = (req: Request, cookieName: string) =>
  parseCookies(req.headers.cookie).get(cookieName) ?? null;

const getCookieValueFromNames = (req: Request, cookieNames: string[]) => {
  const cookies = parseCookies(req.headers.cookie);

  for (const cookieName of cookieNames) {
    const value = cookies.get(cookieName);
    if (value) {
      return value;
    }
  }

  return null;
};

const clearCookieNames = (res: Response, cookieNames: string[]) => {
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
  };

  cookieNames.forEach((cookieName) => {
    res.clearCookie(cookieName, cookieOptions);
  });
};

const setCookieNames = (
  res: Response,
  cookieNames: string[],
  value: string,
  maxAge: number,
) => {
  cookieNames.forEach((cookieName) => {
    res.cookie(cookieName, value, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      path: "/",
      maxAge,
    });
  });
};

export const clearAuthCookies = (res: Response) => {
  clearCookieNames(res, [ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_ALIAS]);
  clearCookieNames(res, [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS]);
};

const setAccessCookie = (res: Response, accessToken: string) => {
  setCookieNames(
    res,
    [ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_ALIAS],
    accessToken,
    getAccessTokenMaxAgeMs(),
  );
};

const setRefreshCookie = (res: Response, refreshToken: string) => {
  setCookieNames(
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    refreshToken,
    resolveAuthSessionPreferences({ rememberMe: true }).cookieMaxAgeMs,
  );
};

const signRefreshToken = (
  authUser: AuthUser,
  refreshTokenTtl: string,
  rememberMe: boolean,
) =>
  jwt.sign(
    {
      ...authUser,
      token_type: "refresh_v1",
      remember_me: rememberMe,
    },
    process.env.REFRESH_TOKEN_SECRET?.trim() ||
      (process.env.JWT_SECRET as string),
    {
      expiresIn: refreshTokenTtl as jwt.SignOptions["expiresIn"],
    },
  );

export const issueAuthCookies = async (
  res: Response,
  authUser: AuthUser,
  preferences?: {
    rememberMe?: boolean;
  },
) => {
  const sessionPreferences = resolveAuthSessionPreferences(preferences);
  const accessToken = signAuthToken(authUser, sessionPreferences);
  setAccessCookie(res, accessToken);

  // Backward-compatible rollout: if the new refresh token table is not yet
  // available in an environment, we still issue the short-lived access cookie
  // and preserve legacy bearer-token flows instead of breaking login.
  const refreshTableAvailable = await isRefreshTokensTableAvailable();
  if (!refreshTableAvailable) {
    logAuth("refresh_cookie_skipped_missing_table");
    return {
      accessToken,
      refreshToken: null as string | null,
      accessTokenExpiresAt: getAccessTokenExpiresAt(),
      sessionExpiresAt: sessionPreferences.sessionExpiresAt,
      rememberMe: sessionPreferences.rememberMe,
    };
  }

  const refreshToken = signRefreshToken(
    authUser,
    sessionPreferences.refreshTokenTtl,
    sessionPreferences.rememberMe,
  );
  const tokenHash = hashSecretValue(refreshToken);
  const expiresAt = new Date(Date.now() + sessionPreferences.refreshTokenMaxAgeMs);

  try {
    await prisma.refreshToken.create({
      data: {
        user_id: authUser.ownerUserId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });
    setCookieNames(
      res,
      [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
      refreshToken,
      sessionPreferences.refreshTokenMaxAgeMs,
    );
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      logAuth("refresh_cookie_skipped_table_missing_runtime", undefined, "warn");
      return {
        accessToken,
        refreshToken: null as string | null,
        accessTokenExpiresAt: getAccessTokenExpiresAt(),
        sessionExpiresAt: sessionPreferences.sessionExpiresAt,
        rememberMe: sessionPreferences.rememberMe,
      };
    }

    throw error;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: getAccessTokenExpiresAt(),
    sessionExpiresAt: sessionPreferences.sessionExpiresAt,
    rememberMe: sessionPreferences.rememberMe,
  };
};

const findStoredRefreshToken = async (refreshToken: string, ownerUserId: number) => {
  if (!(await isRefreshTokensTableAvailable())) {
    return null;
  }

  try {
    return await prisma.refreshToken.findFirst({
      where: {
        user_id: ownerUserId,
        token_hash: hashSecretValue(refreshToken),
      },
    });
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      return null;
    }

    throw error;
  }
};

const deleteRefreshTokenByHash = async (refreshToken: string) => {
  if (!(await isRefreshTokensTableAvailable())) {
    return;
  }

  try {
    await prisma.refreshToken.deleteMany({
      where: { token_hash: hashSecretValue(refreshToken) },
    });
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      return;
    }

    throw error;
  }
};

export const revokeAllRefreshTokensForUser = async (userId: number) => {
  if (!(await isRefreshTokensTableAvailable())) {
    return;
  }

  try {
    await prisma.refreshToken.deleteMany({
      where: { user_id: userId },
    });
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      return;
    }

    throw error;
  }
};

export const revokeRefreshTokenFromRequest = async (req: Request) => {
  const refreshToken = getCookieValueFromNames(req, [
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_ALIAS,
  ]);
  if (!refreshToken) {
    return false;
  }

  await deleteRefreshTokenByHash(refreshToken);
  return true;
};

export const refreshAuthCookies = async (req: Request, res: Response) => {
  const refreshToken = getCookieValueFromNames(req, [
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_ALIAS,
  ]);
  if (!refreshToken) {
    logAuth("refresh_failed", { reason: "missing_cookie" }, "warn");
    return null;
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET?.trim() ||
        (process.env.JWT_SECRET as string),
    );
  } catch (error) {
    await deleteRefreshTokenByHash(refreshToken);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "jwt_verify_failed", message: (error as Error).message }, "warn");
    return null;
  }

  if (!decoded || typeof decoded === "string") {
    await deleteRefreshTokenByHash(refreshToken);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "invalid_payload" }, "warn");
    return null;
  }

  const tokenType =
    typeof decoded.token_type === "string" ? decoded.token_type : null;
  if (tokenType !== "refresh_v1") {
    await deleteRefreshTokenByHash(refreshToken);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "unexpected_token_type", tokenType }, "warn");
    return null;
  }

  const authUser = await resolveAuthUserFromDecoded(decoded);
  if (!authUser) {
    await deleteRefreshTokenByHash(refreshToken);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "auth_user_resolution_failed" }, "warn");
    return null;
  }

  const rememberMe = resolveRememberMeFromDecoded(decoded);

  const latestSessionVersion = await getUserSessionVersionIfAvailable(
    authUser.ownerUserId,
  );

  if (
    latestSessionVersion !== null &&
    latestSessionVersion !== authUser.sessionVersion
  ) {
    await revokeAllRefreshTokensForUser(authUser.ownerUserId);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "session_version_mismatch", ownerUserId: authUser.ownerUserId }, "warn");
    return null;
  }

  const storedToken = await findStoredRefreshToken(refreshToken, authUser.ownerUserId);
  if (!storedToken || storedToken.expires_at.getTime() <= Date.now()) {
    await deleteRefreshTokenByHash(refreshToken);
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "stored_token_missing_or_expired", ownerUserId: authUser.ownerUserId }, "warn");
    return null;
  }

  await prisma.refreshToken.delete({
    where: { id: storedToken.id },
  });

  const issued = await issueAuthCookies(res, authUser, { rememberMe });
  logAuth("refresh_success", {
    ownerUserId: authUser.ownerUserId,
    accountType: authUser.accountType,
    role: authUser.role,
    rememberMe,
  });

  return {
    authUser,
    accessToken: issued.accessToken,
    accessTokenExpiresAt: issued.accessTokenExpiresAt,
    sessionExpiresAt: issued.sessionExpiresAt,
    rememberMe: issued.rememberMe,
  };
};

export const resolveAccessTokenFromRequest = (req: Request) => {
  const authHeader = req.headers.authorization;
  const headerToken =
    typeof authHeader === "string" && authHeader.trim().toLowerCase().startsWith("bearer ")
      ? authHeader.trim().slice("bearer ".length).trim()
      : null;

  const cookieToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_NAME);
  const cookieAliasToken = getCookieValue(req, ACCESS_TOKEN_COOKIE_ALIAS);

  return {
    headerToken,
    cookieToken: cookieToken ?? cookieAliasToken,
  };
};

export const logResolvedTokenSource = (
  source: "header" | "cookie" | "none",
  extra?: Record<string, unknown>,
) => {
  if (source === "none") {
    logAuth("token_source", { source, ...extra }, "warn");
    return;
  }

  logAuth("token_source", { source, ...extra });
};
