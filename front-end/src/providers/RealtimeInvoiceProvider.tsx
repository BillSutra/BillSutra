"use client";

import { useEffect, useMemo, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/apiEndPoints";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";
import {
  getLegacyStoredToken,
  hasSecureAuthBootstrap,
  isCookieOnlyAuthEnabled,
  isSecureAuthEnabled,
  normalizeAuthToken,
} from "@/lib/secureAuth";

type SessionUserWithToken = {
  token?: string;
};

const normalizeSocketToken = (raw?: string | null) => {
  const token = normalizeAuthToken(raw ?? null);
  if (!token) {
    return null;
  }

  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

const RealtimeInvoiceProvider = () => {
  const { data, status } = useSession();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const debounceRef = useRef<number | null>(null);

  const authToken = useMemo(() => {
    const sessionToken = normalizeSocketToken(
      (data?.user as SessionUserWithToken | undefined)?.token ?? null,
    );

    if (sessionToken) {
      return sessionToken;
    }

    return normalizeSocketToken(getLegacyStoredToken());
  }, [data?.user]);

  useEffect(() => {
    if (status !== "authenticated") {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    const secureCookieSocket =
      isCookieOnlyAuthEnabled() ||
      (isSecureAuthEnabled() && hasSecureAuthBootstrap());

    if (!secureCookieSocket && !authToken) {
      return undefined;
    }

    const socket = io(BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: secureCookieSocket ? undefined : { token: authToken },
      autoConnect: true,
      reconnection: true,
      timeout: 8000,
    });

    socketRef.current = socket;

    const invalidateInvoiceState = () => {
      if (debounceRef.current) {
        return;
      }

      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["invoices"] }),
          queryClient.invalidateQueries({ queryKey: ["payments"] }),
          queryClient.invalidateQueries({ queryKey: ["customers"] }),
          queryClient.invalidateQueries({ queryKey: ["customer-ledger"] }),
          invalidateDashboardQueries(queryClient),
        ]);
      }, 250);
    };

    const invalidateDashboardOnly = () => {
      if (debounceRef.current) {
        return;
      }

      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        void invalidateDashboardQueries(queryClient);
      }, 250);
    };

    socket.on("invoice_updated", invalidateInvoiceState);
    socket.on("payment_added", invalidateInvoiceState);
    socket.on("invoice_paid", invalidateInvoiceState);
    socket.on("dashboard_updated", invalidateDashboardOnly);
    socket.on("connect_error", () => {
      // Realtime is best-effort only. API fetching remains the fallback path.
    });

    return () => {
      socket.off("invoice_updated", invalidateInvoiceState);
      socket.off("payment_added", invalidateInvoiceState);
      socket.off("invoice_paid", invalidateInvoiceState);
      socket.off("dashboard_updated", invalidateDashboardOnly);
      socket.disconnect();
      socketRef.current = null;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [authToken, queryClient, status]);

  return null;
};

export default RealtimeInvoiceProvider;
