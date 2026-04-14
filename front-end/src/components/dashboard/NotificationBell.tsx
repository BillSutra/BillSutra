"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/providers/NotificationProvider";
import { useI18n } from "@/providers/LanguageProvider";
import type { AppNotification, AppNotificationType } from "@/lib/apiClient";

const typeMeta: Record<
  AppNotificationType,
  { icon: string; href: string; accent: string }
> = {
  payment: {
    icon: "💰",
    href: "/invoices/history",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  inventory: {
    icon: "📦",
    href: "/inventory",
    accent: "border-amber-200 bg-amber-50 text-amber-700",
  },
  customer: {
    icon: "👤",
    href: "/customers",
    accent: "border-sky-200 bg-sky-50 text-sky-700",
  },
  subscription: {
    icon: "💳",
    href: "/pricing",
    accent: "border-violet-200 bg-violet-50 text-violet-700",
  },
  worker: {
    icon: "👨‍💼",
    href: "/workers",
    accent: "border-orange-200 bg-orange-50 text-orange-700",
  },
};

const formatRelativeTime = (value: string, locale: string) => {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const divisions: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];

  for (const [unit, amount] of divisions) {
    if (Math.abs(seconds) >= amount || unit === "minute") {
      return rtf.format(Math.round(seconds / amount), unit);
    }
  }

  return rtf.format(seconds, "second");
};

const NotificationRow = ({
  notification,
  locale,
  onSelect,
}: {
  notification: AppNotification;
  locale: string;
  onSelect: (notification: AppNotification) => void;
}) => {
  const meta = typeMeta[notification.type];

  return (
    <DropdownMenuItem
      className="flex items-start gap-3 rounded-2xl px-3 py-3"
      onSelect={(event) => {
        event.preventDefault();
        onSelect(notification);
      }}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-base",
          meta.accent,
        )}
      >
        <span aria-hidden="true">{meta.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 text-sm leading-5",
            notification.isRead ? "text-muted-foreground" : "font-medium text-foreground",
          )}
        >
          {notification.message}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.createdAt, locale)}
        </p>
      </div>
      {!notification.isRead ? (
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
      ) : null}
    </DropdownMenuItem>
  );
};

const NotificationBell = () => {
  const router = useRouter();
  const { locale, t } = useI18n();
  const { notifications, unreadCount, markRead, markAllRead, isLoading } =
    useNotifications();
  const copy = {
    title:
      t("notifications.title") === "notifications.title"
        ? "Notifications"
        : t("notifications.title"),
    unreadCount:
      t("notifications.unreadCount", { count: unreadCount }) ===
      "notifications.unreadCount"
        ? `${unreadCount} unread`
        : t("notifications.unreadCount", { count: unreadCount }),
    allCaughtUp:
      t("notifications.allCaughtUp") === "notifications.allCaughtUp"
        ? "You are all caught up."
        : t("notifications.allCaughtUp"),
    markAllRead:
      t("notifications.markAllRead") === "notifications.markAllRead"
        ? "Mark all as read"
        : t("notifications.markAllRead"),
    empty:
      t("notifications.empty") === "notifications.empty"
        ? "No notifications yet."
        : t("notifications.empty"),
    viewAll:
      t("notifications.viewAll") === "notifications.viewAll"
        ? "View all notifications"
        : t("notifications.viewAll"),
  };

  const handleSelect = async (notification: AppNotification) => {
    if (!notification.isRead) {
      await markRead(notification.id);
    }

    router.push(typeMeta[notification.type].href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative rounded-2xl"
          aria-label={t("topNavbar.notifications")}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-3xl p-2">
        <div className="flex items-center justify-between px-3 py-2">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {copy.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? copy.unreadCount : copy.allCaughtUp}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-xl px-3 text-xs"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0}
          >
            {copy.markAllRead}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[24rem] overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-6 text-sm text-muted-foreground">
              {copy.empty}
            </div>
          ) : (
            notifications
              .slice(0, 5)
              .map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  locale={locale}
                  onSelect={(item) => void handleSelect(item)}
                />
              ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 pt-1">
          <Button asChild variant="ghost" className="w-full justify-center rounded-2xl">
            <Link href="/notifications">{copy.viewAll}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
