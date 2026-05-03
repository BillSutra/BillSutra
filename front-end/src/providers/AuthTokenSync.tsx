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
  isAuthLoginInProgress,
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
      if (isAuthLoginInProgress()) {
        return;
      }

      clearLegacyStoredToken();
      clearSecureAuthBootstrapped();
      return;
    }

    const secureAuthEnabled = isSecureAuthEnabled();
    const token = normalizeAuthToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );
    const requiresBootstrap =
      secureAuthEnabled
        ? !hasSecureAuthBootstrap() ||
          isSecureAuthSessionExpired(Date.now() + 60_000)
        : Boolean(token);

    if (!requiresBootstrap) {
      return;
    }

    let cancelled = false;

    const syncAuthSession = async () => {
      if (token && (!secureAuthEnabled || !hasSecureAuthBootstrap())) {
        if (bootstrappingTokenRef.current !== token) {
          bootstrappingTokenRef.current = token;

          try {
            const bootstrapped = await bootstrapSecureAuthSession(token, {
              rememberMe: getPendingRememberMePreference(),
              allowWhenSecureAuthDisabled: true,
            });
            if (bootstrapped || cancelled || !secureAuthEnabled) {
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

      if (
        !cancelled &&
        !isAuthLoginInProgress() &&
        !refreshResult.ok &&
        refreshResult.reason === "auth_invalid"
      ) {
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
