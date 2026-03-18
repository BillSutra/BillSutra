"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import en from "@/i18n/translations/en.json";
import hi from "@/i18n/translations/hi.json";

export type Language = "en" | "hi";

interface TranslationMap {
  [key: string]: string | TranslationMap;
}

type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatCurrency: (value: number, currency?: string) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LANGUAGE_STORAGE_KEY = "billSutra:language";
const translations = { en, hi } satisfies Record<Language, TranslationMap>;

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

const resolveTranslation = (
  source: TranslationMap,
  key: string,
): string | undefined => {
  const value = key.split(".").reduce<string | TranslationMap | undefined>((current, segment) => {
    if (!current || typeof current === "string") return undefined;
    return current[segment];
  }, source);

  return typeof value === "string" ? value : undefined;
};

const interpolate = (
  template: string,
  params?: Record<string, string | number>,
) => {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = params[token];
    return value === undefined ? `{{${token}}}` : String(value);
  });
};

export const LanguageProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === "en" || stored === "hi") {
      setLanguageState(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.language = language;
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "en" ? "hi" : "en"));
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const active = resolveTranslation(translations[language], key);
      const fallback = resolveTranslation(translations.en, key);
      return interpolate(active ?? fallback ?? key, params);
    },
    [language],
  );

  const locale = LOCALE_BY_LANGUAGE[language];

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      locale,
      setLanguage,
      toggleLanguage,
      t,
      formatCurrency: (amount: number, currency = "INR") =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(input)),
      formatNumber: (input, options) =>
        new Intl.NumberFormat(locale, options).format(input),
    }),
    [language, locale, setLanguage, t, toggleLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return context;
};
