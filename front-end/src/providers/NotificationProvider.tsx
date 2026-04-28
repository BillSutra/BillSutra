"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type AppNotification,
} from "@/lib/apiClient";

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isFetching: boolean;
  refresh: () => Promise<unknown>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const NOTIFICATION_QUERY_KEY = ["notifications", "header"];

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { status } = useSession();

  const query = useQuery({
    queryKey: NOTIFICATION_QUERY_KEY,
    queryFn: () => fetchNotifications(10),
    enabled: status === "authenticated",
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? false : 60_000,
    refetchIntervalInBackground: false,
    staleTime: 45_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY }),
  });

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications: query.data?.notifications ?? [],
      unreadCount: query.data?.unreadCount ?? 0,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      refresh: () => query.refetch(),
      markRead: async (id: string) => {
        await markReadMutation.mutateAsync(id);
      },
      markAllRead: async () => {
        await markAllReadMutation.mutateAsync();
      },
    }),
    [markAllReadMutation, markReadMutation, query],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
};
