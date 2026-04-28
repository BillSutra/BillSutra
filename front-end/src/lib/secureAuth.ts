import Env from "./env";
import { API_URL } from "./apiEndPoints";

export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";
export const SECURE_AUTH_BOOTSTRAPPED_KEY = "bill_sutra_secure_auth_bootstrapped";
export const SECURE_AUTH_EXPIRES_AT_KEY = "bill_sutra_secure_auth_expires_at";
export const PENDING_REMEMBER_ME_KEY = "bill_sutra_pending_remember_me";
export const AUTH_LOGOUT_EVENT = "billsutra:auth-logout";

const ACCESS_TOKEN_REFRESH_LEAD_MS = 60_000;
const LOGOUT_DEDUPE_WINDOW_MS = 5_000;

let refreshRequestInFlight: Promise<SecureAuthRefreshResult> | null = null;
let lastLogoutRequestAt = 0;
let lastLogoutReason: string | null = null;
let inMemoryAccessToken: string | null = null;

export type SecureAuthRefreshResult = {
  ok: boolean;
  reason:
    | "success"
    | "disabled"
    | "auth_invalid"
    | "server_error"
    | "network_error";
  expiresAt?: number | null;
  status?: number;
  token?: string | null;
};

type AuthLogLevel = "info" | "warn";

export const isSecureAuthEnabled = () => Env.USE_SECURE_AUTH === "true";
export const isCookieAuthEnabled = isSecureAuthEnabled;
export const isCookieOnlyAuthEnabled = () => Env.USE_COOKIE_AUTH === "true";

export const logClientAuthEvent = (
  message: string,
  detail?: Record<string, unknown>,
  level: AuthLogLevel = "info",
) => {
  if (typeof window === "undefined") {
    return;
  }

  const logger = level === "warn" ? console.warn : console.info;
  logger(`[auth] ${message}`, detail ?? {});
};

export const logIgnoredNetworkFailure = (
  context: string,
  detail?: Record<string, unknown>,
) => {
  logClientAuthEvent("ignored_network_failure", { context, ...detail });
};

export const normalizeAuthToken = (rawToken: string | null | undefined) => {
  if (!rawToken) return null;
  const token = rawToken.trim();
  if (!token) return null;
  if (token === "undefined" || token === "null") return null;
  if (token === "Bearer undefined" || token === "Bearer null") return null;
  return token;
};

const stripBearerPrefix = (rawToken: string) =>
  rawToken.startsWith("Bearer ") ? rawToken.slice("Bearer ".length) : rawToken;

const decodeJwtPayload = (rawToken: string) => {
  const token = stripBearerPrefix(rawToken);
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json =
      typeof window !== "undefined"
        ? window.atob(padded)
        : Buffer.from(padded, "base64").toString("utf-8");

    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
};

export const getAuthTokenExpiry = (rawToken: string | null | undefined) => {
  const token = normalizeAuthToken(rawToken);
  if (!token) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
};

export const isAuthTokenExpired = (
  rawToken: string | null | undefined,
  now = Date.now(),
) => {
  const expiresAt = getAuthTokenExpiry(rawToken);
  return expiresAt !== null && expiresAt <= now;
};

export const getMsUntilAuthTokenExpiry = (
  rawToken: string | null | undefined,
  now = Date.now(),
) => {
  const expiresAt = getAuthTokenExpiry(rawToken);
  return expiresAt === null ? null : Math.max(0, expiresAt - now);
};

export const getLegacyStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  if (isCookieOnlyAuthEnabled()) {
    return null;
  }

  return normalizeAuthToken(
    window.localStorage.getItem(LEGACY_AUTH_TOKEN_STORAGE_KEY),
  );
};

export const setLegacyStoredToken = (token: string) => {
  void token;
  if (typeof window === "undefined") {
    return;
  }

  // New sessions rely on HttpOnly cookies + NextAuth session state.
  // We intentionally stop writing fresh access tokens into localStorage,
  // while continuing to read old tokens during the migration window.
};

export const clearLegacyStoredToken = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_STORAGE_KEY);
};

export const hasSecureAuthBootstrap = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(SECURE_AUTH_BOOTSTRAPPED_KEY) === "1";
};

export const markSecureAuthBootstrapped = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SECURE_AUTH_BOOTSTRAPPED_KEY, "1");
};

export const clearSecureAuthBootstrapped = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SECURE_AUTH_BOOTSTRAPPED_KEY);
};

export const getSecureAuthExpiresAt = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(SECURE_AUTH_EXPIRES_AT_KEY);
  if (!rawValue) {
    return null;
  }

  const value = Number.parseInt(rawValue, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const setSecureAuthExpiresAt = (expiresAt: number | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!expiresAt || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    window.localStorage.removeItem(SECURE_AUTH_EXPIRES_AT_KEY);
    return;
  }

  window.localStorage.setItem(SECURE_AUTH_EXPIRES_AT_KEY, String(expiresAt));
};

export const clearSecureAuthExpiresAt = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SECURE_AUTH_EXPIRES_AT_KEY);
};

export const isSecureAuthSessionExpired = (now = Date.now()) => {
  const expiresAt = getSecureAuthExpiresAt();
  return expiresAt !== null && expiresAt <= now;
};

export const getPendingRememberMePreference = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(PENDING_REMEMBER_ME_KEY);
  if (rawValue === "1") {
    return true;
  }

  if (rawValue === "0") {
    return false;
  }

  return null;
};

export const setPendingRememberMePreference = (rememberMe: boolean) => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PENDING_REMEMBER_ME_KEY, rememberMe ? "1" : "0");
};

