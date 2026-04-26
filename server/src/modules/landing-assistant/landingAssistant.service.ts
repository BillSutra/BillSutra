import type {
  LandingAssistantAction,
  LandingAssistantHistoryMessage,
  LandingAssistantLanguage,
  LandingAssistantReply,
} from "./landingAssistant.contract.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL =
  process.env.OPENAI_LANDING_ASSISTANT_MODEL?.trim() || "gpt-4.1-mini";

const HINDI_PATTERN = /[\u0900-\u097F]/;

const PRODUCT_KNOWLEDGE = {
  name: "BillSutra",
  audience:
    "Indian small business owners, retailers, wholesalers, service businesses, and growing teams",
  valueProposition: [
    "Billing, inventory, analytics, and AI help in one platform",
    "GST-ready invoices and faster checkout",
    "Better cash-flow visibility with pending payment tracking",
    "Less manual work and fewer spreadsheet errors",
  ],
  features: [
    "Simple billing and POS-style invoicing",
    "Inventory and low-stock visibility",
    "Analytics dashboard for sales, pending payments, and profit trends",
    "AI assistant for business questions and next actions",
    "Professional branded invoices with GST support",
  ],
  pricing: {
    free:
      "Free plan: 50 invoices/month, up to 100 products and 100 customers, paid and pending payment status, simple invoice PDF template.",
    pro:
      "Pro plan: Rs 499/month or Rs 4,790/year, unlimited invoices, partial payment history, smart suggestions, branding, and basic analytics.",
    proPlus:
      "Pro Plus plan: Rs 999/month or Rs 9,590/year, everything in Pro plus advanced analytics, multi-user staff accounts, exports, and priority support.",
  },
  gettingStarted: [
    "Create your account",
    "Add products or import your catalog",
    "Start billing and tracking payments in minutes",
  ],
};

const detectLanguage = (
  explicitLanguage?: LandingAssistantLanguage,
  message?: string,
  history?: LandingAssistantHistoryMessage[],
): LandingAssistantLanguage => {
  if (explicitLanguage) {
    return explicitLanguage;
  }

  const combinedText = [message ?? "", ...(history ?? []).map((item) => item.content)]
    .join(" ")
    .trim();

  return HINDI_PATTERN.test(combinedText) ? "hi" : "en";
};

const normalizeText = (value: string) => value.toLowerCase().trim();

const hasAny = (message: string, terms: string[]) =>
  terms.some((term) => message.includes(term));

const toActions = (
  language: LandingAssistantLanguage,
  intent: "pricing" | "start" | "general" | "product",
): LandingAssistantAction[] => {
  const label = {
    en: {
      startFree: "Start Free",
      pricing: "View Pricing",
      demo: "Watch Demo",
      features: "See Product",
    },
    hi: {
      startFree: "फ्री शुरू करें",
      pricing: "प्राइसिंग देखें",
      demo: "डेमो देखें",
      features: "प्रोडक्ट देखें",
    },
  }[language];

  if (intent === "pricing") {
    return [
      { label: label.pricing, href: "/pricing", variant: "secondary" },
      { label: label.startFree, href: "/register", variant: "primary" },
    ];
  }

  if (intent === "start") {
    return [
      { label: label.startFree, href: "/register", variant: "primary" },
      { label: label.demo, href: "#product", variant: "secondary" },
    ];
  }

  if (intent === "product") {
    return [
      { label: label.features, href: "#product", variant: "secondary" },
      { label: label.startFree, href: "/register", variant: "primary" },
    ];
  }

  return [
    { label: label.startFree, href: "/register", variant: "primary" },
    { label: label.pricing, href: "/pricing", variant: "secondary" },
  ];
};

