import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type {
  CopilotDataset,
  CopilotSavingsOpportunity,
} from "../copilot.types.js";
import { normalizeText, roundMetric, slugify } from "../copilot.utils.js";

const FOOD_HINTS = [
  "swiggy",
  "zomato",
  "blinkit",
  "instamart",
  "restaurant",
  "cafe",
  "food",
];

const SUBSCRIPTION_HINTS = [
  "netflix",
  "spotify",
  "prime",
  "hotstar",
  "youtube",
  "adobe",
  "chatgpt",
  "openai",
  "canva",
  "subscription",
];

type SpendBucket = {
  label: string;
  amount: number;
  previousAmount: number;
};

const matchesAny = (value: string, hints: string[]) =>
  hints.some((hint) => value.includes(hint));

const allocatePurchaseSpend = (purchase: CopilotDataset["purchases"][number]) => {
  const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
  if (realized <= 0) return [] as Array<{ label: string; amount: number }>;

  const lineSum = purchase.items.reduce((total, item) => total + item.lineTotal, 0);
  if (lineSum <= 0) {
    return [
      {
        label: purchase.supplierName?.trim() || "Misc spend",
        amount: realized,
      },
    ];
  }

  return purchase.items.map((item) => ({
    label:
      item.categoryName?.trim() ||
      item.productName?.trim() ||
      item.name.trim() ||
      purchase.supplierName?.trim() ||
      "Misc spend",
    amount: realized * (item.lineTotal / lineSum),
  }));
};

