import Env from "./env";
import { API_URL } from "./apiEndPoints";

export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";
export const SECURE_AUTH_BOOTSTRAPPED_KEY = "bill_sutra_secure_auth_bootstrapped";
export const SECURE_AUTH_EXPIRES_AT_KEY = "bill_sutra_secure_auth_expires_at";
export const AUTH_LOGOUT_EVENT = "billsutra:auth-logout";

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
};

export const isSecureAuthEnabled = () => Env.USE_SECURE_AUTH === "true";
export const isCookieAuthEnabled = isSecureAuthEnabled;
export const isCookieOnlyAuthEnabled = () => Env.USE_COOKIE_AUTH === "true";

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

export const clearClientAuthState = () => {
  clearLegacyStoredToken();
  clearSecureAuthBootstrapped();
  clearSecureAuthExpiresAt();
};

export const requestClientLogout = (reason = "session_expired") => {
  if (typeof window === "undefined") {
    return;
  }

  clearClientAuthState();
  window.dispatchEvent(
    new CustomEvent(AUTH_LOGOUT_EVENT, {
      detail: { reason },
    }),
  );
};

export const bootstrapSecureAuthSession = async (rawToken: string) => {
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
        Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return false;
    }

    const payload = (await response.json().catch(() => null)) as
      | { data?: { expiresAt?: number | null } }
      | null;

    setSecureAuthExpiresAt(
      typeof payload?.data?.expiresAt === "number"
        ? payload.data.expiresAt
        : null,
    );
    markSecureAuthBootstrapped();
    return true;
  } catch {
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

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        return {
          ok: false,
          reason:
            response.status === 401 || response.status === 403
              ? "auth_invalid"
              : "server_error",
          status: response.status,
        };
      }

      const payload = (await response.json().catch(() => null)) as
        | { data?: { expiresAt?: number | null } }
        | null;

      const expiresAt =
        typeof payload?.data?.expiresAt === "number"
          ? payload.data.expiresAt
          : null;

      setSecureAuthExpiresAt(expiresAt);
      markSecureAuthBootstrapped();
      return {
        ok: true,
        reason: "success",
        expiresAt,
        status: response.status,
      };
    } catch {
      return {
        ok: false,
        reason: "network_error",
      };
    }
  };

export const refreshSecureAuthSession = async () =>
  (await refreshSecureAuthSessionDetailed()).ok;
