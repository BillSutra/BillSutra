/**
 * Reactive hook for the business logo stored in localStorage.
 *
 * Returns `{ logo, setLogo, removeLogo }`.
 *
 * The hook automatically re-renders when:
 *  - The logo changes in the *same* tab  (via the custom `business-logo-change` event)
 *  - The logo changes in *another* tab    (via the native `storage` event)
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BUSINESS_LOGO_CHANGE_EVENT,
  BUSINESS_LOGO_KEY,
  getBusinessLogo,
  removeBusinessLogo,
  setBusinessLogo,
} from "@/lib/businessLogo";

export const useBusinessLogo = () => {
  const [logo, setLogoState] = useState<string | null>(null);

  // Read the current value from localStorage on mount (client-only).
  useEffect(() => {
    setLogoState(getBusinessLogo());
  }, []);

  // Subscribe to changes from the same tab (custom event) and other tabs (storage event).
  useEffect(() => {
    const sync = () => setLogoState(getBusinessLogo());

    // Same-tab updates dispatched by setBusinessLogo / removeBusinessLogo
    window.addEventListener(BUSINESS_LOGO_CHANGE_EVENT, sync);

    // Cross-tab updates via native Storage API
    const handleStorage = (e: StorageEvent) => {
      if (e.key === BUSINESS_LOGO_KEY) sync();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(BUSINESS_LOGO_CHANGE_EVENT, sync);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  /** Persist a new Base64 logo and trigger UI updates across the app. */
  const setLogo = useCallback((base64Logo: string) => {
    setBusinessLogo(base64Logo);
    // Also update local state immediately for the calling component.
    setLogoState(base64Logo);
  }, []);

  /** Remove the stored logo and trigger UI updates across the app. */
  const removeLogo = useCallback(() => {
    removeBusinessLogo();
    setLogoState(null);
  }, []);

  return { logo, setLogo, removeLogo } as const;
};
