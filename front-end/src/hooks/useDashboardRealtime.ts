"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiEndPoints";
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

type UseDashboardRealtimeOptions = {
  enabled?: boolean;
  token?: string;
  debounceMs?: number;
};

const normalizeStreamToken = (raw?: string | null) => {
  const token = normalizeAuthToken(raw ?? null);
  if (!token) {
    return null;
  }

  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

export const useDashboardRealtime = ({
  enabled = true,
  token,
  debounceMs = 500,
}: UseDashboardRealtimeOptions) => {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const directToken = normalizeStreamToken(token);
    const legacyToken = normalizeStreamToken(getLegacyStoredToken());
    if (!isSecureAuthEnabled() && !directToken && !legacyToken) {
      return undefined;
    }

    let disposed = false;
    let reconnectAttempt = 0;
    let retryTimeoutId: number | null = null;
    let source: EventSource | null = null;

    const scheduleInvalidate = () => {
      if (debounceRef.current) return;
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        invalidateDashboardQueries(queryClient);
      }, debounceMs);
    };

    const handleUpdate = () => scheduleInvalidate();
    const handleConnected = () => {
      reconnectAttempt = 0;
      scheduleInvalidate();
    };

    const cleanupSource = () => {
      if (!source) {
        return;
      }

      source.removeEventListener("dashboard:update", handleUpdate);
      source.removeEventListener("connected", handleConnected);
      source.close();
      source = null;
    };

    const scheduleReconnect = () => {
      if (disposed || retryTimeoutId !== null) {
        return;
      }

      const attempt = reconnectAttempt + 1;
      const delayMs = Math.min(2_000 * 2 ** Math.max(attempt - 1, 0), 30_000);
      reconnectAttempt = attempt;
      console.info("[stream] reconnecting", { attempt, delayMs });
      retryTimeoutId = window.setTimeout(() => {
        retryTimeoutId = null;
        void openSource();
      }, delayMs);
    };

    const resolveStreamUrl = async (forceRefresh = false) => {
      if (!isSecureAuthEnabled()) {
        const fallbackToken = directToken ?? legacyToken;
        return fallbackToken
          ? `${API_URL}/dashboard/stream?token=${encodeURIComponent(fallbackToken)}`
          : null;
      }

      const refreshResult = await ensureFreshSecureAuthSessionDetailed({
        force: forceRefresh,
        minValidityMs: 60_000,
      });

      if (!refreshResult.ok) {
        if (refreshResult.reason === "auth_invalid") {
          logClientAuthEvent(
            "stream_auth_retry_failed",
            {
              reason: refreshResult.reason,
            },
            "warn",
          );
          requestClientLogout("401_refresh_failed");
        } else {
          logIgnoredNetworkFailure("dashboard_stream", {
            reason: refreshResult.reason,
            status: refreshResult.status,
          });
        }

        return null;
      }

      const accessToken = normalizeStreamToken(getSecureAuthAccessToken());
      return accessToken
        ? `${API_URL}/dashboard/stream?token=${encodeURIComponent(accessToken)}`
        : `${API_URL}/dashboard/stream`;
    };

    const handleStreamError = async () => {
      if (disposed) {
        return;
      }

      cleanupSource();
      await resolveStreamUrl(true);
      scheduleReconnect();
    };

    const openSource = async () => {
      if (disposed) {
        return;
      }

      const url = await resolveStreamUrl(false);
      if (!url || disposed) {
        scheduleReconnect();
        return;
      }

      source = url.includes("?token=")
        ? new EventSource(url)
        : new EventSource(url, { withCredentials: true });

      source.addEventListener("dashboard:update", handleUpdate);
      source.addEventListener("connected", handleConnected);
      source.onerror = () => {
        void handleStreamError();
      };
    };

    void openSource();

    return () => {
      disposed = true;
      cleanupSource();
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [debounceMs, enabled, queryClient, token]);
};
