"use client";

import { ADMIN_TOKEN_STORAGE_KEY } from "./adminAuthShared";

const decodeJwtPayload = (token: string) => {
  const normalized = token.startsWith("Bearer ")
    ? token.slice("Bearer ".length)
    : token;
  const segments = normalized.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = window.atob(padded);
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
};

const isExpiredAdminToken = (token: string) => {
  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === "number" && payload.exp * 1000 <= Date.now();
};

export const getStoredAdminToken = () => {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  if (!token) {
    return null;
  }

  if (isExpiredAdminToken(token)) {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    return null;
  }

  return token;
};

export const persistAdminToken = (_token: string) => {
  // Intentionally no-op during the migration to HttpOnly cookie-based admin
  // auth. We keep legacy reads temporarily so existing sessions survive, but
  // we no longer write any new admin token into JS-readable storage.
};

export const clearAdminToken = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
};
