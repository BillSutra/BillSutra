export const toNumber = (value: unknown) => Number(value ?? 0);

export const roundMetric = (value: number, digits = 0) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

export const startOfDayUtc = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

export const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

export const addMonthsUtc = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));

export const startOfMonthUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

export const endOfMonthExclusiveUtc = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

export const daysBetweenUtc = (left: Date, right: Date) =>
  Math.round(
    (startOfDayUtc(left).getTime() - startOfDayUtc(right).getTime()) /
      (1000 * 60 * 60 * 24),
  );

export const monthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const monthLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

export const daysLeftInMonth = (now: Date) => {
  const nextMonth = endOfMonthExclusiveUtc(now);
  const difference = Math.ceil(
    (nextMonth.getTime() - startOfDayUtc(now).getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(difference, 1);
};

export const standardDeviation = (values: number[]) => {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance);
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

