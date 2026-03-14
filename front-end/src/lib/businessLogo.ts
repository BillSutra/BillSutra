/**
 * Centralized utility for managing the business logo in localStorage.
 *
 * All components should use these helpers (or the `useBusinessLogo` hook)
 * instead of accessing localStorage directly.  This keeps the storage key,
 * validation, and cross-component notification logic in a single place.
 *
 * Storage format: the logo is stored as a Base64-encoded data-URL string
 * (e.g. "data:image/png;base64,iVBOR…").
 */

/** localStorage key used to persist the business logo. */
export const BUSINESS_LOGO_KEY = "business_logo" as const;

/**
 * Custom event name dispatched on `window` whenever the logo changes.
 * Listening for this event allows same-tab components to react immediately
 * (the native `storage` event only fires in *other* tabs).
 */
export const BUSINESS_LOGO_CHANGE_EVENT = "business-logo-change" as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Retrieve the stored business logo (Base64 data-URL) or `null`. */
export const getBusinessLogo = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUSINESS_LOGO_KEY);
};

/** Persist a Base64 data-URL logo and notify all listeners. */
export const setBusinessLogo = (base64Logo: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUSINESS_LOGO_KEY, base64Logo);
  window.dispatchEvent(new CustomEvent(BUSINESS_LOGO_CHANGE_EVENT));
};

/** Remove the stored logo and notify all listeners. */
export const removeBusinessLogo = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUSINESS_LOGO_KEY);
  window.dispatchEvent(new CustomEvent(BUSINESS_LOGO_CHANGE_EVENT));
};
