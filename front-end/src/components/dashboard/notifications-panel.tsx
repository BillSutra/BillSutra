"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { fetchDashboardOverview } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const NotificationsPanel = ({ className }: { className?: string }) => {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
  });

  const notifications = data?.notifications ?? [];

  const typeVariant = (type: string) => {
    if (type === "LOW_STOCK") return "pending";
    if (type === "PENDING_INVOICE") return "overdue";
    return "default";
  };

  return (
    <Card className={`border-[#ecdccf] bg-[#fff7ef] ${className}`}>
      <CardHeader>
        <CardTitle className="text-lg">Notifications & alerts</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading && (
          <div className="h-20 rounded-xl bg-white/70 animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load alerts.</p>
        )}
        {!isLoading && !isError && (
          <>
            {notifications.length === 0 ? (
              <p className="text-sm text-[#8a6d56]">No alerts right now.</p>
            ) : (
              <div className="grid gap-2 text-sm">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => router.push(notification.redirectUrl)}
                    className="rounded-lg border border-[#f2e6dc] bg-white px-3 py-2 text-left transition hover:bg-[#fff6ed]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-[#1f1b16]">
                        {notification.title}
                      </p>
                      <Badge variant={typeVariant(notification.type)}>
                        {notification.type.replaceAll("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#8a6d56]">
                      {notification.message}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationsPanel;
