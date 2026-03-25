import en from "@/i18n/translations/en.json";
import hi from "@/i18n/translations/hi.json";
import { hiOverrides } from "@/i18n/hi-overrides";

export type Language = "en" | "hi";

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "billSutra:language";
export const LANGUAGE_COOKIE_KEY = "billSutra-language";

export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "hi";

export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
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
  const fallback =
    language === DEFAULT_LANGUAGE
      ? resolveTranslation(translations[DEFAULT_LANGUAGE], key)
      : undefined;

  return interpolate(active ?? fallback ?? key, params);
};
