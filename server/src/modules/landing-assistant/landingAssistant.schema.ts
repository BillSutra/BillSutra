import { z } from "zod";

export const landingAssistantQuerySchema = z.object({
  message: z.string().trim().min(1).max(500),
  language: z.enum(["en", "hi"]).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["assistant", "user"]),
        content: z.string().trim().min(1).max(500),
      }),
    )
    .max(6)
    .optional(),
});

export type LandingAssistantQueryInput = z.infer<
  typeof landingAssistantQuerySchema
>;
