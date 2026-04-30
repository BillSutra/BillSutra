"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { Goal, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useDashboardQuickInsights,
  useFinancialGoalActions,
  useFinancialGoals,
} from "@/hooks/useDashboardQuickInsights";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useI18n } from "@/providers/LanguageProvider";

type PanelLanguage = "en" | "hi";

type PanelCopy = {
  kicker: string;
  title: string;
  description: string;
  insights: string;
  goals: string;
  goalTitle: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  addGoal: string;
  deleteGoal: string;
  emptyGoals: string;
  noInsights: string;
  loadError: string;
  createSuccess: string;
  createError: string;
  deleteSuccess: string;
  deleteError: string;
};

const buildCopy = (language: PanelLanguage): PanelCopy =>
  language === "hi"
    ? {
        kicker: "Quick insights",
        title: "Tez business signals",
        description:
          "Yeh section bina AI wait ke sales, collections, stock, aur daily pressure points ko turant highlight karta hai.",
        insights: "Aaj ke focus points",
        goals: "Financial goals",
        goalTitle: "Goal title",
        targetAmount: "Target amount",
        currentAmount: "Current saved",
        monthlyContribution: "Monthly contribution",
        addGoal: "Goal joden",
        deleteGoal: "Hatayein",
        emptyGoals:
          "Abhi koi goal nahi hai. Ek chhota target jodkar tracking shuru karein.",
        noInsights:
          "Abhi koi urgent insight nahi hai. Core business metrics stable dikh rahe hain.",
        loadError: "Quick insights load nahi ho paaye.",
        createSuccess: "Goal add ho gaya.",
        createError: "Goal save nahi ho paya.",
        deleteSuccess: "Goal hat gaya.",
        deleteError: "Goal hat nahi paya.",
      }
    : {
        kicker: "Quick insights",
        title: "Fast business signals",
        description:
          "This section surfaces useful sales, collections, stock, and operating pressure points instantly, without any AI wait state.",
        insights: "Today's focus points",
        goals: "Financial goals",
        goalTitle: "Goal title",
        targetAmount: "Target amount",
        currentAmount: "Current saved",
        monthlyContribution: "Monthly contribution",
        addGoal: "Add goal",
        deleteGoal: "Delete",
        emptyGoals: "No goals yet. Add a small target to start tracking progress.",
        noInsights: "No urgent insights right now. Core business metrics look stable.",
        loadError: "Unable to load quick insights.",
        createSuccess: "Goal added.",
        createError: "Unable to save goal.",
        deleteSuccess: "Goal removed.",
        deleteError: "Unable to remove goal.",
      };

const toneStyles: Record<
  "positive" | "warning" | "critical" | "info",
  string
> = {
  positive:
    "border-emerald-200/70 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100",
  warning:
    "border-amber-200/70 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100",
  critical:
    "border-rose-200/70 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-100",
  info: "border-sky-200/70 bg-sky-50/70 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100",
};

