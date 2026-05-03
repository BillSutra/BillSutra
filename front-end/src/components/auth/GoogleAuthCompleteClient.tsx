"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LoaderCircle } from "lucide-react";
import {
  bootstrapSecureAuthSession,
  clearAuthLoginInProgress,
  clearPendingRememberMePreference,
  getPendingRememberMePreference,
  logClientAuthEvent,
  markAuthLoginInProgress,
  normalizeAuthToken,
} from "@/lib/secureAuth";

type SessionUserWithToken = {
  token?: string | null;
};

const sanitizeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  if (value.includes("://")) {
    return "/dashboard";
  }

  return value;
};

const GoogleAuthCompleteClient = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const completedRef = useRef(false);
  const [message, setMessage] = useState("Signing you in...");

  const nextPath = useMemo(
    () => sanitizeNextPath(searchParams.get("next")),
    [searchParams],
  );

  useEffect(() => {
    markAuthLoginInProgress();

    if (status === "loading" || completedRef.current) {
      return;
    }

    if (status === "unauthenticated") {
      completedRef.current = true;
      clearAuthLoginInProgress();
      router.replace("/login?error=GoogleSession");
      return;
    }

    let cancelled = false;

    const completeGoogleSession = async () => {
      setMessage("Securing your session...");
      logClientAuthEvent("google_redirect_completion_started");
      const refreshedSession = await update();
      const token = normalizeAuthToken(
        ((refreshedSession ?? session)?.user as
          | SessionUserWithToken
          | undefined)?.token ?? null,
      );

      if (!token) {
        completedRef.current = true;
        clearAuthLoginInProgress();
        void signOut({
          callbackUrl: "/login?error=GoogleSession",
          redirect: true,
        });
        return;
      }

      const bootstrapped = await bootstrapSecureAuthSession(token, {
        rememberMe: getPendingRememberMePreference(),
        allowWhenSecureAuthDisabled: true,
      });

      if (cancelled) {
        return;
      }

      if (!bootstrapped) {
        completedRef.current = true;
        clearAuthLoginInProgress();
        void signOut({
          callbackUrl: "/login?error=GoogleSession",
          redirect: true,
        });
        return;
      }

      completedRef.current = true;
      clearPendingRememberMePreference();
      clearAuthLoginInProgress();
      setMessage("Taking you to your dashboard...");
      logClientAuthEvent("google_redirect_completion_success");
      router.replace(nextPath);
    };

    void completeGoogleSession();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router, session, status, update]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border bg-card p-6 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LoaderCircle className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">BillSutra</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </main>
  );
};

export default GoogleAuthCompleteClient;