export const clearPendingRememberMePreference = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_REMEMBER_ME_KEY);
};

export const getInMemoryAccessToken = () => inMemoryAccessToken;

const setInMemoryAccessToken = (token: string | null | undefined) => {
  inMemoryAccessToken = normalizeAuthToken(token);
};

export const getSecureAuthAccessToken = () =>
  getInMemoryAccessToken() ?? getLegacyStoredToken();

const shouldRefreshSecureAuthSession = (minValidityMs = ACCESS_TOKEN_REFRESH_LEAD_MS) => {
  if (!hasSecureAuthBootstrap()) {
    return true;
  }

  const expiresAt = getSecureAuthExpiresAt();
  if (!expiresAt) {
    return true;
  }

  return expiresAt - Date.now() <= minValidityMs;
};

export const clearClientAuthState = () => {
  setInMemoryAccessToken(null);
  clearLegacyStoredToken();
  clearPendingRememberMePreference();
  clearSecureAuthBootstrapped();
  clearSecureAuthExpiresAt();
};

export const requestClientLogout = (reason = "session_expired") => {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  if (
    lastLogoutReason === reason &&
    now - lastLogoutRequestAt < LOGOUT_DEDUPE_WINDOW_MS
  ) {
    logClientAuthEvent("logout_request_deduped", { reason });
    return;
  }

  lastLogoutReason = reason;
  lastLogoutRequestAt = now;

  clearClientAuthState();
  logClientAuthEvent(`logout_reason=${reason}`);
  window.dispatchEvent(
    new CustomEvent(AUTH_LOGOUT_EVENT, {
      detail: { reason },
    }),
  );
};

export const bootstrapSecureAuthSession = async (
  rawToken: string,
  options?: {
    rememberMe?: boolean | null;
  },
) => {
  if (typeof window === "undefined" || !isSecureAuthEnabled()) {
    return false;
  }

  const token = normalizeAuthToken(rawToken);
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/auth/session/bootstrap`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
      body:
        typeof options?.rememberMe === "boolean"
          ? JSON.stringify({ rememberMe: options.rememberMe })
          : undefined,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setInMemoryAccessToken(null);
      }
      if (response.status >= 500) {
        logIgnoredNetworkFailure("auth_session_bootstrap", {
          status: response.status,
        });
      }
      return false;
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: { token?: string | null; expiresAt?: number | null } }
      | null;

    setInMemoryAccessToken(payload?.data?.token ?? token);
    setSecureAuthExpiresAt(
      typeof payload?.data?.expiresAt === "number"
        ? payload.data.expiresAt
        : null,
    );
    markSecureAuthBootstrapped();
    if (typeof options?.rememberMe === "boolean") {
      clearPendingRememberMePreference();
    }
    lastLogoutReason = null;
    lastLogoutRequestAt = 0;
    return true;
  } catch {
    logIgnoredNetworkFailure("auth_session_bootstrap", {
      reason: "network_error",
    });
    return false;
  }
};

export const refreshSecureAuthSessionDetailed =
  async (): Promise<SecureAuthRefreshResult> => {
    if (typeof window === "undefined" || !isSecureAuthEnabled()) {
      return {
        ok: false,
        reason: "disabled",
      };
    }

    if (!refreshRequestInFlight) {
      refreshRequestInFlight = (async () => {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });

          if (!response.ok) {
            const reason =
              response.status === 401 || response.status === 403
                ? "auth_invalid"
                : "server_error";

            if (reason === "auth_invalid") {
              setInMemoryAccessToken(null);
            }
            if (reason !== "auth_invalid") {
              logIgnoredNetworkFailure("auth_refresh", {
                status: response.status,
              });
            }

            return {
              ok: false,
              reason,
              status: response.status,
            } satisfies SecureAuthRefreshResult;
          }

          const payload = (await response.json().catch(() => null)) as
            | { data?: { token?: string | null; expiresAt?: number | null } }
            | null;

          const expiresAt =
            typeof payload?.data?.expiresAt === "number"
              ? payload.data.expiresAt
              : null;
          const token = normalizeAuthToken(payload?.data?.token ?? null);

          setInMemoryAccessToken(token);
          setSecureAuthExpiresAt(expiresAt);
          markSecureAuthBootstrapped();
          lastLogoutReason = null;
          lastLogoutRequestAt = 0;
          return {
            ok: true,
            reason: "success",
            expiresAt,
            status: response.status,
            token,
          } satisfies SecureAuthRefreshResult;
        } catch {
          logIgnoredNetworkFailure("auth_refresh", {
            reason: "network_error",
          });
          return {
            ok: false,
            reason: "network_error",
          } satisfies SecureAuthRefreshResult;
        } finally {
          refreshRequestInFlight = null;
        }
      })();
    }

    return refreshRequestInFlight;
  };

export const ensureFreshSecureAuthSessionDetailed = async (options?: {
  force?: boolean;
  minValidityMs?: number;
}): Promise<SecureAuthRefreshResult> => {
  if (typeof window === "undefined" || !isSecureAuthEnabled()) {
    return {
      ok: false,
      reason: "disabled",
    };
  }

  const minValidityMs = options?.minValidityMs ?? ACCESS_TOKEN_REFRESH_LEAD_MS;
  if (!options?.force && !shouldRefreshSecureAuthSession(minValidityMs)) {
    return {
      ok: true,
      reason: "success",
      expiresAt: getSecureAuthExpiresAt(),
      token: getSecureAuthAccessToken(),
    };
  }

  return refreshSecureAuthSessionDetailed();
};

export const refreshSecureAuthSession = async () =>
  (await refreshSecureAuthSessionDetailed()).ok;
