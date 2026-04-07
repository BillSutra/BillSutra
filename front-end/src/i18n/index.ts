import en from "../../locales/en.json";
import hi from "../../locales/hi.json";
import { hiOverrides } from "@/i18n/hi-overrides";

export type Language = "en" | "hi" | "hinglish";

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "billSutra:language";
export const LANGUAGE_COOKIE_KEY = "billSutra-language";

export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "hi" || value === "hinglish";

export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
  hinglish: "en-IN",
};

const mergeTranslations = (
  base: TranslationMap,
  overrides: TranslationMap,
): TranslationMap => {
  const result: TranslationMap = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    if (
      value &&
      typeof value !== "string" &&
      current &&
      typeof current !== "string"
    ) {
      result[key] = mergeTranslations(current, value);
      continue;
    }

    result[key] = value;
  }

  return result;
};

export const translations = {
  en,
  hi: mergeTranslations(hi as TranslationMap, hiOverrides),
  hinglish: {
    common: {
      language: "Language",
      english: "English",
      hindi: "Hindi",
      hinglish: "Hinglish",
    },
    navigation: {
      invoices: "Bills",
      invoiceRecords: "Bill History",
      clients: "Customers",
    },
    dashboardQuickDesk: {
      actions: {
        newBill: {
          label: "Create Bill",
        },
      },
    },
  },
} satisfies Record<Language, TranslationMap>;

export const resolveTranslation = (
  source: TranslationMap,
  key: string,
): string | undefined => {
  const value = key
    .split(".")
    .reduce<string | TranslationMap | undefined>((current, segment) => {
      if (!current || typeof current === "string") return undefined;
      return current[segment];
    }, source);

  return typeof value === "string" ? value : undefined;
};

export const interpolate = (
  template: string,
  params?: Record<string, string | number>,
) => {
  if (!params) return template;

  return template.replace(
    /\{\{(\w+)\}\}|\{(\w+)\}/g,
    (_, doubleToken: string, singleToken: string) => {
      const token = doubleToken || singleToken;
      const value = params[token];

      if (value === undefined) {
        return doubleToken ? `{{${token}}}` : `{${token}}`;
      }

      return String(value);
    },
  );
};

export const translate = (
  language: Language,
  key: string,
  params?: Record<string, string | number>,
) => {
  const active = resolveTranslation(translations[language], key);
  const fallback = resolveTranslation(translations[DEFAULT_LANGUAGE], key);

  return interpolate(active ?? fallback ?? key, params);
};
