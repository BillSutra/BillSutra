export type LandingAssistantLanguage = "en" | "hi";

export type LandingAssistantHistoryMessage = {
  role: "assistant" | "user";
  content: string;
};

export type LandingAssistantAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type LandingAssistantReply = {
  language: LandingAssistantLanguage;
  answer: string;
  actions: LandingAssistantAction[];
  source: "openai" | "fallback";
};
