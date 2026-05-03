"use client";

import { ADMIN_TOKEN_STORAGE_KEY } from "./adminAuthShared";

export const getStoredAdminToken = (): string | null => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }

  return null;
};

export const persistAdminToken = () => {
  // Intentionally no-op during the migration to HttpOnly cookie-based admin
  // auth. We keep legacy reads temporarily so existing sessions survive, but
  // we no longer write any new admin token into JS-readable storage.
};

export const clearAdminToken = () => {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
};
