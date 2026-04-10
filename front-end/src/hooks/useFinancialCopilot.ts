"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialGoal,
  deleteFinancialGoal,
  fetchFinancialCopilot,
  type FinancialCopilotPayload,
  type FinancialGoalInput,
} from "@/lib/apiClient";
import { dashboardRetryDelay } from "@/lib/dashboardRefresh";

const COPILOT_STALE_MS = 5 * 60 * 1000;

export const financialCopilotQueryKey = (
  language: "en" | "hi",
  amount?: number,
) => ["financial-copilot", language, amount ?? null] as const;

export const useFinancialCopilot = (params: {
  language: "en" | "hi";
  amount?: number;
}) =>
  useQuery<FinancialCopilotPayload>({
    queryKey: financialCopilotQueryKey(params.language, params.amount),
    queryFn: () => fetchFinancialCopilot(params),
    staleTime: COPILOT_STALE_MS,
    gcTime: COPILOT_STALE_MS * 2,
    retry: 3,
    retryDelay: dashboardRetryDelay,
  });

export const useFinancialGoalActions = (language: "en" | "hi") => {
  const queryClient = useQueryClient();

  const invalidateCopilot = () =>
    queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "financial-copilot" &&
        query.queryKey[1] === language,
    });

  const createGoalMutation = useMutation({
    mutationFn: (payload: FinancialGoalInput) => createFinancialGoal(payload),
    onSuccess: invalidateCopilot,
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: number) => deleteFinancialGoal(id),
    onSuccess: invalidateCopilot,
  });

  return {
    createGoalMutation,
    deleteGoalMutation,
  };
};
