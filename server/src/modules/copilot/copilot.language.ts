import {
  detectAssistantLanguage,
  type AssistantLanguage,
} from "../assistant/assistant.language.js";

export const resolveCopilotLanguage = (
  value?: string | null,
  fallbackMessage?: string,
): AssistantLanguage => {
  if (value === "en" || value === "hi" || value === "hinglish") {
    return value;
  }

  if (fallbackMessage?.trim()) {
    return detectAssistantLanguage(fallbackMessage).language;
  }

  return "hinglish";
};

export const pickLanguageText = (
  language: AssistantLanguage,
  copy: {
    en: string;
    hi: string;
    hinglish: string;
  },
) => copy[language];

export const formatCopilotCurrency = (
  amount: number,
  language: AssistantLanguage,
) => {
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);

  return language === "hi" ? `₹${formatted}` : `₹${formatted}`;
};

export const formatCopilotNumber = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

export const formatRelativeDays = (
  language: AssistantLanguage,
  days: number | null,
) => {
  if (days === null) {
    return pickLanguageText(language, {
      en: "No due date",
      hi: "कोई due date नहीं",
      hinglish: "Koi due date nahi",
    });
  }

  if (days < 0) {
    return pickLanguageText(language, {
      en: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`,
      hi: `${Math.abs(days)} दिन overdue`,
      hinglish: `${Math.abs(days)} din overdue`,
    });
  }

  if (days === 0) {
    return pickLanguageText(language, {
      en: "Due today",
      hi: "आज due है",
      hinglish: "Aaj due hai",
    });
  }

  if (days === 1) {
    return pickLanguageText(language, {
      en: "Due tomorrow",
      hi: "कल due है",
      hinglish: "Kal due hai",
    });
  }

  return pickLanguageText(language, {
    en: `Due in ${days} days`,
    hi: `${days} दिन में due`,
    hinglish: `${days} din mein due`,
  });
};