const buildFallbackReply = ({
  message,
  language,
}: {
  message: string;
  language: LandingAssistantLanguage;
}): LandingAssistantReply => {
  const normalized = normalizeText(message);

  const isPricing =
    hasAny(normalized, ["price", "pricing", "plan", "plans", "cost", "free", "trial"]) ||
    hasAny(normalized, ["प्राइस", "प्लान", "कीमत", "फ्री", "ट्रायल"]);
  const isInventory =
    hasAny(normalized, ["inventory", "stock", "manage inventory", "low stock"]) ||
    hasAny(normalized, ["इन्वेंटरी", "स्टॉक"]);
  const isExcel =
    hasAny(normalized, ["excel", "spreadsheet", "whatsapp", "manual"]) ||
    hasAny(normalized, ["एक्सेल", "शीट", "मैनुअल"]);
  const isStart =
    hasAny(normalized, ["get started", "start", "how do i start", "setup"]) ||
    hasAny(normalized, ["शुरू", "स्टार्ट", "सेटअप"]);
  const isWhatDoesItDo =
    hasAny(normalized, ["what does", "what is billsutra", "what does billsutra do"]) ||
    hasAny(normalized, ["क्या करता", "क्या है", "बिलसूत्र क्या"]);
  const isBenefits =
    hasAny(normalized, ["benefit", "why", "cash flow", "errors", "save time"]) ||
    hasAny(normalized, ["फायदा", "क्यों", "कैश फ्लो", "गलती", "समय"]);

  if (language === "hi") {
    if (isPricing) {
      return {
        language,
        source: "fallback",
        answer:
          "BillSutra में Free, Pro और Pro Plus प्लान हैं.\nFree प्लान से आप 50 invoices/month के साथ शुरू कर सकते हैं, और Pro/Pro Plus में unlimited billing, analytics, staff access और advanced features मिलते हैं.\nअगर आप चाहें तो मैं सही प्लान चुनने में मदद कर सकता हूँ.",
        actions: toActions(language, "pricing"),
      };
    }

    if (isInventory) {
      return {
        language,
        source: "fallback",
        answer:
          "हाँ, BillSutra inventory management करता है.\nआप stock, low-stock alerts, fast-moving items और pending reorders एक ही dashboard से देख सकते हैं.\nइससे stockouts कम होते हैं और billing भी ज़्यादा reliable होती है.",
        actions: toActions(language, "product"),
      };
    }

    if (isExcel) {
      return {
        language,
        source: "fallback",
        answer:
          "Excel से data track हो सकता है, लेकिन daily billing fast नहीं होती.\nBillSutra billing, stock, payments और reports को एक ही workflow में जोड़ता है, इसलिए manual errors और follow-up delay कम होते हैं.\nयही कारण है कि teams जल्दी switch करती हैं.",
        actions: toActions(language, "general"),
      };
    }

    if (isStart) {
      return {
        language,
        source: "fallback",
        answer:
          "शुरू करना आसान है.\n1) Account बनाइए 2) Products जोड़िए या import कीजिए 3) Billing शुरू कीजिए.\nज़्यादातर businesses 2–10 minutes में live हो जाते हैं.",
        actions: toActions(language, "start"),
      };
    }

    if (isWhatDoesItDo || isBenefits) {
      return {
        language,
        source: "fallback",
        answer:
          "BillSutra एक all-in-one billing, inventory aur analytics platform है.\nयह GST-ready invoices बनाता है, stock track करता है, pending payments दिखाता है और AI guidance देता है.\nसीधा फायदा: समय बचता है, गलतियाँ घटती हैं, और cash flow साफ दिखता है.",
        actions: toActions(language, "general"),
      };
    }

    return {
      language,
      source: "fallback",
      answer:
        "BillSutra छोटे और बढ़ते businesses के लिए बना है.\nयह billing, inventory, payments और analytics को एक जगह लाता है ताकि daily काम आसान हो जाए.\nअगर आप चाहें, मैं pricing, inventory या setup के बारे में तुरंत बता सकता हूँ.",
      actions: toActions(language, "general"),
    };
  }

  if (isPricing) {
    return {
      language,
      source: "fallback",
      answer:
        "BillSutra has Free, Pro, and Pro Plus plans.\nYou can start free with 50 invoices/month, then move to Pro or Pro Plus for unlimited billing, analytics, staff access, and stronger controls.\nIf you want, I can help you choose the best plan for your business size.",
      actions: toActions(language, "pricing"),
    };
  }

  if (isInventory) {
    return {
      language,
      source: "fallback",
      answer:
        "Yes, BillSutra manages inventory as well.\nYou can track stock, spot low-stock items, and act before fast-moving products run out.\nThat means fewer stock mistakes and smoother billing at the counter.",
      actions: toActions(language, "product"),
    };
  }

  if (isExcel) {
    return {
      language,
      source: "fallback",
      answer:
        "Excel is fine for records, but it slows down daily operations.\nBillSutra connects billing, stock, payments, and reports in one workflow, so teams make fewer errors and owners get faster visibility.\nThat is where the real time savings come from.",
      actions: toActions(language, "general"),
    };
  }

  if (isStart) {
    return {
      language,
      source: "fallback",
      answer:
        "Getting started is simple.\n1) Create your account 2) Add or import products 3) Start billing and tracking payments.\nMost teams can be up and running in just a few minutes.",
      actions: toActions(language, "start"),
    };
  }

  if (isWhatDoesItDo || isBenefits) {
    return {
      language,
      source: "fallback",
      answer:
        "BillSutra is an all-in-one billing, inventory, and analytics platform.\nIt helps you create GST-ready invoices, manage stock, track pending payments, and use AI guidance from one dashboard.\nThe result is less manual work, fewer errors, and better cash-flow control.",
      actions: toActions(language, "general"),
    };
  }

  return {
    language,
    source: "fallback",
    answer:
      "BillSutra is built to make billing and business operations feel simpler.\nYou can manage invoices, stock, payments, and business insights from one place instead of juggling Excel and WhatsApp.\nAsk me about pricing, inventory, or setup and I’ll guide you quickly.",
    actions: toActions(language, "general"),
  };
};

