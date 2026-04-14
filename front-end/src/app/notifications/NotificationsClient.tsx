"use client";

import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useNotifications } from "@/providers/NotificationProvider";
import { useI18n } from "@/providers/LanguageProvider";
import type { AppNotificationType } from "@/lib/apiClient";

const notificationHref: Record<AppNotificationType, string> = {
  payment: "/invoices/history",
  inventory: "/inventory",
  customer: "/customers",
  subscription: "/pricing",
  worker: "/workers",
};

const notificationIcon: Record<AppNotificationType, string> = {
  payment: "💰",
  inventory: "📦",
  customer: "👤",
  subscription: "💳",
  worker: "👨‍💼",
};

const NotificationsClient = ({
  name,
  image,
}: {
  name: string;
  image?: string;
}) => {
  const { locale, t } = useI18n();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications();
  const pageTitle =
    t("notifications.pageTitle") === "notifications.pageTitle"
      ? "Notifications"
      : t("notifications.pageTitle");
  const pageSubtitle =
    t("notifications.pageSubtitle") === "notifications.pageSubtitle"
      ? "Recent business alerts, reminders, and team activity in one place."
      : t("notifications.pageSubtitle");
  const markAllReadLabel =
    t("notifications.markAllRead") === "notifications.markAllRead"
      ? "Mark all as read"
      : t("notifications.markAllRead");
  const emptyLabel =
    t("notifications.empty") === "notifications.empty"
      ? "No notifications yet."
      : t("notifications.empty");

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={pageTitle}
      subtitle={pageSubtitle}
      actions={
        <Button
          type="button"
          variant="outline"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
        >
          {markAllReadLabel}
        </Button>
      }
    >
      <div className="grid gap-3">
        {notifications.length === 0 ? (
          <div className="rounded-3xl border border-border/70 bg-card/70 p-6 text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          notifications.map((notification) => (
            <a
              key={notification.id}
              href={notificationHref[notification.type]}
              onClick={() => {
                if (!notification.isRead) {
                  void markRead(notification.id);
                }
              }}
              className="flex items-start gap-4 rounded-3xl border border-border/70 bg-card/80 p-4 transition hover:border-primary/40 hover:bg-card"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-lg">
                {notificationIcon[notification.type]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {notification.message}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              {!notification.isRead ? (
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
              ) : null}
            </a>
          ))
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsClient;
