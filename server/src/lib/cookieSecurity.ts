import type { Request } from "express";

type CookieSameSite = "lax" | "strict" | "none";

const normalizeHost = (value: string | null | undefined) =>
  value?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";

const isLoopbackHost = (host: string) =>
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "::1" ||
  host.endsWith(".localhost");

const resolveForwardedProto = (req?: Request) => {
  if (!req) {
    return null;
  }

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (typeof forwardedProto === "string" && forwardedProto.trim()) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() ?? null;
  }

  if (Array.isArray(forwardedProto) && forwardedProto[0]) {
    return forwardedProto[0].trim().toLowerCase();
  }

  return null;
};

const isSecureTransport = (req?: Request) => {
  if (!req) {
    return false;
  }

  if (req.secure) {
    return true;
  }

  return resolveForwardedProto(req) === "https";
};

export const resolveCookieSecure = (req?: Request) => {
  const configuredValue = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (configuredValue === "true") {
    return true;
  }

  if (configuredValue === "false") {
    return false;
  }

  const requestHost = normalizeHost(req?.get("host") ?? req?.hostname);
  if (requestHost && isLoopbackHost(requestHost)) {
    return false;
  }

  if (isSecureTransport(req)) {
    return true;
  }

  const frontendUrl =
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    process.env.CLIENT_URL ??
    "";

  return /^https:\/\//i.test(frontendUrl.trim());
};

export const resolveCookieSameSite = (req?: Request): CookieSameSite => {
  const configuredValue = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();

  if (configuredValue === "strict") {
    return "strict";
  }

  if (configuredValue === "none") {
    return resolveCookieSecure(req) ? "none" : "lax";
  }

  if (configuredValue === "lax") {
    return "lax";
  }

  return "lax";
};

export const buildHttpOnlyCookieOptions = (
  req: Request | undefined,
  options?: {
    path?: string;
    maxAge?: number;
  },
) => {
  const resolved = {
    httpOnly: true,
    secure: resolveCookieSecure(req),
    sameSite: resolveCookieSameSite(req),
    path: options?.path ?? "/",
  } as const;

  if (typeof options?.maxAge === "number") {
    return {
      ...resolved,
      maxAge: options.maxAge,
    };
  }

  return resolved;
};
