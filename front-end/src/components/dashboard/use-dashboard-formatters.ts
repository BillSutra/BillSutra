"use client";

import { useCallback } from "react";
import { useI18n } from "@/providers/LanguageProvider";

const humanizeEnum = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

export const useDashboardFormatters = () => {
  const { formatCurrency, formatDate, formatNumber, t, safeT } = useI18n();
  const currencyCode = t("common.currencyCode");

  const currency = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      formatCurrency(value, currencyCode, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        ...options,
      }),
    [currencyCode, formatCurrency],
  );

  const currencyWithDecimals = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      formatCurrency(value, currencyCode, options),
    [currencyCode, formatCurrency],
  );

  const compactCurrency = useCallback(
    (value: number) =>
      `${currencyCode} ${formatNumber(value, {
        notation: "compact",
        maximumFractionDigits: 1,
      })}`,
    [currencyCode, formatNumber],
  );

  const number = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumber(value, options),
    [formatNumber],
  );

  const dateLabel = useCallback(
    (value: string | number | Date) =>
      formatDate(value, {
        month: "short",
        day: "numeric",
      }),
    [formatDate],
  );

  const dateWithYear = useCallback(
    (value: string | number | Date) =>
      formatDate(value, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [formatDate],
  );

  const timeLabel = useCallback(
    (value: string | number | Date) =>
      formatDate(value, {
        hour: "numeric",
        minute: "2-digit",
      }),
    [formatDate],
  );

  const translateEnum = useCallback(
    (baseKey: string, value: string) => {
      const key = `${baseKey}.${value}`;
      return safeT(key, humanizeEnum(value));
    },
    [safeT],
  );

  return {
    compactCurrency,
    currency,
    currencyCode,
    currencyWithDecimals,
    dateLabel,
    dateWithYear,
    number,
    t,
    timeLabel,
    translateEnum,
  };
};

export default useDashboardFormatters;