const QuickInsightsPanel = ({ className }: { className?: string }) => {
  const { language, formatCurrency, formatDate } = useI18n();
  const uiLanguage: PanelLanguage = language === "hi" ? "hi" : "en";
  const copy = useMemo(() => buildCopy(uiLanguage), [uiLanguage]);
  const [goalForm, setGoalForm] = useState({
    title: "",
    targetAmount: "",
    currentAmount: "",
    monthlyContributionTarget: "",
  });

  const { data, isLoading, isError, dataUpdatedAt, isFetching } =
    useDashboardQuickInsights({
      language: uiLanguage,
      range: "30d",
    });
  const { data: goals = [], isFetching: goalsFetching } = useFinancialGoals();
  const { createGoalMutation, deleteGoalMutation } = useFinancialGoalActions();

  const handleCreateGoal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const targetAmount = Number(goalForm.targetAmount);
    if (!goalForm.title.trim() || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      toast.error(copy.createError);
      return;
    }

    try {
      const currentAmount = Number(goalForm.currentAmount);
      const monthlyContributionTarget = Number(goalForm.monthlyContributionTarget);
      await createGoalMutation.mutateAsync({
        title: goalForm.title.trim(),
        targetAmount,
        currentAmount:
          goalForm.currentAmount && Number.isFinite(currentAmount) ? currentAmount : 0,
        monthlyContributionTarget:
          goalForm.monthlyContributionTarget &&
          Number.isFinite(monthlyContributionTarget)
            ? monthlyContributionTarget
            : null,
      });
      setGoalForm({
        title: "",
        targetAmount: "",
        currentAmount: "",
        monthlyContributionTarget: "",
      });
      toast.success(copy.createSuccess);
    } catch {
      toast.error(copy.createError);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    try {
      await deleteGoalMutation.mutateAsync(goalId);
      toast.success(copy.deleteSuccess);
    } catch {
      toast.error(copy.deleteError);
    }
  };

  return (
    <Card
      className={`dashboard-chart-surface flex flex-col rounded-[1.75rem] ${className ?? ""}`}
    >
      <CardHeader className="dashboard-chart-content">
        <p className="text-xs uppercase tracking-[0.26em] text-[#8a6d56]">{copy.kicker}</p>
        <CardTitle className="mt-2 text-2xl text-[#1f1b16]">{copy.title}</CardTitle>
        <p className="mt-2 max-w-3xl text-sm text-[#8a6d56]">{copy.description}</p>
        <DashboardCardStatus
          isLoading={isLoading}
          isFetching={isFetching || goalsFetching}
          isError={isError}
          dataUpdatedAt={dataUpdatedAt}
          refreshIntervalMs={DASHBOARD_REFRESH_INTERVAL_MS}
        />
      </CardHeader>

      <CardContent className="dashboard-chart-content flex min-h-0 flex-1 flex-col gap-5">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#fdf7f1]" />
        ) : isError || !data ? (
          <p className="text-sm text-[#b45309]">{copy.loadError}</p>
        ) : (
          <>
            <div className="rounded-2xl border border-[#eadfd2] bg-[#fff9f4] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-current/10 bg-white/70 p-3 text-[#8a6d56]">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1f1b16]">{data.headline}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5f5144]">{data.summary}</p>
                </div>
              </div>
            </div>

            <section className="grid gap-4">
              <div className="flex items-center gap-2">
                <Goal size={16} className="text-[#8a6d56]" />
                <p className="text-sm font-semibold text-[#1f1b16]">{copy.insights}</p>
              </div>
              {data.items.length === 0 ? (
                <div className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4 text-sm text-[#5f5144]">
                  {copy.noInsights}
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.actionUrl}
                      className={`rounded-2xl border p-4 transition hover:translate-y-[-1px] ${toneStyles[item.tone]}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-2 text-sm leading-6">{item.message}</p>
                        </div>
                        <Badge className="rounded-full bg-white/70 text-current shadow-none">
                          {item.tone}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-sky-700" />
                  <p className="text-sm font-semibold text-[#1f1b16]">{copy.goals}</p>
                </div>

                <div className="mt-4 grid gap-3">
                  {goals.length === 0 ? (
                    <div className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4 text-sm text-[#5f5144]">
                      {copy.emptyGoals}
                    </div>
                  ) : (
                    goals.map((goal) => {
                      const progress =
                        goal.targetAmount > 0
                          ? Math.min(
                              100,
                              Math.round((goal.currentAmount / goal.targetAmount) * 100),
                            )
                          : 0;

                      return (
                        <div
                          key={goal.id}
                          className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#1f1b16]">
                                {goal.emoji ? `${goal.emoji} ` : ""}
                                {goal.title}
                              </p>
                              <p className="mt-1 text-sm text-[#5f5144]">
                                {formatCurrency(goal.currentAmount, "INR", {
                                  maximumFractionDigits: 0,
                                })}{" "}
                                /{" "}
                                {formatCurrency(goal.targetAmount, "INR", {
                                  maximumFractionDigits: 0,
                                })}
                              </p>
                              {goal.targetDate ? (
                                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#8a6d56]">
                                  {formatDate(goal.targetDate, {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                              ) : null}
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="rounded-full text-[#8a6d56] hover:text-rose-600"
                              onClick={() => void handleDeleteGoal(goal.id)}
                              disabled={deleteGoalMutation.isPending}
                              aria-label={copy.deleteGoal}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>

                          <div className="mt-4 h-2 rounded-full bg-[#f2e5d9]">
                            <div
                              className="h-full rounded-full bg-[#4f7cff] transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>

                          {goal.monthlyContributionTarget ? (
                            <p className="mt-3 text-xs text-[#8a6d56]">
                              {copy.monthlyContribution}:{" "}
                              {formatCurrency(goal.monthlyContributionTarget, "INR", {
                                maximumFractionDigits: 0,
                              })}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <p className="text-sm font-semibold text-[#1f1b16]">{copy.addGoal}</p>
                <form className="mt-4 grid gap-3" onSubmit={handleCreateGoal}>
                  <Input
                    value={goalForm.title}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder={copy.goalTitle}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalForm.targetAmount}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        targetAmount: event.target.value,
                      }))
                    }
                    placeholder={copy.targetAmount}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalForm.currentAmount}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        currentAmount: event.target.value,
                      }))
                    }
                    placeholder={copy.currentAmount}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={goalForm.monthlyContributionTarget}
                    onChange={(event) =>
                      setGoalForm((current) => ({
                        ...current,
                        monthlyContributionTarget: event.target.value,
                      }))
                    }
                    placeholder={copy.monthlyContribution}
                  />
                  <Button type="submit" disabled={createGoalMutation.isPending}>
                    {copy.addGoal}
                  </Button>
                </form>
              </section>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickInsightsPanel;
