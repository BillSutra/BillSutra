"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellRing,
  BriefcaseBusiness,
  CreditCard,
  Package,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
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
  {
    icon: ComponentType<{ className?: string }>;
    href: string;
    accent: string;
  }
> = {
  payment: {
    icon: CreditCard,
    href: "/invoices/history",
    accent:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  inventory: {
    icon: Package,
    href: "/inventory",
    accent:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  },
  customer: {
    icon: Users,
    href: "/customers",
    accent:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
  },
  subscription: {
    icon: Sparkles,
    href: "/pricing",
    accent:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
  },
  worker: {
    icon: BriefcaseBusiness,
    href: "/workers",
    accent:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
  },
  security: {
    icon: Shield,
    href: "/settings?tab=security",
    accent:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
  },
  system: {
    icon: BellRing,
    href: "/dashboard",
    accent:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
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
  const Icon = meta.icon;

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
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-1 text-sm leading-5",
            notification.isRead
              ? "text-foreground/80"
              : "font-semibold text-foreground",
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            "mt-1 line-clamp-2 text-xs leading-5",
            notification.isRead
              ? "text-muted-foreground"
              : "text-foreground/80",
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

    router.push(notification.actionUrl || typeMeta[notification.type].href);
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
      <DropdownMenuContent
        align="end"
        className="w-[22rem] rounded-3xl border-slate-200/90 bg-white/98 p-2 dark:border-zinc-800 dark:bg-zinc-950/98"
      >
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
            notifications.slice(0, 5).map((notification) => (
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
          <Button
            asChild
            variant="ghost"
            className="w-full justify-center rounded-2xl"
          >
            <Link href="/notifications">{copy.viewAll}</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
