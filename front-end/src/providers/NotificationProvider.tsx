"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  deleteNotification as deleteNotificationRequest,
  fetchNotifications,
  markAllNotificationsAsRead,
  updateNotificationReadState,
  type AppNotification,
  type NotificationListResponse,
} from "@/lib/apiClient";
import { isAuthLoginInProgress } from "@/lib/secureAuth";

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isFetching: boolean;
  refresh: () => Promise<unknown>;
  markRead: (id: string) => Promise<void>;
  markUnread: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const NOTIFICATION_QUERY_KEY = ["notifications", "header"];

const updateNotificationQueryCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: NotificationListResponse) => NotificationListResponse,
) => {
  queryClient.setQueriesData<NotificationListResponse>(
    { queryKey: ["notifications"] },
    (current) => (current ? updater(current) : current),
  );
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const workerMode = session?.user?.accountType === "WORKER";
  const isCompletingGoogleAuth =
    pathname?.startsWith("/auth/google-complete") ?? false;

  const query = useQuery({
    queryKey: [...NOTIFICATION_QUERY_KEY, workerMode ? "worker" : "owner"],
    queryFn: () => fetchNotifications({ limit: 5 }, { workerMode }),
    enabled:
      status === "authenticated" &&
      !isCompletingGoogleAuth &&
      !isAuthLoginInProgress(),
    refetchInterval: () =>
      typeof document !== "undefined" && document.hidden ? false : 60_000,
    refetchIntervalInBackground: false,
    staleTime: 45_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      updateNotificationReadState(id, true, { workerMode }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({
        queryKey: ["notifications"],
      });

      let unreadDelta = 0;
      updateNotificationQueryCaches(queryClient, (current) => {
        let changed = false;
        const notifications = current.notifications.map((notification) => {
          if (notification.id !== id || notification.isRead) {
            return notification;
          }

          changed = true;
          return { ...notification, isRead: true };
        });

        if (changed) {
          unreadDelta = -1;
        }

        return {
          ...current,
          notifications,
          unreadCount: Math.max(0, current.unreadCount + unreadDelta),
        };
      });

      return { snapshots };
    },
    onError: (_error, _id, context) => {
      context?.snapshots.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markUnreadMutation = useMutation({
    mutationFn: (id: string) =>
      updateNotificationReadState(id, false, { workerMode }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({
        queryKey: ["notifications"],
      });

      let unreadDelta = 0;
      updateNotificationQueryCaches(queryClient, (current) => {
        let changed = false;
        const notifications = current.notifications.map((notification) => {
          if (notification.id !== id || !notification.isRead) {
            return notification;
          }

          changed = true;
          return { ...notification, isRead: false };
        });

        if (changed) {
          unreadDelta = 1;
        }

        return {
          ...current,
          notifications,
          unreadCount: Math.max(0, current.unreadCount + unreadDelta),
        };
      });

      return { snapshots };
    },
    onError: (_error, _id, context) => {
      context?.snapshots.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead({ workerMode }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({
        queryKey: ["notifications"],
      });

      updateNotificationQueryCaches(queryClient, (current) => ({
        ...current,
        notifications: current.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        })),
        unreadCount: 0,
      }));

      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNotificationRequest(id, { workerMode }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const snapshots = queryClient.getQueriesData<NotificationListResponse>({
        queryKey: ["notifications"],
      });

      let unreadDelta = 0;
      updateNotificationQueryCaches(queryClient, (current) => {
        const target = current.notifications.find((notification) => notification.id === id);
        if (target && !target.isRead) {
          unreadDelta = -1;
        }

        return {
          ...current,
          notifications: current.notifications.filter(
            (notification) => notification.id !== id,
          ),
          unreadCount: Math.max(0, current.unreadCount + unreadDelta),
          total: target ? Math.max(0, current.total - 1) : current.total,
        };
      });

      return { snapshots };
    },
    onError: (_error, _id, context) => {
      context?.snapshots.forEach(([key, value]) => {
        queryClient.setQueryData(key, value);
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
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
      markUnread: async (id: string) => {
        await markUnreadMutation.mutateAsync(id);
      },
      markAllRead: async () => {
        await markAllReadMutation.mutateAsync();
      },
      remove: async (id: string) => {
        await deleteMutation.mutateAsync(id);
      },
    }),
    [deleteMutation, markAllReadMutation, markReadMutation, markUnreadMutation, query],
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
