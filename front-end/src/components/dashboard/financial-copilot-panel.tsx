"use client";

import React, { useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CalendarClock,
  PiggyBank,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import DashboardCardStatus from "@/components/dashboard/DashboardCardStatus";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFinancialCopilot, useFinancialGoalActions } from "@/hooks/useFinancialCopilot";
import { DASHBOARD_REFRESH_INTERVAL_MS } from "@/lib/dashboardRefresh";
import { useI18n } from "@/providers/LanguageProvider";

type PanelLanguage = "en" | "hi";

type PanelCopy = {
  kicker: string;
  title: string;
  description: string;
  safeBudget: string;
  safeRoom: string;
  healthScore: string;
  behavior: string;
  nudges: string;
  savings: string;
  reminders: string;
  goals: string;
  goalTitle: string;
  targetAmount: string;
  currentAmount: string;
  monthlyContribution: string;
  addGoal: string;
  deleteGoal: string;
  decisionTitle: string;
  decisionPlaceholder: string;
  decisionButton: string;
  noGoals: string;
  healthAction: string;
  healthBand: string;
  reserveLabel: string;
  balanceLabel: string;
  examples: string;
  createSuccess: string;
  createError: string;
  deleteSuccess: string;
  deleteError: string;
  invalidAmount: string;
  noBehaviorInsights: string;
  loadError: string;
  verdict: Record<"safe" | "warning" | "risky", string>;
  bands: Record<"excellent" | "good" | "needs_improvement" | "poor", string>;
};

const buildCopy = (language: PanelLanguage): PanelCopy =>
  language === "hi"
    ? {
        kicker: "AI copilot",
        title: "Proactive finance companion",
        description:
          "यह layer सिर्फ report नहीं करती, बल्कि budget, savings, habits, goals और spending decisions को आगे से guide करती है.",
        safeBudget: "Safe budget",
        safeRoom: "Safe room left",
        healthScore: "Health score",
        behavior: "Behavior insights",
        nudges: "Daily nudges",
        savings: "Savings ideas",
        reminders: "Bill reminders",
        goals: "Goals",
        goalTitle: "Goal title",
        targetAmount: "Target amount",
        currentAmount: "Current saved",
        monthlyContribution: "Monthly contribution",
        addGoal: "Goal जोड़ें",
        deleteGoal: "हटाएँ",
        decisionTitle: "Can I afford this?",
        decisionPlaceholder: "जैसे 10000",
        decisionButton: "Check affordability",
        noGoals: "अभी कोई goal नहीं है. एक छोटा goal set कीजिए.",
        healthAction: "Next best action",
        healthBand: "Band",
        reserveLabel: "Upcoming bills",
        balanceLabel: "Projected balance",
        examples: "Try asking",
        createSuccess: "Goal add हो गया.",
        createError: "Goal save नहीं हो पाया.",
        deleteSuccess: "Goal हट गया.",
        deleteError: "Goal हट नहीं पाया.",
        invalidAmount: "एक valid amount डालिए.",
        noBehaviorInsights:
          "अभी enough pattern नहीं मिला. जैसे-जैसे और transactions आएंगे, यहाँ personal insights दिखेंगे.",
        loadError: "Financial copilot load नहीं हो पाया.",
        verdict: {
          safe: "Comfortable",
          warning: "Tight",
          risky: "Risky",
        },
        bands: {
          excellent: "Excellent",
          good: "Good",
          needs_improvement: "Needs improvement",
          poor: "Poor",
        },
      }
    : {
        kicker: "AI copilot",
        title: "Proactive finance companion",
        description:
          "This layer looks ahead and guides budgets, savings, habits, goals, reminders, and spending decisions.",
        safeBudget: "Safe budget",
        safeRoom: "Safe room left",
        healthScore: "Health score",
        behavior: "Behavior insights",
        nudges: "Daily nudges",
        savings: "Savings ideas",
        reminders: "Bill reminders",
        goals: "Goals",
        goalTitle: "Goal title",
        targetAmount: "Target amount",
        currentAmount: "Current saved",
        monthlyContribution: "Monthly contribution",
        addGoal: "Add goal",
        deleteGoal: "Delete",
        decisionTitle: "Can I afford this?",
        decisionPlaceholder: "For example 10000",
        decisionButton: "Check affordability",
        noGoals: "No goals yet. Set one small goal to start tracking.",
        healthAction: "Next best action",
        healthBand: "Band",
        reserveLabel: "Upcoming bills",
        balanceLabel: "Projected balance",
        examples: "Try asking",
        createSuccess: "Goal added.",
        createError: "Unable to save goal.",
        deleteSuccess: "Goal removed.",
        deleteError: "Unable to remove goal.",
        invalidAmount: "Enter a valid amount.",
        noBehaviorInsights:
          "Not enough behavior patterns yet. As more transactions come in, this section will get more personal.",
        loadError: "Unable to load the financial copilot.",
        verdict: {
          safe: "Comfortable",
          warning: "Tight",
          risky: "Risky",
        },
        bands: {
          excellent: "Excellent",
          good: "Good",
          needs_improvement: "Needs improvement",
          poor: "Poor",
        },
      };

