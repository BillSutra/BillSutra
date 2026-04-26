"use client";

import React, { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  bootstrapSecureAuthSession,
  clearLegacyStoredToken,
  clearSecureAuthBootstrapped,
  hasSecureAuthBootstrap,
  isAuthTokenExpired,
  isSecureAuthEnabled,
  normalizeAuthToken,
  refreshSecureAuthSession,
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

    const token = normalizeAuthToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );

    if (!token) {
      if (status === "unauthenticated") {
        clearLegacyStoredToken();
        clearSecureAuthBootstrapped();
      }
      return;
    }

    if (isAuthTokenExpired(token)) {
      if (!isSecureAuthEnabled()) {
        requestClientLogout("token_expired");
        return;
      }

      if (hasSecureAuthBootstrap()) {
        return;
      }

      void refreshSecureAuthSession().then((refreshed) => {
        if (!refreshed) {
          requestClientLogout("refresh_expired");
        }
      });
      return;
    }

    if (!isSecureAuthEnabled() || hasSecureAuthBootstrap()) {
      return;
    }

    if (bootstrappingTokenRef.current === token) {
      return;
    }

    bootstrappingTokenRef.current = token;

    void bootstrapSecureAuthSession(token)
      .then((bootstrapped) => {
        if (bootstrapped) {
          return;
        }

        bootstrappingTokenRef.current = null;
      })
      .catch(() => {
        bootstrappingTokenRef.current = null;
      });
  }, [data?.user, status]);

  return null;
};

export default AuthTokenSync;
