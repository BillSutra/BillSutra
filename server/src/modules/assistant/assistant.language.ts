export type AssistantLanguage = "en" | "hi" | "hinglish";

export type AssistantLanguageProfile = {
  language: AssistantLanguage;
  devanagariCount: number;
  englishHintCount: number;
  hindiHintCount: number;
  mixed: boolean;
};

const DEVANAGARI_PATTERN = /[\u0900-\u097F]/g;

const ENGLISH_HINTS = [
  "how",
  "what",
  "show",
  "tell",
  "spent",
  "spend",
  "sales",
  "profit",
  "cashflow",
  "cash",
  "pending",
  "payment",
  "payments",
  "afford",
  "last",
  "month",
  "week",
  "today",
  "supplier",
  "category",
  "food",
  "top",
];

const HINDI_ROMANIZED_HINTS = [
  "kitna",
  "kitni",
  "kitne",
  "mera",
  "meri",
  "mere",
  "aap",
  "mujhe",
  "maine",
  "maine",
  "mahina",
  "mahine",
  "pichla",
  "pichle",
  "pichli",
  "is",
  "iss",
  "hafte",
  "mahine",
  "kharch",
  "batao",
  "btao",
  "bikri",
  "munafa",
  "bakaya",
  "baki",
  "kya",
  "kyu",
  "kaise",
  "kar",
  "sakta",
  "sakti",
  "sabse",
  "zyada",
  "paisa",
  "ja",
  "raha",
  "chal",
  "raha",
];

const tokenize = (message: string) =>
  message
    .toLowerCase()
    .split(/[^a-z\u0900-\u097f0-9]+/i)
    .filter(Boolean);

export const detectAssistantLanguage = (
  message: string,
): AssistantLanguageProfile => {
  const devanagariCount = (message.match(DEVANAGARI_PATTERN) ?? []).length;
  const tokens = tokenize(message);

  const englishHintCount = tokens.filter((token) =>
    ENGLISH_HINTS.includes(token),
  ).length;
  const hindiHintCount = tokens.filter((token) =>
    HINDI_ROMANIZED_HINTS.includes(token),
  ).length;

  if (devanagariCount > 0 && englishHintCount === 0) {
    return {
      language: "hi",
      devanagariCount,
      englishHintCount,
      hindiHintCount,
      mixed: false,
    };
  }

  if (devanagariCount > 0 || (englishHintCount > 0 && hindiHintCount > 0)) {
    // Mixed Hindi + English should stay conversational, not be forced into translation mode.
    return {
      language: "hinglish",
      devanagariCount,
      englishHintCount,
      hindiHintCount,
      mixed: true,
    };
  }

  if (hindiHintCount > 0) {
    return {
      language: "hinglish",
      devanagariCount,
      englishHintCount,
      hindiHintCount,
      mixed: false,
    };
  }

  if (englishHintCount > 0) {
    return {
      language: "en",
      devanagariCount,
      englishHintCount,
      hindiHintCount,
      mixed: false,
    };
  }

  return {
    // When the signal is weak, Hinglish is the safest fallback for Indian users.
    language: "hinglish",
    devanagariCount,
    englishHintCount,
    hindiHintCount,
    mixed: false,
  };
};
