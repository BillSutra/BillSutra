import en from "../../locales/en.json";
import hi from "../../locales/hi.json";

export type Language = "en" | "hi";

export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

export const DEFAULT_LANGUAGE: Language = "en";
export const FALLBACK_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "billSutra:language";
export const LANGUAGE_COOKIE_KEY = "billSutra-language";

export const isLanguage = (value: unknown): value is Language =>
  value === "en" || value === "hi";

export const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

const rawTranslations = {
  en,
  hi,
} satisfies Record<Language, TranslationMap>;

const isTranslationMap = (value: unknown): value is TranslationMap =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasRenderableTranslation = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const mergeTranslations = (
  base: TranslationMap,
  overrides?: TranslationMap,
): TranslationMap => {
  const merged: TranslationMap = {};
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(overrides ?? {}),
  ]);

  keys.forEach((key) => {
    const baseValue = base[key];
    const overrideValue = overrides?.[key];

    if (isTranslationMap(baseValue)) {
      merged[key] = mergeTranslations(
        baseValue,
        isTranslationMap(overrideValue) ? overrideValue : undefined,
      );
      return;
    }

    if (hasRenderableTranslation(overrideValue)) {
      merged[key] = overrideValue;
      return;
    }

    if (hasRenderableTranslation(baseValue)) {
      merged[key] = baseValue;
      return;
    }

    if (isTranslationMap(overrideValue)) {
      merged[key] = mergeTranslations({}, overrideValue);
    }
  });

  return merged;
};

export const translations = {
  en: mergeTranslations(rawTranslations.en),
  hi: mergeTranslations(rawTranslations.en, rawTranslations.hi),
} satisfies Record<Language, TranslationMap>;

const listTranslationKeys = (source: TranslationMap, parent = ""): string[] => {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = parent ? `${parent}.${key}` : key;
    if (hasRenderableTranslation(value)) {
      return [path];
    }
    if (!isTranslationMap(value)) {
      return [];
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

const getEmptyTranslationKeys = (
  source: TranslationMap,
  parent = "",
): string[] => {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = parent ? `${parent}.${key}` : key;

    if (typeof value === "string") {
      return value.trim().length === 0 ? [path] : [];
    }

    if (!isTranslationMap(value)) {
      return [];
    }

    return getEmptyTranslationKeys(value, path);
  });
};

const missingTranslationWarnings = new Set<string>();

if (process.env.NODE_ENV !== "production") {
  const missingHindiKeys = getMissingTranslationKeys(
    rawTranslations.en as TranslationMap,
    rawTranslations.hi as TranslationMap,
  );
  const extraHindiKeys = getMissingTranslationKeys(
    rawTranslations.hi as TranslationMap,
    rawTranslations.en as TranslationMap,
  );
  const emptyEnglishKeys = getEmptyTranslationKeys(
    rawTranslations.en as TranslationMap,
  );
  const emptyHindiKeys = getEmptyTranslationKeys(
    rawTranslations.hi as TranslationMap,
  );

  if (missingHindiKeys.length > 0) {
    console.warn(
      `[i18n] Missing Hindi translation keys (${missingHindiKeys.length}):`,
      missingHindiKeys,
    );
  }

  if (extraHindiKeys.length > 0) {
    console.warn(
      `[i18n] Hindi contains extra translation keys (${extraHindiKeys.length}):`,
      extraHindiKeys,
    );
  }

  if (emptyEnglishKeys.length > 0) {
    console.warn(
      `[i18n] Empty English translation values (${emptyEnglishKeys.length}):`,
      emptyEnglishKeys,
    );
  }

  if (emptyHindiKeys.length > 0) {
    console.warn(
      `[i18n] Empty Hindi translation values (${emptyHindiKeys.length}):`,
      emptyHindiKeys,
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

const getTranslationValue = (source: TranslationMap, key: string) => {
  const value = resolveTranslation(source, key);
  return hasRenderableTranslation(value) ? value : undefined;
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

export const hasTranslation = (language: Language, key: string) =>
  Boolean(
    getTranslationValue(rawTranslations[language], key) ??
      getTranslationValue(rawTranslations[FALLBACK_LANGUAGE], key),
  );

export const translate = (
  language: Language,
  key: string,
  params?: Record<string, string | number>,
) => {
  const active = getTranslationValue(rawTranslations[language], key);
  const fallback =
    language === FALLBACK_LANGUAGE
      ? active
      : getTranslationValue(rawTranslations[FALLBACK_LANGUAGE], key);
  const resolved = active ?? fallback;

  if (!resolved) {
    if (
      process.env.NODE_ENV !== "production" &&
      !missingTranslationWarnings.has(`${language}:${key}`)
    ) {
      missingTranslationWarnings.add(`${language}:${key}`);
      console.warn(`[i18n] Missing translation for ${language}:${key}`);
    }
    return key;
  }

  if (
    !active &&
    language !== "en" &&
    process.env.NODE_ENV !== "production" &&
    !missingTranslationWarnings.has(`${language}:${key}:fallback`)
  ) {
    missingTranslationWarnings.add(`${language}:${key}:fallback`);
    console.warn(`[i18n] Falling back to English for ${language}:${key}`);
  }

  return interpolate(resolved, params);
};

export const safeTranslate = (
  language: Language,
  key: string,
  fallback?: string,
  params?: Record<string, string | number>,
) => {
  const translated = translate(language, key, params);

  if (translated !== key && translated.trim().length > 0) {
    return translated;
  }

  if (typeof fallback === "string" && fallback.trim().length > 0) {
    if (
      process.env.NODE_ENV !== "production" &&
      !missingTranslationWarnings.has(`${language}:${key}:safe-fallback`)
    ) {
      missingTranslationWarnings.add(`${language}:${key}:safe-fallback`);
      console.warn(`[i18n] Missing translation, using inline fallback for ${key}`);
    }

    return interpolate(fallback, params);
  }

  return key;
};
