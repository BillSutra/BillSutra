"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { API_URL } from "@/lib/apiEndPoints";
import {
  AUTH_LOGOUT_EVENT,
  clearClientAuthState,
  getSecureAuthExpiresAt,
  hasSecureAuthBootstrap,
  isAuthTokenExpired,
  isSecureAuthEnabled,
  isCookieOnlyAuthEnabled,
  normalizeAuthToken,
  refreshSecureAuthSessionDetailed,
} from "@/lib/secureAuth";

type SessionUserWithToken = {
  token?: string | null;
};

const AuthSessionGuard = () => {
  const { data, status } = useSession();
  const router = useRouter();
  const logoutInFlightRef = useRef<Promise<void> | null>(null);

  const performLogout = useEffectEvent(async () => {
    if (logoutInFlightRef.current) {
      return logoutInFlightRef.current;
    }

    clearClientAuthState();

    logoutInFlightRef.current = (async () => {
      try {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Clearing local state and NextAuth session is more important here.
      }

      try {
        await signOut({
          callbackUrl: "/login",
          redirect: true,
        });
      } catch {
        router.replace("/login");
      }
    })().finally(() => {
      logoutInFlightRef.current = null;
    });

    return logoutInFlightRef.current;
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleLogoutEvent = () => {
      void performLogout();
    };

    window.addEventListener(
      AUTH_LOGOUT_EVENT,
      handleLogoutEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        AUTH_LOGOUT_EVENT,
        handleLogoutEvent as EventListener,
      );
    };
  }, [performLogout]);

  useEffect(() => {
    if (status === "unauthenticated") {
      clearClientAuthState();
      return undefined;
    }

    if (status !== "authenticated") {
      return undefined;
    }

    if (isSecureAuthEnabled() && hasSecureAuthBootstrap()) {
      const secureExpiresAt = getSecureAuthExpiresAt();

      if (!secureExpiresAt) {
        return undefined;
      }

      const refreshLeadMs = 60 * 1000;
      const delayMs = Math.max(0, secureExpiresAt - Date.now() - refreshLeadMs);
      const timeoutId = window.setTimeout(() => {
        void refreshSecureAuthSessionDetailed().then((result) => {
          if (!result.ok && result.reason === "auth_invalid") {
            void performLogout();
          }
        });
      }, delayMs);

      return () => window.clearTimeout(timeoutId);
    }

    if (isCookieOnlyAuthEnabled()) {
      return undefined;
    }

    const token = normalizeAuthToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );

    if (!token) {
      return undefined;
    }

    if (!isAuthTokenExpired(token)) {
      return undefined;
    }

    if (!isSecureAuthEnabled() || isCookieOnlyAuthEnabled()) {
      void performLogout();
      return undefined;
    }

    void refreshSecureAuthSessionDetailed().then((result) => {
      if (!result.ok && result.reason === "auth_invalid") {
        void performLogout();
      }
    });

    return undefined;
  }, [data?.user, performLogout, status]);

  return null;
};

export default AuthSessionGuard;
