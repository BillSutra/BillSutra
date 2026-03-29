import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type { CopilotDataset, CopilotReminderItem } from "../copilot.types.js";
import {
  average,
  daysBetweenUtc,
  normalizeText,
  roundMetric,
  slugify,
} from "../copilot.utils.js";

type ReminderCandidate = CopilotReminderItem & {
  monthlyAmount: number;
};

const MIN_RECURRING_MONTHS = 2;

const resolvePriority = (daysUntilDue: number | null, monthlyAmount: number) => {
  if (daysUntilDue !== null && daysUntilDue <= 3) {
    return "high" as const;
  }

  if (monthlyAmount >= 5000) {
    return "high" as const;
  }

  if (daysUntilDue !== null && daysUntilDue <= 7) {
    return "medium" as const;
  }

  return "low" as const;
};

export const buildReminderEngine = (
  language: AssistantLanguage,
  dataset: CopilotDataset,
) => {
  const groups = new Map<
    string,
    Array<{
      purchaseDate: Date;
      paymentDate: Date | null;
      amount: number;
      supplierName: string;
    }>
  >();

  dataset.purchases.forEach((purchase) => {
    const supplierName = purchase.supplierName?.trim() || purchase.notes?.trim();
    if (!supplierName || purchase.totalAmount <= 0) {
      return;
    }

    const key = normalizeText(supplierName);
    const bucket = groups.get(key) ?? [];
    bucket.push({
      purchaseDate: purchase.purchaseDate,
      paymentDate: purchase.paymentDate,
      amount: purchase.totalAmount,
      supplierName,
    });
    groups.set(key, bucket);
  });

  const items = Array.from(groups.entries())
    .map<ReminderCandidate | null>(([key, entries]) => {
      const sorted = [...entries].sort(
        (left, right) => left.purchaseDate.getTime() - right.purchaseDate.getTime(),
      );
      const distinctMonths = new Set(
        sorted.map(
          (entry) =>
            `${entry.purchaseDate.getUTCFullYear()}-${entry.purchaseDate.getUTCMonth() + 1}`,
        ),
      );

      if (distinctMonths.size < MIN_RECURRING_MONTHS) {
        return null;
      }

      const gaps: number[] = [];
      for (let index = 1; index < sorted.length; index += 1) {
        gaps.push(
          Math.abs(daysBetweenUtc(sorted[index].purchaseDate, sorted[index - 1].purchaseDate)),
        );
      }

      const averageGap = average(gaps);
      const cadenceDays =
        averageGap >= 24 && averageGap <= 38
          ? 30
          : averageGap >= 5 && averageGap <= 10
            ? 7
            : 30;
      const averageAmount = roundMetric(average(sorted.map((entry) => entry.amount)), 0);
      const lastEntry = sorted.at(-1);

      if (!lastEntry) {
        return null;
      }

      const dueDate = new Date(lastEntry.purchaseDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + cadenceDays);

      const daysUntilDue = daysBetweenUtc(dueDate, dataset.today);
      const paymentLagDays = average(
        sorted
          .filter((entry) => entry.paymentDate)
          .map((entry) => daysBetweenUtc(entry.paymentDate ?? entry.purchaseDate, entry.purchaseDate)),
      );

      const behavior =
        paymentLagDays > 6 ? "late" : paymentLagDays <= 2 ? "early" : "on_time";
      const supplierName = lastEntry.supplierName;
      const duePhrase =
        daysUntilDue < 0
          ? pickLanguageText(language, {
              en: "is already overdue",
              hi: "पहले से overdue है",
              hinglish: "already overdue hai",
            })
          : daysUntilDue <= 2
            ? pickLanguageText(language, {
                en: "is due very soon",
                hi: "बहुत जल्द due है",
                hinglish: "bahut jaldi due hai",
              })
            : pickLanguageText(language, {
                en: "is coming up",
                hi: "जल्द आने वाला है",
                hinglish: "jaldi aane wala hai",
              });

      const behaviorLine =
        behavior === "late"
          ? pickLanguageText(language, {
              en: "You usually pay this late. Auto-pay could help.",
              hi: "आप इसे अक्सर late pay करते हैं. Auto-pay मदद कर सकता है.",
              hinglish: "Aap ise aksar late pay karte ho. Auto-pay help kar sakta hai.",
            })
          : behavior === "early"
            ? pickLanguageText(language, {
                en: "You usually clear this early.",
                hi: "आप इसे आमतौर पर जल्दी clear कर देते हैं.",
                hinglish: "Aap ise usually jaldi clear kar dete ho.",
              })
            : pickLanguageText(language, {
                en: "Your payment timing is mostly steady here.",
                hi: "यहाँ आपका payment timing काफ़ी steady है.",
                hinglish: "Yahan aapka payment timing kaafi steady hai.",
              });

      return {
        id: `reminder-${slugify(key)}`,
        title:
          language === "hi"
            ? `${supplierName} बिल`
            : language === "hinglish"
              ? `${supplierName} bill`
              : `${supplierName} bill`,
        description:
          language === "hi"
            ? `${supplierName} ${duePhrase}. इसका usual amount ${formatCopilotCurrency(
                averageAmount,
                language,
              )} है. ${behaviorLine}`
            : language === "hinglish"
              ? `${supplierName} ${duePhrase}. Iska usual amount ${formatCopilotCurrency(
                  averageAmount,
                  language,
                )} hai. ${behaviorLine}`
              : `${supplierName} ${duePhrase}. Its usual amount is ${formatCopilotCurrency(
                  averageAmount,
                  language,
                )}. ${behaviorLine}`,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        monthlyAmount: averageAmount,
        priority: resolvePriority(daysUntilDue, averageAmount),
        suggestedAction:
          behavior === "late"
            ? pickLanguageText(language, {
                en: "Set a reminder or auto-pay",
                hi: "Reminder या auto-pay लगाइए",
                hinglish: "Reminder ya auto-pay lagao",
              })
            : pickLanguageText(language, {
                en: "Keep cash ready for this bill",
                hi: "इस bill के लिए cash ready रखिए",
                hinglish: "Is bill ke liye cash ready rakho",
              }),
        behavior,
      };
    })
    .filter((item): item is ReminderCandidate => Boolean(item))
    .sort((left, right) => {
      const priorityRank = { high: 0, medium: 1, low: 2 };
      const priorityGap = priorityRank[left.priority] - priorityRank[right.priority];
      if (priorityGap !== 0) return priorityGap;
      return (left.daysUntilDue ?? 999) - (right.daysUntilDue ?? 999);
    })
    .slice(0, 4);

  const summary =
    items.length === 0
      ? pickLanguageText(language, {
          en: "I need a little more repeat expense history before I can learn your bill cycle.",
          hi: "मुझे आपका bill cycle सीखने के लिए थोड़ी और repeat expense history चाहिए.",
          hinglish: "Mujhe aapka bill cycle seekhne ke liye thodi aur repeat expense history chahiye.",
        })
      : pickLanguageText(language, {
          en: `${items[0].title} is the next bill to watch.`,
          hi: `${items[0].title} अगला bill है जिस पर ध्यान देना चाहिए.`,
          hinglish: `${items[0].title} agla bill hai jis par dhyan dena chahiye.`,
        });

  return {
    items,
    fixedExpenseEstimate: roundMetric(
      items.reduce((total, item) => total + item.monthlyAmount, 0),
      0,
    ),
    summary,
  };
};
