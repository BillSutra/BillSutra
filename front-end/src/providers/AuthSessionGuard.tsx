"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  AUTH_LOGOUT_EVENT,
  clearClientAuthState,
  ensureFreshSecureAuthSessionDetailed,
  getSecureAuthExpiresAt,
  hasSecureAuthBootstrap,
  isSecureAuthEnabled,
  logClientAuthEvent,
} from "@/lib/secureAuth";

type LogoutEventDetail = {
  reason?: string;
};

const AuthSessionGuard = () => {
  const { status } = useSession();
  const router = useRouter();
  const logoutInFlightRef = useRef<Promise<void> | null>(null);

  const performLogout = useEffectEvent(async (reason = "session_expired") => {
    if (logoutInFlightRef.current) {
      return logoutInFlightRef.current;
    }

    clearClientAuthState();
    logClientAuthEvent(`logout_reason=${reason}`);

    logoutInFlightRef.current = (async () => {
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

    const handleLogoutEvent = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as LogoutEventDetail | undefined)
          : undefined;
      void performLogout(detail?.reason ?? "session_expired");
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

    if (!isSecureAuthEnabled()) {
      return undefined;
    }

    let cancelled = false;
    const secureExpiresAt = getSecureAuthExpiresAt();
    const delayMs =
      hasSecureAuthBootstrap() && secureExpiresAt
        ? Math.max(0, secureExpiresAt - Date.now() - 60_000)
        : 0;

    const timeoutId = window.setTimeout(() => {
      void ensureFreshSecureAuthSessionDetailed({
        force: true,
        minValidityMs: 0,
      }).then((result) => {
        if (!cancelled && !result.ok && result.reason === "auth_invalid") {
          void performLogout("401_refresh_failed");
        }
      });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [performLogout, status]);

  return null;
};

export default AuthSessionGuard;
