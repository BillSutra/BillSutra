export type AssistantChatLanguage = "en" | "hi" | "hinglish";

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
  "mahina",
  "mahine",
  "pichla",
  "pichle",
  "pichli",
  "hafte",
  "kharch",
  "batao",
  "btao",
  "bikri",
  "munafa",
  "bakaya",
  "baki",
  "kya",
  "kaise",
  "sakta",
  "sakti",
  "sabse",
  "zyada",
  "paisa",
  "raha",
];

const tokenize = (message: string) =>
  message
    .toLowerCase()
    .split(/[^a-z\u0900-\u097f0-9]+/i)
    .filter(Boolean);

export const detectAssistantChatLanguage = (
  message: string,
): AssistantChatLanguage => {
  const devanagariCount = (message.match(DEVANAGARI_PATTERN) ?? []).length;
  const tokens = tokenize(message);
  const englishHintCount = tokens.filter((token) =>
    ENGLISH_HINTS.includes(token),
  ).length;
  const hindiHintCount = tokens.filter((token) =>
    HINDI_ROMANIZED_HINTS.includes(token),
  ).length;

  if (devanagariCount > 0 && englishHintCount === 0) {
    return "hi";
  }

  if (devanagariCount > 0 || (englishHintCount > 0 && hindiHintCount > 0)) {
    // Mixed input should feel natural in the loading state too.
    return "hinglish";
  }

  if (hindiHintCount > 0) {
    return "hinglish";
  }

  if (englishHintCount > 0) {
    return "en";
  }

  return "hinglish";
};
