"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAdminAuthState,
  fetchAdminSession,
  isAdminUnauthorizedError,
  logoutSuperAdmin,
  subscribeToAdminAuthInvalidation,
  type AdminSessionUser,
} from "@/lib/adminApiClient";

type AdminAuthStatus = "loading" | "authenticated" | "unauthenticated";

type AdminAuthContextValue = {
  status: AdminAuthStatus;
  user: AdminSessionUser | null;
  restoreSession: (options?: { force?: boolean }) => Promise<AdminSessionUser | null>;
  handleLoginSuccess: (user: AdminSessionUser) => void;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export const AdminAuthProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<AdminAuthStatus>("loading");
  const [user, setUser] = useState<AdminSessionUser | null>(null);
  const redirectKeyRef = useRef<string | null>(null);

  const restoreSession = useCallback(
    async (options?: { force?: boolean }) => {
      setStatus((current) =>
        current === "authenticated" && !options?.force ? current : "loading",
      );

      try {
        const nextUser = await fetchAdminSession({
          force: options?.force,
        });
        setUser(nextUser);
        setStatus("authenticated");
        return nextUser;
      } catch (error) {
        if (isAdminUnauthorizedError(error)) {
          clearAdminAuthState();
          setUser(null);
          setStatus("unauthenticated");
          return null;
        }

        setUser(null);
        setStatus("unauthenticated");
        throw error;
      }
    },
    [],
  );

  const handleLoginSuccess = useCallback((nextUser: AdminSessionUser) => {
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSuperAdmin();
    } catch {
      // Best effort: client state still needs to be cleared.
    } finally {
      clearAdminAuthState();
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void restoreSession().catch(() => {
      if (!active) {
        return;
      }

      setUser(null);
      setStatus("unauthenticated");
    });

    return () => {
      active = false;
    };
  }, [restoreSession]);

  useEffect(() => {
    return subscribeToAdminAuthInvalidation(() => {
      setUser(null);
      setStatus("unauthenticated");
    });
  }, []);

  useEffect(() => {
    if (!pathname) {
      return;
    }

    if (status === "loading") {
      return;
    }

    const isLoginRoute = pathname === "/admin/login";
    const redirectTarget =
      status === "authenticated" && isLoginRoute
        ? "/admin/dashboard"
        : status === "unauthenticated" && !isLoginRoute
          ? "/admin/login"
          : null;

    if (!redirectTarget) {
      redirectKeyRef.current = null;
      return;
    }

    const redirectKey = `${pathname}->${redirectTarget}`;
    if (redirectKeyRef.current === redirectKey) {
      return;
    }

    redirectKeyRef.current = redirectKey;
    router.replace(redirectTarget);
  }, [pathname, router, status]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      status,
      user,
      restoreSession,
      handleLoginSuccess,
      logout,
    }),
    [handleLoginSuccess, logout, restoreSession, status, user],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }

  return context;
};
