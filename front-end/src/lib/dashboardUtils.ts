export type CurrencyFormatOptions = {
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
};

const defaultCurrencyOptions: CurrencyFormatOptions = {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
};

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

export const formatNumber = (value: number) =>
  numberFormatter.format(Number.isFinite(value) ? value : 0);

export const formatCurrency = (
  value: number,
  options: CurrencyFormatOptions = defaultCurrencyOptions,
) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  const maxFraction = options.maximumFractionDigits ?? 0;
  const minFraction = options.minimumFractionDigits ?? 0;
  if (maxFraction === 0 && minFraction === 0) {
    return `INR ${currencyFormatter.format(safeValue)}`;
  }
  const formatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: maxFraction,
    minimumFractionDigits: minFraction,
  });
  return `INR ${formatter.format(safeValue)}`;
};

export const formatCompactCurrency = (value: number) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `INR ${compactFormatter.format(safeValue)}`;
};

export const formatPercent = (value: number, digits = 1) => {
  const safeValue = Number.isFinite(value) ? value : 0;
  return `${safeValue.toFixed(digits)}%`;
};

export const sumBy = <T>(
  items: T[],
  getter: (item: T) => number,
) => items.reduce((sum, item) => sum + toNumber(getter(item)), 0);

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatDateLabel = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

export const formatTimeLabel = (value: number | Date) => {
  const parsed = typeof value === "number" ? new Date(value) : value;
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};
