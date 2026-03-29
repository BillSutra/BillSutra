import { z } from "zod";

export const assistantQuerySchema = z.object({
  message: z.string().trim().min(1).max(500),
  history: z
    .array(
      z.object({
        role: z.enum(["assistant", "user"]),
        content: z.string().trim().min(1).max(500),
      }),
    )
    .max(8)
    .optional(),
});

export type AssistantQueryInput = z.infer<typeof assistantQuerySchema>;
