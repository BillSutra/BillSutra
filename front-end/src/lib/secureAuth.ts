import Env from "./env";

export const LEGACY_AUTH_TOKEN_STORAGE_KEY = "token";
export const SECURE_AUTH_BOOTSTRAPPED_KEY = "bill_sutra_secure_auth_bootstrapped";

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
  if (typeof window === "undefined") {
    return;
  }

  // Transitional helper for legacy-session fallback only.
  window.localStorage.setItem(LEGACY_AUTH_TOKEN_STORAGE_KEY, token);
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
