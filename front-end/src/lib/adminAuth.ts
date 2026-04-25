"use client";

import { ADMIN_TOKEN_STORAGE_KEY } from "./adminAuthShared";

export const getStoredAdminToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
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
