import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type MetricCardProps = {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trendLabel?: string;
};

const formatChange = (change: number) => {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

const MetricCard = ({
  title,
  value,
  change,
  icon,
  trendLabel,
}: MetricCardProps) => {
  const isPositive = change >= 0;

  return (
    <Card className="rounded-xl border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
              {title}
            </p>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {value}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 text-indigo-600 dark:border-gray-700 dark:bg-gray-900 dark:text-indigo-300">
            {icon}
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                isPositive
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              {formatChange(change)}
            </span>
            <span>{trendLabel ?? "vs last period"}</span>
          </div>
          <span className="h-1 w-12 rounded-full bg-gray-200 dark:bg-gray-700">
            <span
              className={`block h-1 rounded-full ${isPositive ? "bg-green-600" : "bg-red-500"}`}
              style={{ width: `${Math.min(100, Math.abs(change) * 2)}%` }}
            />
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
