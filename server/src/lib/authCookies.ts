import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import jwt from "jsonwebtoken";
import prisma from "../config/db.config.js";
import { getAccessTokenSecret, getRefreshTokenSecret } from "./authSecrets.js";
import { hashSecretValue } from "./modernAuth.js";
import { recordAuditLog } from "../services/auditLog.service.js";
import { createNotification } from "../services/notification.service.js";
import { buildHttpOnlyCookieOptions } from "./cookieSecurity.js";
import {
  getAccessTokenExpiresAt,
  getAccessTokenMaxAgeMs,
  getAccessTokenTtl,
  getRememberMeSessionTtl,
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
const LEGACY_FRAGMENTED_COOKIE_NAMES = [
  "bill_sutra_super_admin_token",
  "bill_sutra_admin_token",
  "bill_sutra_worker_token",
  "bill_sutra_user_token",
  "bill_sutra_admin_session",
  "bill_sutra_admin_refresh",
];

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

const authLogEnabled = process.env.AUTH_LOGGING_ENABLED !== "false";
const AUTH_COOKIE_ROOT_PATH = "/";
const REFRESH_COOKIE_PATH = AUTH_COOKIE_ROOT_PATH;
const LEGACY_REFRESH_COOKIE_PATH = "/api/auth";
const REFRESH_ROTATION_GRACE_MS = parseDurationToMs(
  process.env.AUTH_REFRESH_ROTATION_GRACE ?? "30s",
  30_000,
);

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

const getDateMs = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const isRecentlyRotatedRefreshToken = (
  storedToken: {
    revoked_at?: Date | string | null;
    revoked_reason?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
  } | null,
  req: Request,
) => {
  if (
    !storedToken?.revoked_at ||
    storedToken.revoked_reason !== "rotated" ||
    REFRESH_ROTATION_GRACE_MS <= 0
  ) {
    return false;
  }

  const revokedAt = getDateMs(storedToken.revoked_at);
  if (revokedAt === null || Date.now() - revokedAt > REFRESH_ROTATION_GRACE_MS) {
    return false;
  }

  const requestIp = resolveRequestIp(req);
  const requestUserAgent = resolveRequestUserAgent(req);
  const sameKnownIp =
    !storedToken.ip_address || !requestIp || storedToken.ip_address === requestIp;
  const sameKnownUserAgent =
    !storedToken.user_agent ||
    !requestUserAgent ||
    storedToken.user_agent === requestUserAgent;

  return sameKnownIp && sameKnownUserAgent;
};

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

const getRequestOrigin = (req?: Request) => {
  if (!req) {
    return null;
  }

  const origin = req.headers.origin;
  return typeof origin === "string" && origin.trim() ? origin.trim() : null;
};

const hasCookieName = (req: Request, cookieName: string) =>
  getRequestCookies(req).has(cookieName);

const summarizeAuthCookieRequest = (req?: Request) => ({
  origin: getRequestOrigin(req),
  userAgent: resolveRequestUserAgent(req),
  host: req?.get("host") ?? null,
  forwardedProto:
    typeof req?.headers["x-forwarded-proto"] === "string"
      ? req.headers["x-forwarded-proto"]
      : null,
});

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

const getRequestCookies = (req: Request) => {
  if (!req.parsedCookies) {
    req.parsedCookies = parseCookies(req.headers.cookie);
  }

  return req.parsedCookies;
};

export const getCookieValue = (req: Request, cookieName: string) =>
  getRequestCookies(req).get(cookieName) ?? null;

const getCookieValueFromNames = (req: Request, cookieNames: string[]) => {
  const cookies = getRequestCookies(req);

  for (const cookieName of cookieNames) {
    const value = cookies.get(cookieName);
    if (value) {
      return value;
    }
  }

  return null;
};

const clearCookieNames = (
  req: Request | undefined,
  res: Response,
  cookieNames: string[],
  path = AUTH_COOKIE_ROOT_PATH,
) => {
  const cookieOptions = buildHttpOnlyCookieOptions(req, { path });

  cookieNames.forEach((cookieName) => {
    res.clearCookie(cookieName, cookieOptions);
  });
};

const setCookieNames = (
  req: Request | undefined,
  res: Response,
  cookieNames: string[],
  value: string,
  maxAge: number,
  path = AUTH_COOKIE_ROOT_PATH,
) => {
  const cookieOptions = buildHttpOnlyCookieOptions(req, { path, maxAge });

  cookieNames.forEach((cookieName) => {
    res.cookie(cookieName, value, cookieOptions);
  });

  logAuth("cookie_set", {
    names: cookieNames,
    path: cookieOptions.path,
    maxAge,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    httpOnly: cookieOptions.httpOnly,
    ...summarizeAuthCookieRequest(req),
  });
};

export const clearAuthCookies = (res: Response, req?: Request) => {
  clearCookieNames(
    req,
    res,
    [ACCESS_TOKEN_COOKIE_NAME, ACCESS_TOKEN_COOKIE_ALIAS],
    AUTH_COOKIE_ROOT_PATH,
  );
  clearCookieNames(
    req,
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    LEGACY_REFRESH_COOKIE_PATH,
  );
  clearCookieNames(
    req,
    res,
    [REFRESH_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_ALIAS],
    AUTH_COOKIE_ROOT_PATH,
  );
  clearCookieNames(req, res, LEGACY_FRAGMENTED_COOKIE_NAMES, AUTH_COOKIE_ROOT_PATH);
};

const setAccessCookie = (
  req: Request | undefined,
  res: Response,
  accessToken: string,
) => {
  setCookieNames(
    req,
    res,
    [ACCESS_TOKEN_COOKIE_ALIAS],
    accessToken,
    getAccessTokenMaxAgeMs(),
    AUTH_COOKIE_ROOT_PATH,
  );
};

const setRefreshCookie = (
  req: Request | undefined,
  res: Response,
  refreshToken: string,
) => {
  setCookieNames(
    req,
    res,
    [REFRESH_TOKEN_COOKIE_ALIAS],
    refreshToken,
    resolveAuthSessionPreferences({ rememberMe: true }).cookieMaxAgeMs,
    REFRESH_COOKIE_PATH,
  );
};

const signRefreshToken = (
  authUser: AuthUser,
  refreshTokenTtl: string,
  rememberMe: boolean,
) => {
  const unifiedRole = authUser.accountType === "WORKER" ? "worker" : "user";

  return jwt.sign(
    {
      ...authUser,
      id: authUser.id,
      email: authUser.email,
      role: unifiedRole,
      legacyRole: authUser.role,
      token_type: "refresh_v1",
      remember_me: rememberMe,
    },
    getRefreshTokenSecret(),
    {
      expiresIn: refreshTokenTtl as jwt.SignOptions["expiresIn"],
    },
  );
};

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
  setAccessCookie(req, res, accessToken);

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
      req,
      res,
      [REFRESH_TOKEN_COOKIE_ALIAS],
      refreshToken,
      sessionPreferences.refreshTokenMaxAgeMs,
      REFRESH_COOKIE_PATH,
    );
    logRefreshTableFallback({
      ownerUserId: authUser.ownerUserId,
      reason: preferences?.reason ?? "login",
    });
    logAuth("session_issued", {
      ownerUserId: authUser.ownerUserId,
      accountType: authUser.accountType,
      role: authUser.role,
      rememberMe: sessionPreferences.rememberMe,
      storage: "stateless_fallback",
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

        if (authUser.businessId) {
          void createNotification({
            userId: authUser.ownerUserId,
            businessId: authUser.businessId,
            type: "worker",
            message: `Suspicious sign-in detected from ${deviceName ?? "a new device"}.`,
            referenceKey: `suspicious-login:${authUser.ownerUserId}:${requestIp ?? "unknown"}:${new Date().toISOString().slice(0, 13)}`,
          });
        }
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
      req,
      res,
      [REFRESH_TOKEN_COOKIE_ALIAS],
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

  logAuth("session_issued", {
    ownerUserId: authUser.ownerUserId,
    accountType: authUser.accountType,
    role: authUser.role,
    rememberMe: sessionPreferences.rememberMe,
    storage: "refresh_table",
    reason: preferences?.reason ?? "login",
  });
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
  logAuth("refresh_cookie_received", {
    hasRefreshCookie:
      hasCookieName(req, REFRESH_TOKEN_COOKIE_NAME) ||
      hasCookieName(req, REFRESH_TOKEN_COOKIE_ALIAS),
    hasAccessCookie:
      hasCookieName(req, ACCESS_TOKEN_COOKIE_NAME) ||
      hasCookieName(req, ACCESS_TOKEN_COOKIE_ALIAS),
    ...summarizeAuthCookieRequest(req),
  });

  const refreshToken = getCookieValueFromNames(req, [
    REFRESH_TOKEN_COOKIE_NAME,
    REFRESH_TOKEN_COOKIE_ALIAS,
  ]);
  if (!refreshToken) {
    res.locals.authRefreshFailureReason = "missing_cookie";
    logAuth(
      "refresh_failed",
      { reason: "missing_cookie", ...summarizeAuthCookieRequest(req) },
      "warn",
    );
    return null;
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(
      refreshToken,
      getRefreshTokenSecret(),
    );
  } catch (error) {
    await revokeRefreshTokenByHash(refreshToken, "jwt_verify_failed");
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = "jwt_verify_failed";
    logAuth("refresh_failed", { reason: "jwt_verify_failed", message: (error as Error).message }, "warn");
    return null;
  }

  if (!decoded || typeof decoded === "string") {
    await revokeRefreshTokenByHash(refreshToken, "invalid_payload");
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = "invalid_payload";
    logAuth("refresh_failed", { reason: "invalid_payload" }, "warn");
    return null;
  }

  const tokenType =
    typeof decoded.token_type === "string" ? decoded.token_type : null;
  if (tokenType !== "refresh_v1") {
    await revokeRefreshTokenByHash(refreshToken, "unexpected_token_type");
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = "unexpected_token_type";
    logAuth("refresh_failed", { reason: "unexpected_token_type", tokenType }, "warn");
    return null;
  }

  const unifiedRole = normalizeUnifiedRole((decoded as Record<string, unknown>).role);
  if (unifiedRole === "admin" || unifiedRole === "super_admin") {
    const adminIdValue = (decoded as Record<string, unknown>).adminId ??
      (decoded as Record<string, unknown>).id;
    const adminId =
      typeof adminIdValue === "string" ? adminIdValue.trim() : "";
    const email =
      typeof (decoded as Record<string, unknown>).email === "string"
        ? ((decoded as Record<string, unknown>).email as string).trim()
        : "";

    if (!adminId || !email) {
      clearAuthCookies(res, req);
      res.locals.authRefreshFailureReason = "invalid_admin_payload";
      logAuth("refresh_failed", { reason: "invalid_admin_payload" }, "warn");
      return null;
    }

    const admin = await prismaUnsafe.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
      },
    });

    if (!admin || admin.email !== email) {
      clearAuthCookies(res, req);
      res.locals.authRefreshFailureReason = "admin_resolution_failed";
      logAuth("refresh_failed", { reason: "admin_resolution_failed" }, "warn");
      return null;
    }

    const issued = issueUnifiedAdminCookies(req, res, {
      id: admin.id,
      email: admin.email,
      role: unifiedRole,
    });

    logAuth("refresh_success", {
      adminId: admin.id,
      role: unifiedRole,
      storage: "unified_admin_cookie",
    });

    return {
      authUser: {
        id: 0,
        ownerUserId: 0,
        actorId: `${unifiedRole}:${admin.id}`,
        businessId: "",
        sessionVersion: 0,
        latestSessionVersion: null,
        isEmailVerified: true,
        role: "ADMIN",
        accountType: "OWNER",
        name: admin.email,
        email: admin.email,
      } as AuthUser,
      accessToken: issued.accessToken,
      accessTokenExpiresAt: issued.accessTokenExpiresAt,
      sessionExpiresAt: issued.sessionExpiresAt,
      rememberMe: true,
    };
  }

  const authUser = await resolveAuthUserFromDecoded(decoded);
  if (!authUser) {
    await revokeRefreshTokenByHash(refreshToken, "auth_user_resolution_failed");
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = "auth_user_resolution_failed";
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
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = "session_version_mismatch";
    logAuth(
      "auth.reject",
      {
        reason: "session_version_mismatch",
        userId: authUser.ownerUserId,
        tokenVersion: authUser.sessionVersion,
        dbVersion: latestSessionVersion,
        flow: "refresh",
      },
      "warn",
    );
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
    if (isRecentlyRotatedRefreshToken(storedToken, req)) {
      const issued = await issueAuthCookies(req, res, authUser, {
        rememberMe,
        reason: "refresh_race_grace",
      });

      logAuth("refresh_rotated_token_grace", {
        ownerUserId: authUser.ownerUserId,
        accountType: authUser.accountType,
        role: authUser.role,
        tokenId: storedToken.id,
        graceMs: REFRESH_ROTATION_GRACE_MS,
      });

      return {
        authUser,
        accessToken: issued.accessToken,
        accessTokenExpiresAt: issued.accessTokenExpiresAt,
        sessionExpiresAt: issued.sessionExpiresAt,
        rememberMe: issued.rememberMe,
      };
    }

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
    clearAuthCookies(res, req);
    res.locals.authRefreshFailureReason = failureReason;
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

  return {
    headerToken,
    cookieToken: getCookieValueFromNames(req, [
      ACCESS_TOKEN_COOKIE_NAME,
      ACCESS_TOKEN_COOKIE_ALIAS,
    ]),
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

const normalizeUnifiedRole = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "user" ||
    normalized === "worker" ||
    normalized === "admin" ||
    normalized === "super_admin"
    ? normalized
    : null;
};

export const signUnifiedAdminAccessToken = (admin: {
  id: string;
  email: string;
  role: "admin" | "super_admin";
}) =>
  jwt.sign(
    {
      id: admin.id,
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      token_type: "access_v2",
    },
    getAccessTokenSecret(),
    {
      expiresIn: getAccessTokenTtl() as jwt.SignOptions["expiresIn"],
    },
  );

export const signUnifiedAdminRefreshToken = (
  admin: {
    id: string;
    email: string;
    role: "admin" | "super_admin";
  },
  rememberMe = true,
) =>
  jwt.sign(
    {
      id: admin.id,
      adminId: admin.id,
      email: admin.email,
      role: admin.role,
      token_type: "refresh_v1",
      remember_me: rememberMe,
    },
    getRefreshTokenSecret(),
    {
      expiresIn: getRememberMeSessionTtl() as jwt.SignOptions["expiresIn"],
    },
  );

export const issueUnifiedAdminCookies = (
  req: Request | undefined,
  res: Response,
  admin: {
    id: string;
    email: string;
    role: "admin" | "super_admin";
  },
) => {
  const accessToken = signUnifiedAdminAccessToken(admin);
  const refreshToken = signUnifiedAdminRefreshToken(admin);
  const sessionPreferences = resolveAuthSessionPreferences({ rememberMe: true });

  setCookieNames(
    req,
    res,
    [ACCESS_TOKEN_COOKIE_ALIAS],
    accessToken,
    getAccessTokenMaxAgeMs(),
    AUTH_COOKIE_ROOT_PATH,
  );
  setCookieNames(
    req,
    res,
    [REFRESH_TOKEN_COOKIE_ALIAS],
    refreshToken,
    sessionPreferences.refreshTokenMaxAgeMs,
    AUTH_COOKIE_ROOT_PATH,
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: getAccessTokenExpiresAt(),
    sessionExpiresAt: sessionPreferences.sessionExpiresAt,
  };
};
