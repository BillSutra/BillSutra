import crypto from "crypto";
import type { Request, Response } from "express";
import { parseCookies } from "./authCookies.js";

export const CSRF_COOKIE_NAME = "bill_sutra_csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_TOKEN_MIN_LENGTH = 24;

const isProd = process.env.NODE_ENV === "production";

const resolveSameSite = () => {
  const configuredValue = (
    process.env.CSRF_COOKIE_SAMESITE ??
    process.env.AUTH_COOKIE_SAMESITE ??
    ""
  )
    .trim()
    .toLowerCase();

  if (
    configuredValue === "lax" ||
    configuredValue === "strict" ||
    configuredValue === "none"
  ) {
    return configuredValue as "lax" | "strict" | "none";
  }

  return "strict" as const;
};

const CSRF_COOKIE_SAMESITE = resolveSameSite();

export const createCsrfToken = () =>
  crypto.randomBytes(CSRF_TOKEN_MIN_LENGTH).toString("base64url");

export const hasValidCsrfToken = (token: string | null | undefined) =>
  typeof token === "string" && token.trim().length >= CSRF_TOKEN_MIN_LENGTH;

export const readCsrfCookieToken = (req: Request) =>
  parseCookies(req.headers.cookie).get(CSRF_COOKIE_NAME) ?? "";

export const readCsrfHeaderToken = (req: Request) => {
  const rawHeader = req.headers[CSRF_HEADER_NAME];
  if (typeof rawHeader === "string") {
    return rawHeader.trim();
  }

  if (Array.isArray(rawHeader)) {
    return rawHeader[0]?.trim() ?? "";
  }

  return "";
};

export const setCsrfCookie = (res: Response, token: string) => {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: CSRF_COOKIE_SAMESITE,
    path: "/",
  });
};

export const resolveOrSetCsrfToken = (req: Request, res: Response) => {
  const existingToken = readCsrfCookieToken(req);
  if (hasValidCsrfToken(existingToken)) {
    return existingToken;
  }

  const nextToken = createCsrfToken();
  setCsrfCookie(res, nextToken);
  return nextToken;
};
