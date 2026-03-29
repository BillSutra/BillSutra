import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type {
  CopilotBehaviorInsight,
  CopilotBehaviorInsights,
  CopilotDataset,
} from "../copilot.types.js";
import { normalizeText, roundMetric, slugify } from "../copilot.utils.js";

const FOOD_HINTS = ["swiggy", "zomato", "blinkit", "instamart", "restaurant", "cafe", "food"];

const allocatePurchaseSpend = (purchase: CopilotDataset["purchases"][number]) => {
  const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
  if (realized <= 0) return [] as Array<{ label: string; amount: number }>;

  const lineSum = purchase.items.reduce((total, item) => total + item.lineTotal, 0);
  if (lineSum <= 0) {
    return [
      {
        label: purchase.supplierName?.trim() || purchase.notes?.trim() || "Misc spend",
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

const priorityWeight = {
  high: 3,
  medium: 2,
  low: 1,
} as const;

type RankedInsight = CopilotBehaviorInsight & {
  weight: number;
};

export const buildBehaviorEngine = (
  language: AssistantLanguage,
  dataset: CopilotDataset,
): CopilotBehaviorInsights => {
  const currentPurchases = dataset.purchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate >= dataset.trailing30Start && effectiveDate < dataset.nextMonthStart;
  });
  const previousPurchases = dataset.purchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate >= dataset.previous30Start && effectiveDate < dataset.trailing30Start;
  });

  const insights: RankedInsight[] = [];

  const weekendSpend = currentPurchases.reduce((total, purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    const day = effectiveDate.getUTCDay();
    const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
    return day === 0 || day === 6 ? total + realized : total;
  }, 0);
  const weekdaySpend = currentPurchases.reduce((total, purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    const day = effectiveDate.getUTCDay();
    const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
    return day === 0 || day === 6 ? total : total + realized;
  }, 0);

  if (weekendSpend >= 1000 && weekendSpend > weekdaySpend * 0.6) {
    const share = roundMetric(
      (weekendSpend / Math.max(weekendSpend + weekdaySpend, 1)) * 100,
      0,
    );
    insights.push({
      id: "weekend-spend",
      title: pickLanguageText(language, {
        en: "Weekend spending is heavier",
        hi: "Weekend spending ज्यादा है",
        hinglish: "Weekend spending zyada hai",
      }),
      description: pickLanguageText(language, {
        en: `About ${share}% of your recent spend is landing on weekends. Plan lighter weekends if you want more budget room.`,
        hi: `आपके recent spend का करीब ${share}% weekends पर जा रहा है. अगर budget room चाहिए तो weekends थोड़ा हल्का रखें.`,
        hinglish: `Aapke recent spend ka lagbhag ${share}% weekends par ja raha hai. Budget room chahiye to weekends thode light rakho.`,
      }),
      priority: weekendSpend > weekdaySpend ? "high" : "medium",
      weight: weekendSpend > weekdaySpend ? 96 : 80,
    });
  }

  // Only surface late-night behavior when timestamps look real, not just midnight defaults.
  const timedPurchases = currentPurchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate.getUTCHours() !== 0 || effectiveDate.getUTCMinutes() !== 0;
  });
  const lateNightPurchases = timedPurchases.filter((purchase) => {
    const effectiveDate = purchase.paymentDate ?? purchase.purchaseDate;
    return effectiveDate.getUTCHours() >= 22;
  });

  if (timedPurchases.length >= 4 && lateNightPurchases.length >= 3) {
    const lateNightSpend = lateNightPurchases.reduce((total, purchase) => {
      const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
      return total + realized;
    }, 0);
    const share = roundMetric((lateNightSpend / Math.max(weekendSpend + weekdaySpend, 1)) * 100, 0);
    insights.push({
      id: "late-night-spend",
      title: pickLanguageText(language, {
        en: "Late-night spending is growing",
        hi: "Late-night spending बढ़ रही है",
        hinglish: "Late-night spending badh rahi hai",
      }),
      description: pickLanguageText(language, {
        en: `You tend to spend after 10 PM, and it already makes up about ${share}% of recent spend. This is an easy place to cut impulsive orders.`,
        hi: `आप 10 PM के बाद ज़्यादा spend करते हैं, और यह recent spend का करीब ${share}% बन रहा है. Impulsive orders कम करने के लिए यह अच्छा spot है.`,
        hinglish: `Aap 10 PM ke baad zyada spend karte ho, aur yeh recent spend ka lagbhag ${share}% bana raha hai. Impulsive orders cut karne ke liye yeh easy spot hai.`,
      }),
      priority: share >= 20 ? "high" : "medium",
      weight: share >= 20 ? 90 : 72,
    });
  }

  const trendBuckets = new Map<
    string,
    {
      label: string;
      amount: number;
      previousAmount: number;
    }
  >();

  const applyTrendSpend = (
    purchases: typeof currentPurchases,
    field: "amount" | "previousAmount",
  ) => {
    purchases.forEach((purchase) => {
      allocatePurchaseSpend(purchase).forEach((entry) => {
        const key = normalizeText(entry.label);
        const current = trendBuckets.get(key) ?? {
          label: entry.label,
          amount: 0,
          previousAmount: 0,
        };
        current[field] += entry.amount;
        trendBuckets.set(key, current);
      });
    });
  };

  applyTrendSpend(currentPurchases, "amount");
  applyTrendSpend(previousPurchases, "previousAmount");

  const topTrend = [...trendBuckets.values()]
    .map((bucket) => ({
      ...bucket,
      increaseAmount: bucket.amount - bucket.previousAmount,
      increasePercent:
        bucket.previousAmount > 0
          ? roundMetric(((bucket.amount - bucket.previousAmount) / bucket.previousAmount) * 100, 0)
          : 0,
    }))
    .filter((bucket) => bucket.amount >= 1000 && bucket.increaseAmount >= 300 && bucket.increasePercent >= 20)
    .sort((left, right) => right.increaseAmount - left.increaseAmount)[0];

  if (topTrend) {
    insights.push({
      id: `trend-${slugify(topTrend.label)}`,
      title: pickLanguageText(language, {
        en: `${topTrend.label} spend is rising`,
        hi: `${topTrend.label} spend बढ़ रहा है`,
        hinglish: `${topTrend.label} spend badh raha hai`,
      }),
      description: pickLanguageText(language, {
        en: `Your ${topTrend.label} spending is up ${topTrend.increasePercent}% this month-like period. That is about ${formatCopilotCurrency(
          topTrend.increaseAmount,
          language,
        )} more than before.`,
        hi: `इस month-like period में आपका ${topTrend.label} spend ${topTrend.increasePercent}% ऊपर है. यह पहले से करीब ${formatCopilotCurrency(
          topTrend.increaseAmount,
          language,
        )} ज़्यादा है.`,
        hinglish: `Is month-like period mein aapka ${topTrend.label} spend ${topTrend.increasePercent}% upar hai. Yeh pehle se lagbhag ${formatCopilotCurrency(
          topTrend.increaseAmount,
          language,
        )} zyada hai.`,
      }),
      priority: topTrend.increasePercent >= 35 ? "high" : "medium",
      weight: topTrend.increasePercent >= 35 ? 92 : 78,
    });
  }

  const repeatBuckets = new Map<
    string,
    {
      label: string;
      count: number;
      amount: number;
    }
  >();

  currentPurchases.forEach((purchase) => {
    const label =
      purchase.supplierName?.trim() ||
      purchase.items[0]?.categoryName?.trim() ||
      purchase.items[0]?.productName?.trim() ||
      purchase.notes?.trim() ||
      "Misc spend";
    const key = normalizeText(label);
    const realized = purchase.paidAmount > 0 ? purchase.paidAmount : purchase.totalAmount;
    const current = repeatBuckets.get(key) ?? { label, count: 0, amount: 0 };
    current.count += 1;
    current.amount += realized;
    repeatBuckets.set(key, current);
  });

  const repeatLeader = [...repeatBuckets.values()]
    .filter((bucket) => bucket.count >= 4 && bucket.amount >= 800)
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.amount - left.amount;
    })[0];

  if (repeatLeader) {
    const normalizedLabel = normalizeText(repeatLeader.label);
    const isFood = FOOD_HINTS.some((hint) => normalizedLabel.includes(hint));
    insights.push({
      id: `repeat-${slugify(repeatLeader.label)}`,
      title: pickLanguageText(language, {
        en: isFood ? "Food delivery is repeating often" : `${repeatLeader.label} is repeating often`,
        hi: isFood ? "Food delivery बार-बार हो रही है" : `${repeatLeader.label} बार-बार आ रहा है`,
        hinglish: isFood ? "Food delivery baar-baar ho rahi hai" : `${repeatLeader.label} baar-baar aa raha hai`,
      }),
      description: pickLanguageText(language, {
        en: `You have already hit ${repeatLeader.count} similar transactions recently, worth ${formatCopilotCurrency(
          repeatLeader.amount,
          language,
        )}. Small cuts here can improve your budget quickly.`,
        hi: `आपने हाल में ${repeatLeader.count} मिलते-जुलते transactions किए हैं, जिनकी value ${formatCopilotCurrency(
          repeatLeader.amount,
          language,
        )} है. यहाँ छोटे cuts जल्दी budget सुधार सकते हैं.`,
        hinglish: `Aapne recent ${repeatLeader.count} similar transactions kiye hain, jinki value ${formatCopilotCurrency(
          repeatLeader.amount,
          language,
        )} hai. Yahan chhote cuts budget ko jaldi improve kar sakte hain.`,
      }),
      priority: repeatLeader.count >= 6 ? "high" : "medium",
      weight: repeatLeader.count >= 6 ? 88 : 74,
    });
  }

  const items = insights
    .sort((left, right) => {
      const priorityGap = priorityWeight[right.priority] - priorityWeight[left.priority];
      if (priorityGap !== 0) return priorityGap;
      return right.weight - left.weight;
    })
    .slice(0, 3)
    .map(({ weight, ...item }) => item);

  const summary =
    items.length === 0
      ? pickLanguageText(language, {
          en: "Your spending habits still look fairly balanced. I will surface sharper behavior insights as more patterns become clear.",
          hi: "आपकी spending habits अभी काफ़ी balanced दिख रही हैं. जैसे-जैसे patterns clear होंगे, मैं और personal insights दिखाऊँगा.",
          hinglish: "Aapki spending habits abhi kaafi balanced lag rahi hain. Jaise-jaise patterns clear honge, main aur personal insights dikhata rahunga.",
        })
      : pickLanguageText(language, {
          en: "These are the biggest behavior patterns affecting your money right now.",
          hi: "अभी आपके पैसे पर असर डालने वाले सबसे बड़े behavior patterns ये हैं.",
          hinglish: "Abhi aapke paise ko affect karne wale sabse bade behavior patterns yeh hain.",
        });

  return {
    summary,
    items,
  };
};
