"use client";

import {
  ADMIN_TOKEN_COOKIE_KEY,
  ADMIN_TOKEN_STORAGE_KEY,
} from "./adminAuthShared";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export const getStoredAdminToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
};

export const persistAdminToken = (token: string) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  document.cookie = `${ADMIN_TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
};

export const clearAdminToken = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  document.cookie = `${ADMIN_TOKEN_COOKIE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
};