const verdictBadgeClass = (verdict: "safe" | "warning" | "risky") => {
  if (verdict === "safe") {
    return "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (verdict === "warning") {
    return "bg-amber-500/14 text-amber-700 dark:bg-amber-500/15 dark:text-amber-100";
  }

  return "bg-rose-500/12 text-rose-700 dark:bg-rose-500/15 dark:text-rose-100";
};

const insightToneClass = (priority: "high" | "medium" | "low") => {
  if (priority === "high") {
    return "border-rose-200/70 bg-rose-50/60 dark:border-rose-500/20 dark:bg-rose-500/10";
  }

  if (priority === "medium") {
    return "border-amber-200/70 bg-amber-50/60 dark:border-amber-500/20 dark:bg-amber-500/10";
  }

  return "border-sky-200/70 bg-sky-50/60 dark:border-sky-500/20 dark:bg-sky-500/10";
};

const FinancialCopilotPanel = ({ className }: { className?: string }) => {
  const { language, formatCurrency, formatDate } = useI18n();
  const uiLanguage: PanelLanguage = language === "hi" ? "hi" : "en";
  const copy = useMemo(() => buildCopy(uiLanguage), [uiLanguage]);
  const copilotLanguage = language === "hi" ? "hi" : "en";
  const [decisionInput, setDecisionInput] = useState("");
  const [decisionAmount, setDecisionAmount] = useState<number | undefined>(undefined);
  const [goalForm, setGoalForm] = useState({
    title: "",
    targetAmount: "",
    currentAmount: "",
    monthlyContributionTarget: "",
  });

  const { data, isLoading, isError, dataUpdatedAt, isFetching } = useFinancialCopilot({
    language: copilotLanguage,
    amount: decisionAmount,
  });
  const { createGoalMutation, deleteGoalMutation } = useFinancialGoalActions(copilotLanguage);

  const metricCards = data
    ? [
        {
          label: copy.safeBudget,
          value: formatCurrency(data.budget.suggestedMonthlyBudget, "INR", {
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
          }),
          icon: Wallet,
        },
        {
          label: copy.safeRoom,
          value: formatCurrency(Math.max(data.budget.remainingSafeToSpend, 0), "INR", {
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
          }),
          icon: ShieldCheck,
        },
        {
          label: copy.healthScore,
          value: `${data.healthScore.score}/100`,
          icon: BrainCircuit,
        },
      ]
    : [];

  const handleDecisionCheck = () => {
    const parsed = Number(decisionInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error(copy.invalidAmount);
      return;
    }

    setDecisionAmount(parsed);
  };

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
          isFetching={isFetching}
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
            <div className="grid gap-4 lg:grid-cols-3">
              {metricCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="dashboard-chart-metric rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                          {card.label}
                        </p>
                        <p className="mt-3 text-xl font-semibold text-[#1f1b16]">{card.value}</p>
                      </div>
                      <div className="rounded-2xl border border-current/10 bg-white/70 p-3">
                        <Icon size={18} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-[#eadfd2] bg-[#fff9f4] p-4">
              <p className="text-sm font-semibold text-[#1f1b16]">{data.overview.headline}</p>
              <p className="mt-2 text-sm leading-6 text-[#5f5144]">{data.overview.summary}</p>
              <p className="mt-2 text-sm font-medium text-[#8a6d56]">{data.overview.action}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.examples.slice(0, 4).map((example) => (
                  <Badge key={example} className="rounded-full bg-white/80">
                    {example}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <PiggyBank size={16} className="text-emerald-700" />
                  <p className="text-sm font-semibold text-[#1f1b16]">{copy.savings}</p>
                </div>
                <p className="mt-2 text-sm text-[#5f5144]">{data.savings.summary}</p>
                <div className="mt-4 grid gap-3">
                  {data.savings.opportunities.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1b16]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#5f5144]">{item.description}</p>
                        </div>
                        <Badge className="rounded-full">
                          {formatCurrency(item.potentialMonthlySavings, "INR", {
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0,
                          })}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <CalendarClock size={16} className="text-amber-700" />
                  <p className="text-sm font-semibold text-[#1f1b16]">{copy.reminders}</p>
                </div>
                <p className="mt-2 text-sm text-[#5f5144]">{data.reminders.summary}</p>
                <div className="mt-4 grid gap-3">
                  {data.reminders.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1b16]">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-[#5f5144]">{item.description}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                            {item.dueDate
                              ? formatDate(item.dueDate, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "--"}
                          </p>
                        </div>
                        <Badge className="rounded-full">
                          {formatCurrency(item.monthlyAmount, "INR", {
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0,
                          })}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-sky-700" />
                  <p className="text-sm font-semibold text-[#1f1b16]">{copy.behavior}</p>
                </div>
                <p className="mt-2 text-sm text-[#5f5144]">{data.behaviorInsights.summary}</p>
                <div className="mt-4 grid gap-3">
                  {data.behaviorInsights.items.length === 0 ? (
                    <div className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4 text-sm text-[#5f5144]">
                      {copy.noBehaviorInsights}
                    </div>
                  ) : (
                    data.behaviorInsights.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 ${insightToneClass(item.priority)}`}
                      >
                        <p className="text-sm font-semibold text-[#1f1b16]">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[#5f5144]">{item.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-sky-700" />
                  <p className="text-sm font-semibold text-[#1f1b16]">{copy.nudges}</p>
                </div>
                <div className="mt-3 grid gap-3">
                  {data.nudges.map((nudge) => (
                    <div key={nudge.id} className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4">
                      <p className="text-sm font-medium text-[#1f1b16]">{nudge.message}</p>
                      <p className="mt-1 text-sm text-[#8a6d56]">{nudge.action}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <BrainCircuit size={16} className="text-emerald-700" />
                    <p className="text-sm font-semibold text-[#1f1b16]">{copy.healthScore}</p>
                  </div>
                  <Badge className="rounded-full bg-white/80">
                    {copy.bands[data.healthScore.band]}
                  </Badge>
                </div>
                <p className="mt-3 text-sm text-[#5f5144]">{data.healthScore.summary}</p>
                <p className="mt-1 text-sm font-medium text-[#8a6d56]">
                  {copy.healthAction}: {data.healthScore.nextBestAction}
                </p>
                <div className="mt-4 grid gap-3">
                  {data.healthScore.breakdown.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between gap-3 text-xs text-[#8a6d56]">
                        <span>{item.label}</span>
                        <span>
                          {item.score}/{item.outOf}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-[#efe2d7]">
                        <div
                          className="h-2 rounded-full bg-[#c97b4b]"
                          style={{ width: `${Math.min((item.score / item.outOf) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
                <p className="text-sm font-semibold text-[#1f1b16]">{copy.decisionTitle}</p>
                <p className="mt-2 text-sm text-[#5f5144]">{data.budget.action}</p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={decisionInput}
                    onChange={(event) => setDecisionInput(event.target.value)}
                    placeholder={copy.decisionPlaceholder}
                    inputMode="numeric"
                  />
                  <Button onClick={handleDecisionCheck}>{copy.decisionButton}</Button>
                </div>
                {data.decision ? (
                  <div className="mt-4 rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1f1b16]">{data.decision.summary}</p>
                      <Badge
                        className={`rounded-full ${verdictBadgeClass(data.decision.verdict)}`}
                      >
                        {copy.verdict[data.decision.verdict]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5f5144]">
                      {data.decision.explanation}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[#efe2d7] bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {copy.safeRoom}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                          {formatCurrency(Math.max(data.decision.safeRoomAfterPurchase, 0), "INR", {
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#efe2d7] bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {copy.reserveLabel}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                          {formatCurrency(data.decision.reserveForUpcomingExpenses, "INR", {
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#efe2d7] bg-white/70 p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                          {copy.balanceLabel}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[#1f1b16]">
                          {formatCurrency(data.decision.projectedClosingBalance, "INR", {
                            maximumFractionDigits: 0,
                            minimumFractionDigits: 0,
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="rounded-2xl border border-[#eadfd2] bg-white/70 p-4">
              <p className="text-sm font-semibold text-[#1f1b16]">{copy.goals}</p>
              <p className="mt-2 text-sm text-[#5f5144]">{data.goals.summary}</p>

              <form onSubmit={handleCreateGoal} className="mt-4 grid gap-3 lg:grid-cols-4">
                <Input
                  name="title"
                  value={goalForm.title}
                  onChange={(event) =>
                    setGoalForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder={copy.goalTitle}
                />
                <Input
                  name="targetAmount"
                  value={goalForm.targetAmount}
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      targetAmount: event.target.value,
                    }))
                  }
                  placeholder={copy.targetAmount}
                  inputMode="numeric"
                />
                <Input
                  name="currentAmount"
                  value={goalForm.currentAmount}
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      currentAmount: event.target.value,
                    }))
                  }
                  placeholder={copy.currentAmount}
                  inputMode="numeric"
                />
                <Input
                  name="monthlyContributionTarget"
                  value={goalForm.monthlyContributionTarget}
                  onChange={(event) =>
                    setGoalForm((current) => ({
                      ...current,
                      monthlyContributionTarget: event.target.value,
                    }))
                  }
                  placeholder={copy.monthlyContribution}
                  inputMode="numeric"
                />
                <div className="lg:col-span-4">
                  <Button
                    type="submit"
                    disabled={createGoalMutation.isPending}
                    className="w-full sm:w-auto"
                  >
                    {copy.addGoal}
                  </Button>
                </div>
              </form>

              <div className="mt-5 grid gap-3">
                {data.goals.items.length === 0 ? (
                  <div className="app-empty-state px-4 py-6 text-sm">{copy.noGoals}</div>
                ) : (
                  data.goals.items.map((goal) => (
                    <div key={goal.id} className="rounded-2xl border border-[#efe2d7] bg-[#fffaf6] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1b16]">
                            {goal.emoji ? `${goal.emoji} ` : ""}
                            {goal.title}
                          </p>
                          <p className="mt-1 text-sm text-[#5f5144]">{goal.summary}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                            {formatCurrency(goal.currentAmount, "INR", {
                              maximumFractionDigits: 0,
                              minimumFractionDigits: 0,
                            })}{" "}
                            /{" "}
                            {formatCurrency(goal.targetAmount, "INR", {
                              maximumFractionDigits: 0,
                              minimumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGoal(goal.id)}
                          disabled={deleteGoalMutation.isPending}
                          aria-label={copy.deleteGoal}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-[#efe2d7]">
                        <div
                          className="h-2 rounded-full bg-[#c97b4b]"
                          style={{ width: `${Math.min(goal.progressPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default FinancialCopilotPanel;
