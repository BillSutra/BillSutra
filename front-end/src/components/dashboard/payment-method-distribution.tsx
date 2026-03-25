"use client";

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import {
  fetchDashboardPaymentMethods,
  type DashboardPaymentMethods,
} from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import DashboardResponsiveChart from "@/components/dashboard/DashboardResponsiveChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  sumBy,
} from "@/lib/dashboardUtils";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { dashboardQueryDefaults, DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useI18n } from "@/providers/LanguageProvider";

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

const PaymentMethodTooltip = ({
  active,
  payload,
  labels,
  t,
}: {
  active?: boolean;
  payload?: Array<{ payload: DistributionItem }>;
  labels: Record<DistributionItem["method"], string>;
  t: (key: string, params?: Record<string, string | number>) => string;
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
        {labels[item.method]}
      </p>
      <p className="mt-1 text-xs text-[#8a6d56]">
        {t("dashboard.paymentMethods.amountLabel", {
          amount: formatCurrency(item.amount),
        })}
      </p>
      <p className="text-xs text-[#8a6d56]">
        {t("dashboard.paymentMethods.transactionsLabel", {
          count: formatNumber(item.count),
        })}
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
  status,
  paymentMethodLabels,
  t,
}: {
  title: string;
  description: string;
  emptyMessage: string;
  data: DistributionItem[];
  isLoading: boolean;
  isError: boolean;
  status: {
    isFetching?: boolean;
    isLoading?: boolean;
    isError?: boolean;
    dataUpdatedAt?: number;
    refreshIntervalMs?: number;
  };
  paymentMethodLabels: Record<DistributionItem["method"], string>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) => {
  const totals = useMemo(() => {
    return {
      totalAmount: sumBy(data, (item) => item.amount),
      totalTransactions: sumBy(data, (item) => item.count),
    };
  }, [data]);
  const topMethod = data[0];
  const topMethodShare =
    topMethod && totals.totalAmount > 0
      ? (topMethod.amount / totals.totalAmount) * 100
      : 0;

  return (
    <Card className="dashboard-chart-surface rounded-[1.75rem]">
      <CardHeader className="dashboard-chart-content gap-2">
        <CardTitle className="text-base text-[#1f1b16]">{title}</CardTitle>
        <p className="max-w-xl text-sm leading-6 text-[#5f5144]">{description}</p>
        <DashboardCardStatus
          isLoading={status.isLoading}
          isFetching={status.isFetching}
          isError={status.isError}
          dataUpdatedAt={status.dataUpdatedAt}
          refreshIntervalMs={status.refreshIntervalMs}
        />
      </CardHeader>
      <CardContent className="dashboard-chart-content grid gap-4">
        {isLoading ? (
          <div className="h-[280px] rounded-xl bg-[#fdf7f1] animate-pulse" />
        ) : isError ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-[#ecdccf] bg-[#fff9f2] px-4 text-center text-sm text-[#b45309]">
            {t("dashboard.paymentMethods.loadError")}
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
                  {t("dashboard.paymentMethods.totalAmount")}
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  {formatCurrency(totals.totalAmount)}
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  {t("dashboard.paymentMethods.transactions")}
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  {formatNumber(totals.totalTransactions)}
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl p-4 sm:col-span-2 xl:col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  {t("dashboard.paymentMethods.topMethod")}
                </p>
                <p className="mt-2 text-lg font-semibold text-[#1f1b16]">
                  {topMethod
                    ? paymentMethodLabels[topMethod.method]
                    : t("dashboard.paymentMethods.none")}
                </p>
                <p className="mt-1 text-xs text-[#5f5144]">
                  {t("dashboard.paymentMethods.topMethodShare", {
                    share: topMethod ? formatPercent(topMethodShare) : "0.0%",
                  })}
                </p>
              </div>
            </div>

            <div className="grid gap-5">
              <div className="mx-auto h-56 w-full max-w-[220px] min-w-0">
                <DashboardResponsiveChart>
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
                    <Tooltip
                      content={
                        <PaymentMethodTooltip
                          labels={paymentMethodLabels}
                          t={t}
                        />
                      }
                    />
                  </PieChart>
                </DashboardResponsiveChart>
              </div>

              <div className="grid content-start gap-2.5">
                <div className="flex items-center justify-between gap-3 px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
                    {t("dashboard.paymentMethods.paymentMix")}
                  </p>
                  <p className="shrink-0 text-[11px] font-medium uppercase tracking-[0.14em] text-[#6f6257]">
                    {t("dashboard.paymentMethods.shareOfAmount")}
                  </p>
                </div>
                {data.map((item, index) => {
                  const share =
                    totals.totalAmount === 0
                      ? 0
                      : (item.amount / totals.totalAmount) * 100;

                  return (
                    <div
                      key={item.method}
                      className="dashboard-chart-metric rounded-2xl p-3.5"
                    >
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              chartColors[index % chartColors.length],
                          }}
                        />
                        <p className="truncate text-sm font-medium text-[#1f1b16]">
                          {paymentMethodLabels[item.method]}
                        </p>
                        <p className="text-xs font-semibold text-[#5f5144]">
                          {formatPercent(share)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1f1b16]">
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="text-xs text-[#5f5144]">
                          {t("dashboard.paymentMethods.transactionCount", {
                            count: formatNumber(item.count),
                          })}
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#f2e6dc]">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${share === 0 ? 0 : Math.max(share, 4)}%`,
                            backgroundColor: chartColors[index % chartColors.length],
                          }}
                        />
                      </div>
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
  const { t } = useI18n();
  const [period, setPeriod] = useState<PaymentMethodPeriod>("month");

  const paymentMethodLabels: Record<DistributionItem["method"], string> = {
    CASH: t("dashboard.enums.paymentMethod.CASH"),
    CARD: t("dashboard.enums.paymentMethod.CARD"),
    BANK_TRANSFER: t("dashboard.enums.paymentMethod.BANK_TRANSFER"),
    UPI: t("dashboard.enums.paymentMethod.UPI"),
    CHEQUE: t("dashboard.enums.paymentMethod.CHEQUE"),
    OTHER: t("dashboard.enums.paymentMethod.OTHER"),
  };

  const periodLabels: Record<PaymentMethodPeriod, string> = {
    week: t("dashboard.paymentMethods.periodWeek"),
    month: t("dashboard.paymentMethods.periodMonth"),
    year: t("dashboard.paymentMethods.periodYear"),
  };

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useQuery({
    queryKey: ["dashboard", "paymentMethods", period],
    queryFn: () => fetchDashboardPaymentMethods(period),
    ...dashboardQueryDefaults,
  });

  return (
    <section className={cn("grid gap-4", className)}>
      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-[#ecdccf] bg-[linear-gradient(135deg,rgba(255,250,244,0.92),rgba(255,255,255,0.88))] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f5744]">
            {t("dashboard.paymentMethods.sectionKicker")}
          </p>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#5f5144]">
            {t("dashboard.paymentMethods.sectionDescription")}
          </p>
        </div>
        <div className="flex w-full rounded-lg border border-[#ecdccf] bg-[#fdf7f1] p-1 sm:w-fit">
          {(Object.keys(periodLabels) as PaymentMethodPeriod[]).map((item) => (
            <Button
              key={item}
              type="button"
              variant={period === item ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(item)}
              className={`h-8 px-3 text-xs ${
                period === item
                  ? "bg-[#1f1b16] text-white hover:bg-[#1f1b16]/90"
                  : "text-[#5c4b3b] hover:bg-[#fff9f2] hover:text-[#1f1b16]"
              } flex-1 sm:flex-none`}
            >
              {periodLabels[item]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionCard
          title={t("dashboard.paymentMethods.salesTitle")}
          description={t("dashboard.paymentMethods.salesDescription", {
            period: periodLabels[period],
          })}
          emptyMessage={t("dashboard.paymentMethods.salesEmpty")}
          data={data?.sales ?? []}
          isLoading={isLoading}
          isError={isError}
          status={{
            isLoading,
            isFetching,
            isError,
            dataUpdatedAt,
            refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
          }}
          paymentMethodLabels={paymentMethodLabels}
          t={t}
        />
        <DistributionCard
          title={t("dashboard.paymentMethods.purchasesTitle")}
          description={t("dashboard.paymentMethods.purchasesDescription", {
            period: periodLabels[period],
          })}
          emptyMessage={t("dashboard.paymentMethods.purchasesEmpty")}
          data={data?.purchases ?? []}
          isLoading={isLoading}
          isError={isError}
          status={{
            isLoading,
            isFetching,
            isError,
            dataUpdatedAt,
            refreshIntervalMs: DASHBOARD_REFRESH_INTERVAL_MS,
          }}
          paymentMethodLabels={paymentMethodLabels}
          t={t}
        />
      </div>
    </section>
  );
};

export default PaymentMethodDistribution;
