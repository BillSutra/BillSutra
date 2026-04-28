import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";
import { hashSecretValue } from "./modernAuth.js";
import { recordAuditLog } from "../services/auditLog.service.js";
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
const prismaUnsafe = prisma as any;
let hasLoggedStatelessRefreshFallback = false;

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
const AUTH_COOKIE_ROOT_PATH = "/";
const REFRESH_COOKIE_PATH = "/api/auth";

const trimForStorage = (value: string | null | undefined, maxLength: number) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
};

const resolveRequestIp = (req?: Request) => {
  if (!req) {
    return null;
  }

  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return trimForStorage(forwardedFor.split(",")[0] ?? null, 64);
  }

  if (Array.isArray(forwardedFor) && forwardedFor[0]) {
    return trimForStorage(forwardedFor[0], 64);
  }

  return trimForStorage(req.ip || req.socket.remoteAddress || null, 64);
};

const resolveRequestUserAgent = (req?: Request) => {
  if (!req) {
    return null;
  }

  return typeof req.headers["user-agent"] === "string"
    ? trimForStorage(req.headers["user-agent"], 512)
    : null;
};

const resolveDeviceName = (req?: Request) => {
  const userAgent = resolveRequestUserAgent(req)?.toLowerCase() ?? "";
  if (!userAgent) {
    return "Unknown device";
  }

  const browser = userAgent.includes("edg/")
    ? "Edge"
    : userAgent.includes("chrome/")
      ? "Chrome"
      : userAgent.includes("safari/") && !userAgent.includes("chrome/")
        ? "Safari"
        : userAgent.includes("firefox/")
          ? "Firefox"
          : userAgent.includes("opr/")
            ? "Opera"
            : "Browser";

  const platform = userAgent.includes("android")
    ? "Android"
    : userAgent.includes("iphone") || userAgent.includes("ipad")
      ? "iPhone"
      : userAgent.includes("windows")
        ? "Windows"
        : userAgent.includes("mac os")
          ? "Mac"
          : userAgent.includes("linux")
            ? "Linux"
            : "Device";

  return trimForStorage(`${browser} on ${platform}`, 191) ?? "Unknown device";
};

const resolveSameSite = () => {
  const configuredValue = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (configuredValue === "lax") {
    return "lax" as const;
  }

  return "strict" as const;
};

const COOKIE_SAMESITE = resolveSameSite();

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