const buildSystemPrompt = (language: LandingAssistantLanguage) => {
  const languageInstruction =
    language === "hi"
      ? "Reply in natural Hindi for Indian business owners."
      : "Reply in clear English for Indian business owners.";

  return [
    "You are BillSutra Assistant, a friendly sales + support AI assistant for the BillSutra landing page.",
    languageInstruction,
    "Goal: help visitors understand the product, remove hesitation, and guide them toward starting the free plan.",
    "Keep responses short: 2 to 4 lines max.",
    "Use simple language, not jargon.",
    "Be slightly persuasive but never pushy.",
    "When relevant, suggest starting free or viewing pricing.",
    "Never invent features or prices beyond the knowledge below.",
    `Product: ${PRODUCT_KNOWLEDGE.name}.`,
    `Audience: ${PRODUCT_KNOWLEDGE.audience}.`,
    `Value: ${PRODUCT_KNOWLEDGE.valueProposition.join(" | ")}.`,
    `Features: ${PRODUCT_KNOWLEDGE.features.join(" | ")}.`,
    `Pricing: ${PRODUCT_KNOWLEDGE.pricing.free} ${PRODUCT_KNOWLEDGE.pricing.pro} ${PRODUCT_KNOWLEDGE.pricing.proPlus}`,
    `Getting started: ${PRODUCT_KNOWLEDGE.gettingStarted.join(" -> ")}.`,
  ].join("\n");
};

const extractOpenAiText = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) {
    return record.output_text.trim();
  }

  const output = Array.isArray(record.output) ? record.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const messageRecord = item as Record<string, unknown>;
    const content = Array.isArray(messageRecord.content)
      ? messageRecord.content
      : [];

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const contentRecord = contentItem as Record<string, unknown>;
      if (
        contentRecord.type === "output_text" &&
        typeof contentRecord.text === "string" &&
        contentRecord.text.trim()
      ) {
        chunks.push(contentRecord.text.trim());
      }
    }
  }

  return chunks.length > 0 ? chunks.join("\n").trim() : null;
};

const callOpenAiAssistant = async (params: {
  message: string;
  language: LandingAssistantLanguage;
  history?: LandingAssistantHistoryMessage[];
}) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      max_output_tokens: 220,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildSystemPrompt(params.language),
            },
          ],
        },
        ...(params.history ?? []).map((entry) => ({
          role: entry.role,
          content: [
            {
              type: "input_text",
              text: entry.content,
            },
          ],
        })),
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: params.message,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const answer = extractOpenAiText(payload);
  if (!answer) {
    return null;
  }

  return answer;
};

export const answerLandingAssistantQuery = async (params: {
  message: string;
  language?: LandingAssistantLanguage;
  history?: LandingAssistantHistoryMessage[];
}): Promise<LandingAssistantReply> => {
  const language = detectLanguage(
    params.language,
    params.message,
    params.history,
  );

  try {
    const openAiAnswer = await callOpenAiAssistant({
      message: params.message,
      language,
      history: params.history,
    });

    if (openAiAnswer) {
      const fallback = buildFallbackReply({
        message: params.message,
        language,
      });

      return {
        language,
        answer: openAiAnswer,
        actions: fallback.actions,
        source: "openai",
      };
    }
  } catch (error) {
    console.warn("[landing-assistant] OpenAI fallback engaged", {
      model: OPENAI_MODEL,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return buildFallbackReply({
    message: params.message,
    language,
  });
};
