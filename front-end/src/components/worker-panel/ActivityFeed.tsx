"use client";

import {
  CheckCircle2,
  Clock3,
  FileText,
  KeyRound,
  ReceiptText,
  Sparkles,
} from "lucide-react";
import FriendlyEmptyState from "@/components/ui/FriendlyEmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkerHistoryEntry } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type LocalActivity = {
  id: string;
  type: "SECURITY" | "PROFILE";
  title: string;
  description: string;
  createdAt: string;
};

type ActivityFeedProps = {
  entries?: WorkerHistoryEntry[];
  localActivities?: LocalActivity[];
  isLoading?: boolean;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const ActivityFeed = ({
  entries = [],
  localActivities = [],
  isLoading,
}: ActivityFeedProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-0">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const mappedEntries = entries.slice(0, 6).map((entry) => ({
    id: `${entry.type}-${entry.id}`,
    title:
      entry.type === "INVOICE"
        ? `Invoice ${entry.reference}`
        : `Sale ${entry.reference}`,
    description: `${entry.customerName || "Walk-in Customer"} - ${formatCurrency(entry.amount)}`,
    date: entry.date,
    icon: entry.type === "INVOICE" ? FileText : ReceiptText,
    badge: entry.status,
  }));

  const mappedLocal = localActivities.map((activity) => ({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    date: activity.createdAt,
    icon: activity.type === "SECURITY" ? KeyRound : CheckCircle2,
    badge: activity.type === "SECURITY" ? "Security" : "Profile",
  }));

  const activities = [...mappedLocal, ...mappedEntries]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Latest assigned work and account updates.
        </p>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <FriendlyEmptyState
            icon={Sparkles}
            title="No activity yet"
            description="Invoices, sales, password updates, and incentives will show here when activity starts."
            className="py-7"
          />
        ) : (
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 transition-colors hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
                      index % 3 === 0
                        ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/25"
                        : index % 3 === 1
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25"
                          : "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/25",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold text-foreground">
                        {activity.title}
                      </p>
                      <Badge className="shrink-0 px-2 py-0.5 text-[10px]">
                        {activity.badge}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {activity.description}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                      {formatDateTime(activity.date)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