const logRefreshTableFallback = (detail?: Record<string, unknown>) => {
  if (hasLoggedStatelessRefreshFallback) {
    return;
  }

  hasLoggedStatelessRefreshFallback = true;
  logAuth(
    "refresh_cookie_using_stateless_fallback_missing_table",
    detail,
    "warn",
  );
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

const clearCookieNames = (
  res: Response,
  cookieNames: string[],
  path = AUTH_COOKIE_ROOT_PATH,
) => {
  const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: COOKIE_SAMESITE,
    path,
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
  path = AUTH_COOKIE_ROOT_PATH,
) => {
  cookieNames.forEach((cookieName) => {
    res.cookie(cookieName, value, {
      httpOnly: true,
      secure: isProd,
      sameSite: COOKIE_SAMESITE,
      path,
      maxAge,
    });
  });
};

export const clearAuthCookies = (res: Response) => {
  clearCookieNames(
    res,
    [ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_ALIAS],
    AUTH_COOKIE_ROOT_PATH,
  );
  clearCookieNames(
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    REFRESH_COOKIE_PATH,
  );
  clearCookieNames(
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    AUTH_COOKIE_ROOT_PATH,
  );
};

const setAccessCookie = (res: Response, accessToken: string) => {
  setCookieNames(
    res,
    [ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_ALIAS],
    accessToken,
    getAccessTokenMaxAgeMs(),
    AUTH_COOKIE_ROOT_PATH,
  );
};

const setRefreshCookie = (res: Response, refreshToken: string) => {
  setCookieNames(
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    refreshToken,
    resolveAuthSessionPreferences({ rememberMe: true }).cookieMaxAgeMs,
    REFRESH_COOKIE_PATH,
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

type IssuedAuthCookies = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: number;
  sessionExpiresAt: number;
  rememberMe: boolean;
};

export const issueAuthCookies = async (
  req: Request | undefined,
  res: Response,
  authUser: AuthUser,
  preferences?: {
    rememberMe?: boolean;
    reason?: string;
  },
): Promise<IssuedAuthCookies> => {
  const sessionPreferences = resolveAuthSessionPreferences(preferences);
  const accessToken = signAuthToken(authUser, sessionPreferences);
  setAccessCookie(res, accessToken);

  // Backward-compatible rollout: if the new refresh token table is not yet
  // available in an environment, keep refresh-cookie persistence alive using
  // signed JWT refresh cookies until migrations are applied.
  const refreshTableAvailable = await isRefreshTokensTableAvailable();
  if (!refreshTableAvailable) {
    const refreshToken = signRefreshToken(
      authUser,
      sessionPreferences.refreshTokenTtl,
      sessionPreferences.rememberMe,
    );
    setCookieNames(
      res,
      [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
      refreshToken,
      sessionPreferences.refreshTokenMaxAgeMs,
      REFRESH_COOKIE_PATH,
    );
    logRefreshTableFallback({
      ownerUserId: authUser.ownerUserId,
      reason: preferences?.reason ?? "login",
    });
    return {
      accessToken,
      refreshToken,
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
  const requestIp = resolveRequestIp(req);
  const requestUserAgent = resolveRequestUserAgent(req);
  const deviceName = resolveDeviceName(req);
  const issueReason = preferences?.reason ?? "login";

  try {
    if (req && issueReason !== "refresh" && (requestIp || requestUserAgent)) {
      const existingDeviceSession = await prismaUnsafe.refreshToken.findFirst({
        where: {
          user_id: authUser.ownerUserId,
          revoked_at: null,
          expires_at: {
            gt: new Date(),
          },
          OR: [
            ...(requestIp ? [{ ip_address: { not: requestIp } }] : []),
            ...(requestUserAgent
              ? [{ user_agent: { not: requestUserAgent } }]
              : []),
          ],
        },
        select: {
          id: true,
          ip_address: true,
          user_agent: true,
          device_name: true,
          created_at: true,
          last_used_at: true,
        },
      });

      if (existingDeviceSession) {
        logAuth(
          "suspicious_login_detected",
          {
            ownerUserId: authUser.ownerUserId,
            currentIp: requestIp,
            currentDevice: deviceName,
            previousIp: existingDeviceSession.ip_address,
            previousDevice: existingDeviceSession.device_name,
            reason: issueReason,
          },
          "warn",
        );

        await recordAuditLog({
          req,
          userId: authUser.ownerUserId,
          actorId: authUser.actorId,
          actorType: authUser.accountType,
          action: "auth.suspicious_login_detected",
          resourceType: "session",
          resourceId: existingDeviceSession.id,
          status: "warning",
          metadata: {
            reason: issueReason,
            currentIp: requestIp,
            currentDevice: deviceName,
            previousIp: existingDeviceSession.ip_address,
            previousDevice: existingDeviceSession.device_name,
            previousLastUsedAt: existingDeviceSession.last_used_at,
          },
        });
      }
    }

    await prismaUnsafe.refreshToken.create({
      data: {
        user_id: authUser.ownerUserId,
        token_hash: tokenHash,
        ip_address: requestIp ?? undefined,
        user_agent: requestUserAgent ?? undefined,
        device_name: deviceName ?? undefined,
        expires_at: expiresAt,
        last_used_at: new Date(),
      },
    });
    setCookieNames(
      res,
      [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
      refreshToken,
      sessionPreferences.refreshTokenMaxAgeMs,
      REFRESH_COOKIE_PATH,
    );
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      hasLoggedStatelessRefreshFallback = false;
      return issueAuthCookies(req, res, authUser, preferences);
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
    return await prismaUnsafe.refreshToken.findFirst({
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

const revokeRefreshTokenByHash = async (
  refreshToken: string,
  reason = "manual_logout",
) => {
  if (!(await isRefreshTokensTableAvailable())) {
    return;
  }

  try {
    await prismaUnsafe.refreshToken.updateMany({
      where: {
        token_hash: hashSecretValue(refreshToken),
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        revoked_reason: reason,
      },
    });
  } catch (error) {
    if (isRefreshTokensTableMissingError(error)) {
      setTableAvailability("refresh_tokens", false);
      return;
    }

    throw error;
  }
};

export const revokeAllRefreshTokensForUser = async (
  userId: number,
  reason = "logout_all_devices",
) => {
  if (!(await isRefreshTokensTableAvailable())) {
    return;
  }

  try {
    await prismaUnsafe.refreshToken.updateMany({
      where: {
        user_id: userId,
        revoked_at: null,
      },
      data: {
        revoked_at: new Date(),
        revoked_reason: reason,
      },
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

  await revokeRefreshTokenByHash(refreshToken, "manual_logout");
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
    await revokeRefreshTokenByHash(refreshToken, "jwt_verify_failed");
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "jwt_verify_failed", message: (error as Error).message }, "warn");
    return null;
  }

  if (!decoded || typeof decoded === "string") {
    await revokeRefreshTokenByHash(refreshToken, "invalid_payload");
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "invalid_payload" }, "warn");
    return null;
  }

  const tokenType =
    typeof decoded.token_type === "string" ? decoded.token_type : null;
  if (tokenType !== "refresh_v1") {
    await revokeRefreshTokenByHash(refreshToken, "unexpected_token_type");
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "unexpected_token_type", tokenType }, "warn");
    return null;
  }

  const authUser = await resolveAuthUserFromDecoded(decoded);
  if (!authUser) {
    await revokeRefreshTokenByHash(refreshToken, "auth_user_resolution_failed");
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
    await revokeAllRefreshTokensForUser(
      authUser.ownerUserId,
      "session_version_mismatch",
    );
    await recordAuditLog({
      req,
      userId: authUser.ownerUserId,
      actorId: authUser.actorId,
      actorType: authUser.accountType,
      action: "auth.refresh.session_version_mismatch",
      resourceType: "session",
      status: "warning",
      metadata: {
        latestSessionVersion,
        tokenSessionVersion: authUser.sessionVersion,
      },
    });
    clearAuthCookies(res);
    logAuth("refresh_failed", { reason: "session_version_mismatch", ownerUserId: authUser.ownerUserId }, "warn");
    return null;
  }

  const refreshTableAvailable = await isRefreshTokensTableAvailable();
  if (!refreshTableAvailable) {
    const issued = await issueAuthCookies(req, res, authUser, {
      rememberMe,
      reason: "refresh",
    });
    logRefreshTableFallback({
      ownerUserId: authUser.ownerUserId,
      reason: "refresh",
    });
    logAuth("refresh_success", {
      ownerUserId: authUser.ownerUserId,
      accountType: authUser.accountType,
      role: authUser.role,
      rememberMe,
      storage: "stateless_fallback",
    });

    return {
      authUser,
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.accessTokenExpiresAt,
      sessionExpiresAt: issued.sessionExpiresAt,
      rememberMe: issued.rememberMe,
    };
  }

  const storedToken = await findStoredRefreshToken(refreshToken, authUser.ownerUserId);
  if (
    !storedToken ||
    storedToken.revoked_at ||
    storedToken.expires_at.getTime() <= Date.now()
  ) {
    const failureReason = storedToken?.revoked_at
      ? "refresh_token_reuse_detected"
      : "stored_token_missing_or_expired";
    await revokeAllRefreshTokensForUser(authUser.ownerUserId, failureReason);
    await recordAuditLog({
      req,
      userId: authUser.ownerUserId,
      actorId: authUser.actorId,
      actorType: authUser.accountType,
      action: "auth.refresh.failed",
      resourceType: "session",
      status: storedToken?.revoked_at ? "warning" : "failure",
      metadata: {
        reason: failureReason,
        hadStoredToken: Boolean(storedToken),
        tokenId: storedToken?.id ?? null,
        deviceName: storedToken?.device_name ?? null,
      },
    });
    clearAuthCookies(res);
    logAuth(
      "refresh_failed",
      {
        reason: failureReason,
        ownerUserId: authUser.ownerUserId,
      },
      "warn",
    );
    return null;
  }

  await prismaUnsafe.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revoked_at: new Date(),
      revoked_reason: "rotated",
      last_used_at: new Date(),
      ip_address: resolveRequestIp(req) ?? storedToken.ip_address,
      user_agent: resolveRequestUserAgent(req) ?? storedToken.user_agent,
      device_name: resolveDeviceName(req) ?? storedToken.device_name,
    },
  });

  const issued = await issueAuthCookies(req, res, authUser, {
    rememberMe,
    reason: "refresh",
  });
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
