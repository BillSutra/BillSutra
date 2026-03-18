"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_URL } from "@/lib/apiEndPoints";
import { invalidateDashboardQueries } from "@/lib/dashboardRealtime";

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

  const authToken = useMemo(() => {
    const direct = normalizeToken(token);
    if (direct) return direct;
    if (typeof window === "undefined") return null;
    return normalizeToken(window.localStorage.getItem("token"));
  }, [token]);

  useEffect(() => {
    if (!enabled || !authToken) return undefined;

    const url = `${API_URL}/dashboard/stream?token=${encodeURIComponent(authToken)}`;
    const source = new EventSource(url);

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
      scheduleInvalidate();
    };

    return () => {
      source.removeEventListener("dashboard:update", handleUpdate);
      source.removeEventListener("connected", handleConnected);
      source.close();
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [authToken, debounceMs, enabled, queryClient]);
};
