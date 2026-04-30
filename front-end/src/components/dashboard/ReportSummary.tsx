"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReportsSummary } from "@/lib/apiClient";
import { workspaceQueryStaleTimes } from "@/hooks/useWorkspaceQueries";

const ReportSummary = () => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: fetchReportsSummary,
    staleTime: workspaceQueryStaleTimes.subscriptionPermissions,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[#f2e6dc] bg-white/80 p-4 text-sm text-[#8a6d56]">
        Loading dashboard metrics...
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-[#f2e6dc] bg-[#fff5ea] p-4 text-sm text-[#b45309]">
        Unable to load summary right now.
      </div>
    );
  }

  const totalBilled = Number(data.total_billed) || 0;
  const totalPaid = Number(data.total_paid) || 0;
  const profit = Number(data.profit) || 0;

  const cards = [
    { label: "Invoices", value: data.invoices },
    { label: "Sales", value: data.sales },
    { label: "Purchases", value: data.purchases },
    { label: "Total billed", value: `₹${totalBilled.toFixed(2)}` },
    { label: "Total paid", value: `₹${totalPaid.toFixed(2)}` },
    { label: "Profit", value: `₹${profit.toFixed(2)}` },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-[#f2e6dc] bg-white/80 p-4"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
            {card.label}
          </p>
          <div className="mt-3 text-2xl font-black text-[#1f1b16]">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ReportSummary;
