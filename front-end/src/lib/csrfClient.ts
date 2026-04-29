import { API_URL } from "./apiEndPoints";

export const CSRF_COOKIE_NAME = "bill_sutra_csrf_token";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const getBrowserCookieValue = (cookieName: string) => {
  if (typeof document === "undefined") {
    return null;
  }

  const encodedName = `${cookieName}=`;
  const matchedCookie = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(encodedName));

  if (!matchedCookie) {
    return null;
  }

  return decodeURIComponent(matchedCookie.slice(encodedName.length));
};

export const getBrowserCsrfToken = () =>
  getBrowserCookieValue(CSRF_COOKIE_NAME);

export const ensureBrowserCsrfToken = async () => {
  const existingToken = getBrowserCsrfToken();
  if (existingToken) {
    return existingToken;
  }

  const response = await fetch(`${API_URL}/auth/csrf`, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return getBrowserCsrfToken();
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { csrfToken?: string | null } }
    | null;

  return payload?.data?.csrfToken ?? getBrowserCsrfToken();
};

export const buildCsrfHeadersIfAvailable = () => {
  const csrfToken = getBrowserCsrfToken();
  if (!csrfToken) {
    return {} as Record<string, string>;
  }

  return {
    [CSRF_HEADER_NAME]: csrfToken,
  } satisfies Record<string, string>;
};

export const buildRequiredCsrfHeaders = async () => {
  const csrfToken = await ensureBrowserCsrfToken();
  if (!csrfToken) {
    return {} as Record<string, string>;
  }

  return {
    [CSRF_HEADER_NAME]: csrfToken,
  } satisfies Record<string, string>;
};

export const isSafeHttpMethod = (method?: string | null) =>
  SAFE_METHODS.has((method ?? "GET").toUpperCase());
