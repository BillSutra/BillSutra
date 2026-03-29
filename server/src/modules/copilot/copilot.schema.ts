import { z } from "zod";

export const copilotSummaryQuerySchema = z.object({
  language: z.enum(["en", "hi", "hinglish"]).optional(),
  amount: z.coerce.number().positive().max(1_000_000).optional(),
});

export const copilotGoalCreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  emoji: z.string().trim().min(1).max(8).optional().nullable(),
  targetAmount: z.coerce.number().positive().max(1_000_000_000),
  currentAmount: z.coerce.number().min(0).max(1_000_000_000).optional(),
  monthlyContributionTarget: z.coerce.number().positive().max(1_000_000_000).optional().nullable(),
  targetDate: z.string().datetime().optional().nullable(),
});

export const copilotGoalUpdateSchema = copilotGoalCreateSchema.partial();

export const copilotGoalParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CopilotSummaryQueryInput = z.infer<typeof copilotSummaryQuerySchema>;
export type CopilotGoalCreateInput = z.infer<typeof copilotGoalCreateSchema>;
export type CopilotGoalUpdateInput = z.infer<typeof copilotGoalUpdateSchema>;
export type CopilotGoalParamInput = z.infer<typeof copilotGoalParamSchema>;
