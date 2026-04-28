"use client";

import { useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCheck,
  CreditCard,
  Package,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { useNotifications } from "@/providers/NotificationProvider";
import { useI18n } from "@/providers/LanguageProvider";
import {
  fetchNotifications,
  type AppNotification,
  type AppNotificationType,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const notificationMeta: Record<
  AppNotificationType,
  {
    label: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    accent: string;
  }
> = {
  payment: {
    label: "Payment",
    href: "/invoices/history",
    icon: CreditCard,
    accent:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  inventory: {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
    accent:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
  },
  customer: {
    label: "Customer",
    href: "/customers",
    icon: Users,
    accent:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
  },
  subscription: {
    label: "Subscription",
    href: "/pricing",
    icon: Sparkles,
    accent:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
  },
  worker: {
    label: "Worker",
    href: "/workers",
    icon: BriefcaseBusiness,
    accent:
      "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
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

const NotificationsClient = ({
  name,
  image,
}: {
  name: string;
  image?: string;
}) => {
  const { locale, t } = useI18n();
  const { unreadCount, markRead, markUnread, markAllRead, remove } =
    useNotifications();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<AppNotificationType | "all">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">(
    "all",
  );

  const query = useQuery({
    queryKey: ["notifications", "page", page, typeFilter, statusFilter],
    queryFn: () =>
      fetchNotifications({
        page,
        limit: PAGE_SIZE,
        type: typeFilter === "all" ? null : typeFilter,
        isRead:
          statusFilter === "all"
            ? null
            : statusFilter === "read",
      }),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });

  const notifications = query.data?.notifications ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const typeFilters = useMemo(
    () => [
      { value: "all" as const, label: "All" },
      { value: "payment" as const, label: notificationMeta.payment.label },
      { value: "inventory" as const, label: notificationMeta.inventory.label },
      { value: "customer" as const, label: notificationMeta.customer.label },
      {
        value: "subscription" as const,
        label: notificationMeta.subscription.label,
      },
      { value: "worker" as const, label: notificationMeta.worker.label },
    ],
    [],
  );

  const statusFilters = [
    { value: "all" as const, label: "All activity" },
    { value: "unread" as const, label: "Unread" },
    { value: "read" as const, label: "Read" },
  ];

  const pageTitle =
    t("notifications.pageTitle") === "notifications.pageTitle"
      ? "Notifications"
      : t("notifications.pageTitle");
  const pageSubtitle =
    t("notifications.pageSubtitle") === "notifications.pageSubtitle"
      ? "Business alerts, reminders, and team activity update here in real time."
      : t("notifications.pageSubtitle");
  const markAllReadLabel =
    t("notifications.markAllRead") === "notifications.markAllRead"
      ? "Mark all as read"
      : t("notifications.markAllRead");
  const emptyLabel =
    t("notifications.empty") === "notifications.empty"
      ? "No notifications yet."
      : t("notifications.empty");

  const handleTypeChange = (value: AppNotificationType | "all") => {
    setPage(1);
    setTypeFilter(value);
  };

  const handleStatusChange = (value: "all" | "unread" | "read") => {
    setPage(1);
    setStatusFilter(value);
  };

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
      <div className="grid gap-5">
        <section className="rounded-[1.9rem] border border-border/70 bg-card/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
                  : "You are all caught up."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Filter business alerts by type or read state.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap gap-2">
                {typeFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={
                      typeFilter === filter.value ? "default" : "outline"
                    }
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleTypeChange(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={
                      statusFilter === filter.value ? "secondary" : "ghost"
                    }
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleStatusChange(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          {query.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`notification-skeleton-${index}`}
                className="app-loading-skeleton h-28 rounded-[1.9rem]"
              />
            ))
          ) : notifications.length === 0 ? (
            <div className="rounded-[1.9rem] border border-dashed border-border/70 bg-card/60 p-8 text-center">
              <p className="text-sm font-medium text-foreground">{emptyLabel}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                New invoice, payment, inventory, and team events will appear
                here automatically.
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const meta = notificationMeta[notification.type];
              const Icon = meta.icon;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "rounded-[1.9rem] border border-border/70 bg-card/80 p-4 shadow-sm transition-colors",
                    notification.isRead ? "opacity-90" : "border-primary/25",
                  )}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                      <div
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
                          meta.accent,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="default" className="capitalize">
                            {meta.label}
                          </Badge>
                          {!notification.isRead ? (
                            <Badge variant="pending">Unread</Badge>
                          ) : (
                            <Badge variant="default">Read</Badge>
                          )}
                        </div>
                        <p className="mt-3 text-sm font-medium leading-6 text-foreground">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {formatRelativeTime(notification.createdAt, locale)}
                          </span>
                          <span>
                            {new Date(notification.createdAt).toLocaleString(
                              locale,
                              {
                                dateStyle: "medium",
                                timeStyle: "short",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={meta.href}>Open</Link>
                      </Button>
                      {notification.isRead ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void markUnread(notification.id)}
                        >
                          Mark unread
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void markRead(notification.id)}
                        >
                          <CheckCheck className="h-4 w-4" />
                          Mark read
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => void remove(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-[1.9rem] border border-border/70 bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {notifications.length} of {total} notifications
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || query.isFetching}
            >
              Previous
            </Button>
            <span className="min-w-[7rem] text-center text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={page >= totalPages || query.isFetching}
            >
              Next
            </Button>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default NotificationsClient;
