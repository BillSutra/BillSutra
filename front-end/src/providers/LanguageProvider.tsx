"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  LOCALE_BY_LANGUAGE,
  isLanguage,
  safeTranslate,
  hasTranslation as hasTranslationForLanguage,
  type Language,
} from "@/i18n";

type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  safeT: (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>,
  ) => string;
  hasTranslation: (key: string) => boolean;
  formatCurrency: (
    value: number,
    currency?: string,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatDate: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions,
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider = ({
  initialLanguage = DEFAULT_LANGUAGE,
  children,
}: {
  initialLanguage?: Language;
  children: React.ReactNode;
}) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!isLanguage(storedLanguage)) return;

    setLanguageState((currentLanguage) =>
      currentLanguage === storedLanguage ? currentLanguage : storedLanguage,
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncLanguage = (nextLanguage: unknown) => {
      if (!isLanguage(nextLanguage)) return;

      setLanguageState((currentLanguage) =>
        currentLanguage === nextLanguage ? currentLanguage : nextLanguage,
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) {
        syncLanguage(event.newValue);
      }
    };

    const handleLanguageChange = (event: Event) => {
      syncLanguage(
        (event as CustomEvent<{ language?: unknown }>).detail?.language,
      );
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "billsutra:language-change",
      handleLanguageChange as EventListener,
    );

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "billsutra:language-change",
        handleLanguageChange as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = LOCALE_BY_LANGUAGE[language];
    document.documentElement.dir = "ltr";
    document.documentElement.dataset.language = language;
    window.dispatchEvent(
      new CustomEvent("billsutra:language-change", {
        detail: { language },
      }),
    );
  }, [language]);

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState((currentLanguage) =>
      currentLanguage === nextLanguage ? currentLanguage : nextLanguage,
    );
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => (current === "en" ? "hi" : "en"));
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      safeTranslate(language, key, undefined, params),
    [language],
  );

  const safeT = useCallback(
    (
      key: string,
      fallback?: string,
      params?: Record<string, string | number>,
    ) => safeTranslate(language, key, fallback, params),
    [language],
  );

  const hasTranslation = useCallback(
    (key: string) => hasTranslationForLanguage(language, key),
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
      safeT,
      hasTranslation,
      formatCurrency: (amount: number, currency = "INR", options) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
          ...options,
        }).format(amount),
      formatDate: (input, options) =>
        new Intl.DateTimeFormat(locale, options).format(new Date(input)),
      formatNumber: (input, options) =>
        new Intl.NumberFormat(locale, options).format(input),
    }),
    [hasTranslation, language, locale, safeT, setLanguage, t, toggleLanguage],
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
