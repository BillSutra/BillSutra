"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDashboardOverview } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ActivityTimeline = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
  });

  return (
    <Card className="border-[#ecdccf] bg-white/90">
      <CardHeader>
        <CardTitle className="text-lg">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading && (
          <div className="h-24 rounded-xl bg-[#fdf7f1] animate-pulse" />
        )}
        {isError && (
          <p className="text-sm text-[#b45309]">Unable to load activity.</p>
        )}
        {!isLoading && !isError && data && data.activity.length === 0 && (
          <p className="text-sm text-[#8a6d56]">No activity yet.</p>
        )}
        {!isLoading && !isError && data && data.activity.length > 0 && (
          <div className="grid gap-3">
            {data.activity.map((item) => (
              <div
                key={`${item.time}-${item.label}`}
                className="flex items-start justify-between rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3 text-sm"
              >
                <span className="text-[#4b3a2a]">{item.label}</span>
                <span className="text-xs text-[#8a6d56]">{item.time}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityTimeline;
