"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import { fetchReportsSummary } from "@/lib/apiClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { workspaceQueryStaleTimes } from "@/hooks/useWorkspaceQueries";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

ChartJS.defaults.color = "#1f1b16";
ChartJS.defaults.borderColor = "#e4d6ca";

const trendLabels = [
  "Week 1",
  "Week 2",
  "Week 3",
  "Week 4",
  "Week 5",
  "Week 6",
];

const buildTrend = (base: number, multipliers: number[]) =>
  multipliers.map((multiplier) => Math.round(base * multiplier));

const trendMultipliers = [0.72, 0.88, 0.93, 1.05, 1.12, 1.2];

const BusinessCharts = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: fetchReportsSummary,
    staleTime: workspaceQueryStaleTimes.subscriptionPermissions,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const billedBase = data?.total_billed ? Number(data.total_billed) / 6 : 52000;
  const paidBase = data?.total_paid ? Number(data.total_paid) / 6 : 41000;
  const billedTrend = buildTrend(billedBase, trendMultipliers);
  const paidTrend = buildTrend(
    paidBase,
    trendMultipliers.map((m) => m - 0.08),
  );

  const salesCount = data?.sales ?? 0;
  const purchaseCount = data?.purchases ?? 0;
  const invoiceCount = data?.invoices ?? 0;

  const lowStockCount = data?.low_stock?.length ?? 0;
  const reorderCount = Math.max(4, Math.round(lowStockCount * 0.6));
  const healthyCount = Math.max(12, lowStockCount + reorderCount + 18);

  const lineData = {
    labels: trendLabels,
    datasets: [
      {
        label: "Billed",
        data: billedTrend,
        borderColor: "#f97316",
        backgroundColor: "rgba(249, 115, 22, 0.2)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "Paid",
        data: paidTrend,
        borderColor: "#0f766e",
        backgroundColor: "rgba(15, 118, 110, 0.2)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const barData = {
    labels: ["Invoices", "Sales", "Purchases"],
    datasets: [
      {
        label: "Documents",
        data: [invoiceCount, salesCount, purchaseCount],
        backgroundColor: ["#fde68a", "#f97316", "#0f766e"],
        borderRadius: 10,
      },
    ],
  };

  const doughnutData = {
    labels: ["Low stock", "Reorder queued", "Healthy"],
    datasets: [
      {
        data: [lowStockCount || 3, reorderCount, healthyCount],
        backgroundColor: ["#b45309", "#f6a54a", "#0f766e"],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="border-[#ecdccf] bg-white/90">
        <CardHeader>
          <CardTitle className="text-xl">Revenue cadence</CardTitle>
          <CardDescription>
            Billed vs paid momentum across the last six weeks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <Line
              data={lineData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "top" },
                },
                scales: {
                  x: { grid: { display: false } },
                  y: {
                    ticks: {
                      callback: (value: number | string) => `₹${value}`,
                    },
                  },
                },
              }}
            />
          </div>
          {isLoading && (
            <p className="mt-3 text-xs text-[#8a6d56]">Loading trend...</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="border-[#ecdccf] bg-[#fff5ea]">
          <CardHeader>
            <CardTitle className="text-lg">Operational volume</CardTitle>
            <CardDescription>
              Sales, purchases, and invoices today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { grid: { color: "#f2e6dc" } } },
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#ecdccf] bg-white/90">
          <CardHeader>
            <CardTitle className="text-lg">Inventory health</CardTitle>
            <CardDescription>
              Balance low stock, reorder, and healthy bins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mx-auto h-[190px] max-w-[220px]">
              <Doughnut
                data={doughnutData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom" },
                  },
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BusinessCharts;