export const buildSavingsEngine = (
  language: AssistantLanguage,
  dataset: CopilotDataset,
) => {
  const currentBuckets = new Map<string, SpendBucket>();
  const currentPurchases = dataset.purchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate >= dataset.trailing30Start && effectiveDate < dataset.nextMonthStart;
  });
  const previousPurchases = dataset.purchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate >= dataset.previous30Start && effectiveDate < dataset.trailing30Start;
  });

  const applySpend = (
    purchases: typeof currentPurchases,
    target: Map<string, SpendBucket>,
    field: "amount" | "previousAmount",
  ) => {
    purchases.forEach((purchase) => {
      allocatePurchaseSpend(purchase).forEach((entry) => {
        const key = normalizeText(entry.label);
        const current =
          target.get(key) ?? { label: entry.label, amount: 0, previousAmount: 0 };
        current[field] += entry.amount;
        target.set(key, current);
      });
    });
  };

  applySpend(currentPurchases, currentBuckets, "amount");
  applySpend(previousPurchases, currentBuckets, "previousAmount");

  const opportunities: CopilotSavingsOpportunity[] = [];

  currentBuckets.forEach((bucket, key) => {
    const normalized = normalizeText(key);
    const growth = bucket.amount - bucket.previousAmount;

    if (matchesAny(normalized, FOOD_HINTS) && bucket.amount >= 800) {
      const potential = roundMetric(bucket.amount * 0.3, 0);
      opportunities.push({
        id: `food-${slugify(key)}`,
        title: pickLanguageText(language, {
          en: "Cut food delivery a little",
          hi: "Food delivery थोड़ा कम कीजिए",
          hinglish: "Food delivery thoda kam karo",
        }),
        description: pickLanguageText(language, {
          en: `You spent ${formatCopilotCurrency(
            bucket.amount,
            language,
          )} here recently. Trimming this by 30% can save about ${formatCopilotCurrency(
            potential,
            language,
          )} a month.`,
          hi: `आपने यहाँ हाल में ${formatCopilotCurrency(
            bucket.amount,
            language,
          )} spend किया. इसे 30% कम करने से लगभग ${formatCopilotCurrency(
            potential,
            language,
          )} महीना बच सकता है.`,
          hinglish: `Aapne yahan recent ${formatCopilotCurrency(
            bucket.amount,
            language,
          )} spend kiya. Ise 30% cut karne se lagbhag ${formatCopilotCurrency(
            potential,
            language,
          )} mahina bach sakta hai.`,
        }),
        potentialMonthlySavings: potential,
        category: bucket.label,
        priority: "high",
      });
      return;
    }

    if (matchesAny(normalized, SUBSCRIPTION_HINTS) && bucket.amount >= 500) {
      const potential = roundMetric(bucket.amount * 0.4, 0);
      opportunities.push({
        id: `subscription-${slugify(key)}`,
        title: pickLanguageText(language, {
          en: "Review recurring subscriptions",
          hi: "Recurring subscriptions review कीजिए",
          hinglish: "Recurring subscriptions review karo",
        }),
        description: pickLanguageText(language, {
          en: `${bucket.label} is taking about ${formatCopilotCurrency(
            bucket.amount,
            language,
          )}. Canceling or downgrading a few can save ${formatCopilotCurrency(
            potential,
            language,
          )} a month.`,
          hi: `${bucket.label} पर लगभग ${formatCopilotCurrency(
            bucket.amount,
            language,
          )} जा रहा है. कुछ cancel या downgrade करने से ${formatCopilotCurrency(
            potential,
            language,
          )} महीना बच सकता है.`,
          hinglish: `${bucket.label} pe lagbhag ${formatCopilotCurrency(
            bucket.amount,
            language,
          )} ja raha hai. Kuch cancel ya downgrade karne se ${formatCopilotCurrency(
            potential,
            language,
          )} mahina bach sakta hai.`,
        }),
        potentialMonthlySavings: potential,
        category: bucket.label,
        priority: "medium",
      });
      return;
    }

    if (bucket.amount >= 1500 && growth > Math.max(bucket.previousAmount * 0.2, 300)) {
      const potential = roundMetric(bucket.amount * 0.15, 0);
      opportunities.push({
        id: `trend-${slugify(key)}`,
        title: pickLanguageText(language, {
          en: `Watch your ${bucket.label} spend`,
          hi: `${bucket.label} spend पर ध्यान दीजिए`,
          hinglish: `${bucket.label} spend pe dhyan do`,
        }),
        description: pickLanguageText(language, {
          en: `${bucket.label} jumped by ${formatCopilotCurrency(
            growth,
            language,
          )} versus the previous month-like period. Pulling it down by 15% saves about ${formatCopilotCurrency(
            potential,
            language,
          )}.`,
          hi: `${bucket.label} पिछले month-like period से ${formatCopilotCurrency(
            growth,
            language,
          )} बढ़ा है. इसे 15% नीचे लाने से करीब ${formatCopilotCurrency(
            potential,
            language,
          )} बच सकता है.`,
          hinglish: `${bucket.label} pichle month-like period se ${formatCopilotCurrency(
            growth,
            language,
          )} badha hai. Ise 15% niche lane se kareeb ${formatCopilotCurrency(
            potential,
            language,
          )} bach sakta hai.`,
        }),
        potentialMonthlySavings: potential,
        category: bucket.label,
        priority: "medium",
      });
    }
  });

  const ranked = opportunities
    .sort((left, right) => right.potentialMonthlySavings - left.potentialMonthlySavings)
    .slice(0, 3);
  const monthlySavingsPotential = roundMetric(
    ranked.reduce((total, item) => total + item.potentialMonthlySavings, 0),
    0,
  );

  const summary =
    ranked.length === 0
      ? pickLanguageText(language, {
          en: "Your recent spend looks fairly balanced. I will surface sharper savings ideas once I see clearer patterns.",
          hi: "आपका recent spend काफ़ी balanced दिख रहा है. थोड़ा और pattern दिखेगा तो मैं और sharp savings ideas दूँगा.",
          hinglish: "Aapka recent spend kaafi balanced dikh raha hai. Thoda aur pattern dikhega to main aur sharp savings ideas dunga.",
        })
      : pickLanguageText(language, {
          en: `You can likely save about ${formatCopilotCurrency(
            monthlySavingsPotential,
            language,
          )} per month with a few small cuts.`,
          hi: `कुछ छोटे cuts से आप लगभग ${formatCopilotCurrency(
            monthlySavingsPotential,
            language,
          )} प्रति महीना बचा सकते हैं.`,
          hinglish: `Kuch chhote cuts se aap lagbhag ${formatCopilotCurrency(
            monthlySavingsPotential,
            language,
          )} per month bacha sakte ho.`,
        });

  return {
    summary,
    monthlySavingsPotential,
    opportunities: ranked,
  };
};
