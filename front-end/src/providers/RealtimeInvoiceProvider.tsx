"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/apiEndPoints";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";
import {
  ensureFreshSecureAuthSessionDetailed,
  getLegacyStoredToken,
  getSecureAuthAccessToken,
  isSecureAuthEnabled,
  logClientAuthEvent,
  logIgnoredNetworkFailure,
  normalizeAuthToken,
  requestClientLogout,
} from "@/lib/secureAuth";

const normalizeSocketToken = (raw?: string | null) => {
  const token = normalizeAuthToken(raw ?? null);
  if (!token) {
    return null;
  }

  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

const RealtimeInvoiceProvider = () => {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return undefined;
    }

    const legacyToken = normalizeSocketToken(getLegacyStoredToken());
    if (!isSecureAuthEnabled() && !legacyToken) {
      return undefined;
    }

    const socket = io(BASE_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: legacyToken ? { token: legacyToken } : {},
      autoConnect: false,
      reconnection: true,
      timeout: 8000,
    });

    socketRef.current = socket;
    let disposed = false;

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

    const prepareSocketAuth = async (forceRefresh = false) => {
      if (!isSecureAuthEnabled()) {
        socket.auth = legacyToken ? { token: legacyToken } : {};
        return true;
      }

      const refreshResult = await ensureFreshSecureAuthSessionDetailed({
        force: forceRefresh,
        minValidityMs: 60_000,
      });

      if (!refreshResult.ok) {
        if (refreshResult.reason === "auth_invalid") {
          logClientAuthEvent(
            "socket_auth_retry_failed",
            {
              reason: refreshResult.reason,
            },
            "warn",
          );
          requestClientLogout("401_refresh_failed");
        } else {
          logIgnoredNetworkFailure("socket_auth_prepare", {
            reason: refreshResult.reason,
            status: refreshResult.status,
          });
        }

        return false;
      }

      const accessToken = normalizeSocketToken(getSecureAuthAccessToken());
      socket.auth = accessToken ? { token: accessToken } : {};
      return true;
    };

    socket.on("invoice_updated", invalidateInvoiceState);
    socket.on("payment_added", invalidateInvoiceState);
    socket.on("invoice_paid", invalidateInvoiceState);
    socket.on("dashboard_updated", invalidateDashboardOnly);
    socket.on("disconnect", (reason) => {
      console.info("[socket] disconnected", { reason });
    });
    socket.io.on("reconnect_attempt", (attempt) => {
      console.info("[socket] reconnecting", { attempt });
      void prepareSocketAuth(false);
    });
    socket.io.on("reconnect_error", (error) => {
      logIgnoredNetworkFailure("socket_reconnect", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
    socket.on("connect_error", (error) => {
      console.info("[socket] reconnecting", {
        reason: error instanceof Error ? error.message : "connect_error",
      });

      if (isSecureAuthEnabled()) {
        void prepareSocketAuth(true).then((ready) => {
          if (ready && !disposed && socket.disconnected) {
            socket.connect();
          }
        });
      }
    });

    void prepareSocketAuth(false).then((ready) => {
      if (ready && !disposed) {
        socket.connect();
      } else if (!ready && !isSecureAuthEnabled()) {
        socket.disconnect();
      }
    });

    return () => {
      disposed = true;
      socket.off("invoice_updated", invalidateInvoiceState);
      socket.off("payment_added", invalidateInvoiceState);
      socket.off("invoice_paid", invalidateInvoiceState);
      socket.off("dashboard_updated", invalidateDashboardOnly);
      socket.off("disconnect");
      socket.off("connect_error");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect_error");
      socket.disconnect();
      socketRef.current = null;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [queryClient, status]);

  return null;
};

export default RealtimeInvoiceProvider;
