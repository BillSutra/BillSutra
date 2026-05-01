export const ADMIN_SESSION_COOKIE_KEY = "bill_sutra_admin_session";
export const ADMIN_REFRESH_COOKIE_KEY = "bill_sutra_admin_refresh";
export const ADMIN_TOKEN_STORAGE_KEY = "bill_sutra_super_admin_token";
export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  if (typeof atob === "function") {
    return atob(padded);
  }

  return Buffer.from(padded, "base64").toString("utf8");
};

export const decodeAdminTokenPayload = (token: string | null | undefined) => {
  if (!token) return null;

  const normalizedToken = token.startsWith("Bearer ")
    ? token.slice("Bearer ".length)
    : token;

  const parts = normalizedToken.split(".");
  if (parts.length < 2) return null;

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getAdminRoleFromToken = (token: string | null | undefined) => {
  const payload = decodeAdminTokenPayload(token);
  return payload?.role === SUPER_ADMIN_ROLE ? SUPER_ADMIN_ROLE : null;
};
