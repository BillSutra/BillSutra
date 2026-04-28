"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import {
  BellRing,
  BriefcaseBusiness,
  CreditCard,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/providers/NotificationProvider";
import { cn } from "@/lib/utils";
import type { AppNotificationType } from "@/lib/apiClient";

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

const NotificationsPanel = ({
  className,
}: {
  className?: string;
  data?: unknown;
  isLoading?: boolean;
  isError?: boolean;
  dataUpdatedAt?: number;
  isFetching?: boolean;
}) => {
  const { notifications, isLoading, markRead } = useNotifications();
  const items = notifications.slice(0, 4);

  return (
    <Card
      className={`dashboard-chart-surface h-fit self-start gap-0 rounded-[1.85rem] py-6 ${className}`}
    >
      <CardHeader className="dashboard-chart-content gap-2">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-2 text-primary shadow-[0_10px_22px_-18px_rgba(37,99,235,0.18)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400">
            <BellRing size={18} />
          </div>
          <div>
            <p className="app-kicker">Live activity</p>
            <CardTitle className="mt-1 text-xl text-foreground dark:text-white">
              Notifications & alerts
            </CardTitle>
          </div>
        </div>
        <p className="text-sm leading-6 text-muted-foreground dark:text-zinc-400">
          Invoice, stock, customer, subscription, and team events appear here
          instantly.
        </p>
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-3">
        {isLoading ? (
          <div className="h-20 app-loading-skeleton" />
        ) : items.length === 0 ? (
          <div className="app-empty-state px-4 py-5 text-sm">
            No alerts right now.
          </div>
        ) : (
          <div className="grid gap-2 text-sm">
            {items.map((notification) => {
              const meta = notificationMeta[notification.type];
              const Icon = meta.icon;

              return (
                <Button
                  key={notification.id}
                  asChild
                  variant="ghost"
                  className={cn(
                    "h-auto rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_14px_30px_-24px_rgba(15,23,42,0.12)] transition-all duration-200 hover:scale-[1.01] hover:border-blue-200 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800",
                    !notification.isRead && "border-primary/20",
                  )}
                >
                  <Link
                    href={meta.href}
                    onClick={() => {
                      if (!notification.isRead) {
                        void markRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
                          meta.accent,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 flex-1 font-semibold leading-5 text-foreground dark:text-white">
                            {notification.message}
                          </p>
                          <Badge variant={!notification.isRead ? "pending" : "default"}>
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground dark:text-zinc-400">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                </Button>
              );
            })}
          </div>
        )}

        <Button asChild variant="outline" className="mt-1 rounded-2xl">
          <Link href="/notifications">Open notification center</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;
