const DEFAULT_BACKEND_URL = "http://localhost:7000";

let validated = false;

const normalizeString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeBackendUrl = (rawValue?: string | null): string => {
  const trimmed = normalizeString(rawValue);

  if (!trimmed) {
    return DEFAULT_BACKEND_URL;
  }

  const stripApiSuffix = (value: string) =>
    value.replace(/\/api\/?$/i, "");

  if (/^:\d+$/.test(trimmed)) {
    return `http://localhost${stripApiSuffix(trimmed)}`;
  }

  if (/^\d+$/.test(trimmed)) {
    return `http://localhost:${trimmed}`;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.pathname = stripApiSuffix(parsed.pathname || "/") || "/";
      parsed.search = "";
      parsed.hash = "";
      return stripTrailingSlash(parsed.toString());
    } catch {
      return stripTrailingSlash(stripApiSuffix(trimmed));
    }
  }

  if (/^[a-z0-9.-]+:\d+(\/api)?$/i.test(trimmed)) {
    return `http://${stripApiSuffix(trimmed)}`;
  }

  return stripTrailingSlash(stripApiSuffix(trimmed));
};

const getRawBackendUrl = () =>
  normalizeString(
    process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL,
  );

const isValidUrl = (value: string | null) => {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const resolveFrontendBackendUrl = () =>
  normalizeBackendUrl(getRawBackendUrl());

export const validateFrontendEnv = () => {
  if (typeof window !== "undefined" || validated) {
    return;
  }

  validated = true;

  const isProd = process.env.NODE_ENV === "production";
  const nextAuthSecret = normalizeString(process.env.NEXTAUTH_SECRET);
  const nextAuthUrl = normalizeString(process.env.NEXTAUTH_URL);
  const appUrl = normalizeString(process.env.NEXT_PUBLIC_APP_URL);
  const backendSource = getRawBackendUrl();
  const backendUrl = resolveFrontendBackendUrl();
  const googleClientId = normalizeString(process.env.GOOGLE_CLIENT_ID);
  const googleClientSecret = normalizeString(process.env.GOOGLE_CLIENT_SECRET);

  if (!nextAuthSecret) {
    throw new Error("NEXTAUTH_SECRET is required.");
  }

  if (nextAuthSecret.length < 32) {
    throw new Error("NEXTAUTH_SECRET must be at least 32 characters long.");
  }

  if (isProd && !nextAuthUrl) {
    throw new Error("NEXTAUTH_URL is required in production.");
  }

  if (nextAuthUrl && !isValidUrl(nextAuthUrl)) {
    throw new Error("NEXTAUTH_URL must be a valid absolute URL.");
  }

  if (isProd && !backendSource) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL or NEXT_PUBLIC_API_URL is required in production.",
    );
  }

  if (backendSource && !isValidUrl(backendUrl)) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL/NEXT_PUBLIC_API_URL must resolve to a valid absolute URL.",
    );
  }

  if ((googleClientId && !googleClientSecret) || (!googleClientId && googleClientSecret)) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together.",
    );
  }
};
