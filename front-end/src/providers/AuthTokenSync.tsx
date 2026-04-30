"use client";

import React, { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  bootstrapSecureAuthSession,
  clearLegacyStoredToken,
  clearPendingRememberMePreference,
  clearSecureAuthBootstrapped,
  ensureFreshSecureAuthSessionDetailed,
  getPendingRememberMePreference,
  hasSecureAuthBootstrap,
  isSecureAuthSessionExpired,
  isSecureAuthEnabled,
  normalizeAuthToken,
  requestClientLogout,
} from "@/lib/secureAuth";

type SessionUserWithToken = {
  token?: string;
};

const AuthTokenSync = () => {
  const { data, status } = useSession();
  const bootstrappingTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      clearLegacyStoredToken();
      clearSecureAuthBootstrapped();
      return;
    }

    if (!isSecureAuthEnabled()) {
      return;
    }

    const token = normalizeAuthToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );
    const requiresBootstrap =
      !hasSecureAuthBootstrap() || isSecureAuthSessionExpired(Date.now() + 60_000);

    if (!requiresBootstrap) {
      return;
    }

    let cancelled = false;

    const syncAuthSession = async () => {
      if (token && !hasSecureAuthBootstrap()) {
        if (bootstrappingTokenRef.current !== token) {
          bootstrappingTokenRef.current = token;

          try {
            const bootstrapped = await bootstrapSecureAuthSession(token, {
              rememberMe: getPendingRememberMePreference(),
            });
            if (bootstrapped || cancelled) {
              return;
            }

            return;
          } finally {
            if (!cancelled) {
              bootstrappingTokenRef.current = null;
            }
          }
        } else {
          return;
        }
      }

      const refreshResult = await ensureFreshSecureAuthSessionDetailed({
        force: true,
        minValidityMs: 0,
      });

      if (!cancelled && !refreshResult.ok && refreshResult.reason === "auth_invalid") {
        clearPendingRememberMePreference();
        requestClientLogout("401_refresh_failed");
      }
    };

    void syncAuthSession();

    return () => {
      cancelled = true;
    };
  }, [data?.user, status]);

  return null;
};

export default AuthTokenSync;
