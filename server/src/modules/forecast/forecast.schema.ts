import { z } from "zod";

export const forecastQuerySchema = z.object({
    period: z
        .enum(["weekly", "monthly", "yearly"])
        .default("monthly")
        .optional(),
});

export type ForecastQueryInput = z.infer<typeof forecastQuerySchema>;
