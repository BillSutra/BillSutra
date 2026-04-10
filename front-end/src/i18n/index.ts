import en from "../../locales/en.json";
import hi from "../../locales/hi.json";

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

export const translations = {
  en,
  hi,
} satisfies Record<Language, TranslationMap>;

const listTranslationKeys = (source: TranslationMap, parent = ""): string[] => {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = parent ? `${parent}.${key}` : key;
    if (typeof value === "string") {
      return [path];
    }
    return listTranslationKeys(value, path);
  });
};

const getMissingTranslationKeys = (
  base: TranslationMap,
  target: TranslationMap,
): string[] => {
  const targetKeys = new Set(listTranslationKeys(target));
  return listTranslationKeys(base).filter((key) => !targetKeys.has(key));
};

const missingTranslationWarnings = new Set<string>();

if (process.env.NODE_ENV !== "production") {
  const missingHindiKeys = getMissingTranslationKeys(
    translations.en as TranslationMap,
    translations.hi as TranslationMap,
  );

  if (missingHindiKeys.length > 0) {
    console.error(
      `[i18n] Missing Hindi translation keys (${missingHindiKeys.length}):`,
      missingHindiKeys,
    );
  }
}

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

  if (!active) {
    if (
      process.env.NODE_ENV !== "production" &&
      !missingTranslationWarnings.has(`${language}:${key}`)
    ) {
      missingTranslationWarnings.add(`${language}:${key}`);
      console.error(`[i18n] Missing translation for ${language}:${key}`);
    }

    return key;
  }

  return interpolate(active, params);
};
