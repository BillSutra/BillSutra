"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialGoal,
  deleteFinancialGoal,
  fetchDashboardQuickInsights,
  fetchFinancialGoals,
  type DashboardQuickInsightsResponse,
  type FinancialGoalInput,
  type FinancialGoalRecord,
} from "@/lib/apiClient";
import { dashboardRetryDelay } from "@/lib/dashboardRefresh";

const QUICK_INSIGHTS_STALE_MS = 60 * 1000;
const FINANCIAL_GOALS_STALE_MS = 5 * 60 * 1000;

export const dashboardQuickInsightsQueryKey = (
  language: "en" | "hi",
  range = "30d",
) => ["dashboard-quick-insights", language, range] as const;

export const financialGoalsQueryKey = ["financial-goals"] as const;

export const useDashboardQuickInsights = (params: {
  language: "en" | "hi";
  range?: "7d" | "30d" | "90d" | "ytd" | "custom";
}) =>
  useQuery<DashboardQuickInsightsResponse>({
    queryKey: dashboardQuickInsightsQueryKey(
      params.language,
      params.range ?? "30d",
    ),
    queryFn: () => fetchDashboardQuickInsights(params),
    staleTime: QUICK_INSIGHTS_STALE_MS,
    gcTime: QUICK_INSIGHTS_STALE_MS * 2,
    retry: 2,
    retryDelay: dashboardRetryDelay,
  });

export const useFinancialGoals = () =>
  useQuery<FinancialGoalRecord[]>({
    queryKey: financialGoalsQueryKey,
    queryFn: fetchFinancialGoals,
    staleTime: FINANCIAL_GOALS_STALE_MS,
    gcTime: FINANCIAL_GOALS_STALE_MS * 2,
    retry: 2,
    retryDelay: dashboardRetryDelay,
  });

export const useFinancialGoalActions = () => {
  const queryClient = useQueryClient();

  const invalidateGoals = () =>
    queryClient.invalidateQueries({ queryKey: financialGoalsQueryKey });

  const createGoalMutation = useMutation({
    mutationFn: (payload: FinancialGoalInput) => createFinancialGoal(payload),
    onSuccess: invalidateGoals,
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: number) => deleteFinancialGoal(id),
    onSuccess: invalidateGoals,
  });

  return {
    createGoalMutation,
    deleteGoalMutation,
  };
};
