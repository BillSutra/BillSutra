"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  fetchDashboardPaymentMethods,
  type DashboardPaymentMethods,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type DistributionItem = DashboardPaymentMethods["sales"][number];
type PaymentMethodPeriod = DashboardPaymentMethods["period"];

const chartColors = [
  "#f97316",
  "#0f766e",
  "#f59e0b",
  "#1e293b",
  "#e11d48",
  "#2563eb",
];

const paymentMethodLabels: Record<DistributionItem["method"], string> = {
  CASH: "Cash",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

const formatCurrency = (value: number) => `Rs ${value.toLocaleString("en-IN")}`;

const periodLabels: Record<PaymentMethodPeriod, string> = {
  week: "This Week",
  month: "This Month",
  year: "This Year",
};

const PaymentMethodTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DistributionItem }>;
}) => {
  if (!active || !payload?.length) {
    return null;
  }

  const item = payload[0]?.payload;
  if (!item) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[#ecdccf] bg-white p-3 shadow-xl ring-1 ring-black/5">
      <p className="text-sm font-semibold text-[#1f1b16]">
        {paymentMethodLabels[item.method]}
      </p>
      <p className="mt-1 text-xs text-[#8a6d56]">
        Amount: {formatCurrency(item.amount)}
      </p>
      <p className="text-xs text-[#8a6d56]">
        Transactions: {item.count.toLocaleString("en-IN")}
      </p>
    </div>
  );
};

const DistributionCard = ({
  title,
  description,
  emptyMessage,
  data,
  isLoading,
  isError,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  data: DistributionItem[];
  isLoading: boolean;
  isError: boolean;
}) => {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const totalTransactions = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className="dashboard-chart-surface rounded-[1.75rem]">
      <CardHeader className="dashboard-chart-content gap-1">
        <CardTitle className="text-base text-[#1f1b16]">{title}</CardTitle>
        <p className="text-sm text-[#5f5144]">{description}</p>
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-4">
        {isLoading ? (
          <div className="h-[280px] rounded-xl bg-[#fdf7f1] animate-pulse" />
        ) : isError ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[#ecdccf] bg-[#fff9f2] px-4 text-center text-sm text-[#b45309]">
            Unable to load payment method data.
          </div>
        ) : data.length === 0 ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[#ecdccf] bg-[#fff9f2] px-4 text-center text-sm text-[#8a6d56]">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="dashboard-chart-metric rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Total amount
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  Transactions
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  {totalTransactions.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="amount"
                      nameKey="method"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={entry.method}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PaymentMethodTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid content-start gap-2">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                    Legend
                  </p>
                  <p className="text-xs font-medium text-[#6f6257]">
                    Share of amount
                  </p>
                </div>
                {data.map((item, index) => {
                  const share = totalAmount === 0 ? 0 : (item.amount / totalAmount) * 100;

                  return (
                    <div
                      key={item.method}
                      className="dashboard-chart-metric rounded-2xl p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                chartColors[index % chartColors.length],
                            }}
                          />
                          <p className="text-sm font-medium text-[#1f1b16]">
                            {paymentMethodLabels[item.method]}
                          </p>
                        </div>
                        <p className="text-xs font-semibold text-[#5f5144]">
                          {share.toFixed(1)}%
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-[#1f1b16]">
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-xs text-[#5f5144]">
                        {item.count.toLocaleString("en-IN")} transaction(s)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const PaymentMethodDistribution = ({ className }: { className?: string }) => {
  const [period, setPeriod] = useState<PaymentMethodPeriod>("month");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard", "paymentMethods", period],
    queryFn: () => fetchDashboardPaymentMethods(period),
  });

  return (
    <section className={cn("grid gap-4", className)}>
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[#ecdccf] bg-[linear-gradient(135deg,rgba(255,250,244,0.92),rgba(255,255,255,0.88))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
            Payment method distribution
          </p>
          <p className="mt-1 text-sm text-[#5f5144]">
            Breakdown of paid sales and purchases by payment type.
          </p>
        </div>
        <div className="flex w-fit rounded-lg border border-[#ecdccf] bg-[#fdf7f1] p-1">
          {(["week", "month", "year"] as PaymentMethodPeriod[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={period === item ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(item)}
              className={`h-7 px-3 text-xs ${
                period === item
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              }`}
            >
              {periodLabels[item]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionCard
          title="Sales payment methods"
          description={`Collected amount distribution for ${periodLabels[period].toLowerCase()}.`}
          emptyMessage="No recorded sale payments in this period."
          data={data?.sales ?? []}
          isLoading={isLoading}
          isError={isError}
        />
        <DistributionCard
          title="Purchase payment methods"
          description={`Paid amount distribution for ${periodLabels[period].toLowerCase()}.`}
          emptyMessage="No recorded purchase payments in this period."
          data={data?.purchases ?? []}
          isLoading={isLoading}
          isError={isError}
        />
      </div>
    </section>
  );
};

export default PaymentMethodDistribution;
