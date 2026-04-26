"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiEndPoints";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";
import {
  getLegacyStoredToken,
  hasSecureAuthBootstrap,
  isCookieOnlyAuthEnabled,
  isSecureAuthEnabled,
  refreshSecureAuthSession,
} from "@/lib/secureAuth";

type UseDashboardRealtimeOptions = {
  enabled?: boolean;
  token?: string;
  debounceMs?: number;
};

const normalizeToken = (raw?: string | null) => {
  if (!raw) return null;
  const token = raw.trim();
  if (!token || token === "undefined" || token === "null") return null;
  return token;
};

export const useDashboardRealtime = ({
  enabled = true,
  token,
  debounceMs = 500,
}: UseDashboardRealtimeOptions) => {
  const queryClient = useQueryClient();
  const debounceRef = useRef<number | null>(null);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const [preferCookieAuth, setPreferCookieAuth] = useState(false);

  const authToken = useMemo(() => {
    const direct = normalizeToken(token);
    if (direct) return direct;
    return getLegacyStoredToken();
  }, [token]);

  useEffect(() => {
    if (!enabled) return undefined;

    const secureCookieStream =
      preferCookieAuth ||
      isCookieOnlyAuthEnabled() ||
      (isSecureAuthEnabled() && hasSecureAuthBootstrap());

    if (!secureCookieStream && !authToken) {
      return undefined;
    }

    const url = secureCookieStream
      ? `${API_URL}/dashboard/stream`
      : `${API_URL}/dashboard/stream?token=${encodeURIComponent(authToken as string)}`;
    const source = secureCookieStream
      ? new EventSource(url, { withCredentials: true })
      : new EventSource(url);
    let disposed = false;

    const scheduleInvalidate = () => {
      if (debounceRef.current) return;
      debounceRef.current = window.setTimeout(() => {
        debounceRef.current = null;
        invalidateDashboardQueries(queryClient);
      }, debounceMs);
    };

    const handleUpdate = () => scheduleInvalidate();
    const handleConnected = () => scheduleInvalidate();

    source.addEventListener("dashboard:update", handleUpdate);
    source.addEventListener("connected", handleConnected);

    source.onerror = () => {
      if (!secureCookieStream && isSecureAuthEnabled()) {
        if (!refreshInFlightRef.current) {
          refreshInFlightRef.current = refreshSecureAuthSession()
            .then((refreshed) => {
              if (refreshed && !disposed) {
                setPreferCookieAuth(true);
              }
              return refreshed;
            })
            .finally(() => {
              refreshInFlightRef.current = null;
            });
        }
        return;
      }

      scheduleInvalidate();
    };

    return () => {
      disposed = true;
      source.removeEventListener("dashboard:update", handleUpdate);
      source.removeEventListener("connected", handleConnected);
      source.close();
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [authToken, debounceMs, enabled, preferCookieAuth, queryClient]);
};
