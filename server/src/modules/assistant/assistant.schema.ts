import { z } from "zod";

export const assistantQuerySchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export type AssistantQueryInput = z.infer<typeof assistantQuerySchema>;
