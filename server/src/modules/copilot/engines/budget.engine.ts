import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type { CopilotBudgetInsight, CopilotDataset } from "../copilot.types.js";
import {
  average,
  clamp,
  daysLeftInMonth,
  roundMetric,
} from "../copilot.utils.js";

export const buildBudgetEngine = (params: {
  language: AssistantLanguage;
  dataset: CopilotDataset;
  fixedExpenseEstimate: number;
}): CopilotBudgetInsight => {
  const { language, dataset, fixedExpenseEstimate } = params;
  const completedMonths = dataset.monthStats.slice(-4, -1);
  const referenceMonths =
    completedMonths.length >= 2 ? completedMonths : dataset.monthStats.slice(-3);
  const averageInflow =
    average(referenceMonths.map((entry) => entry.inflow)) ||
    dataset.forecast.cashflow.projected30Days.inflow;
  const averageOutflow =
    average(referenceMonths.map((entry) => entry.outflow)) ||
    dataset.forecast.cashflow.projected30Days.outflow;
  const variableSpendAverage = Math.max(averageOutflow - fixedExpenseEstimate, 0);
  const safeVariableBudget = Math.min(
    variableSpendAverage * 0.92,
    Math.max(averageInflow - fixedExpenseEstimate, 0) * 0.88,
  );
  const suggestedMonthlyBudget = roundMetric(
    clamp(
      fixedExpenseEstimate + Math.max(safeVariableBudget, variableSpendAverage * 0.75),
      fixedExpenseEstimate,
      Math.max(averageInflow * 0.88, fixedExpenseEstimate),
    ),
    0,
  );
  const spentThisMonth = dataset.currentMonthStat.outflow;
  const daysElapsed = Math.max(
    1,
    Math.round(
      (dataset.today.getTime() - dataset.currentMonthStart.getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1,
  );
  const currentDailyPace = spentThisMonth / daysElapsed;
  const remainingDays = daysLeftInMonth(dataset.now);
  const projectedMonthSpend = roundMetric(
    spentThisMonth + currentDailyPace * remainingDays,
    0,
  );
  const remainingSafeToSpend = roundMetric(suggestedMonthlyBudget - spentThisMonth, 0);
  const dailySafeSpend = roundMetric(
    Math.max(remainingSafeToSpend, 0) / Math.max(remainingDays, 1),
    0,
  );

  const status =
    remainingSafeToSpend < 0 || projectedMonthSpend > suggestedMonthlyBudget * 1.04
      ? "over_budget"
      : spentThisMonth >= suggestedMonthlyBudget * 0.8 ||
          projectedMonthSpend > suggestedMonthlyBudget
        ? "caution"
        : "on_track";

  const summary =
    status === "over_budget"
      ? pickLanguageText(language, {
          en: `You are spending too fast. A safer cap for this month is ${formatCopilotCurrency(
            suggestedMonthlyBudget,
            language,
          )}.`,
          hi: `आप थोड़ा तेज़ spend कर रहे हैं. इस महीने के लिए safer cap ${formatCopilotCurrency(
            suggestedMonthlyBudget,
            language,
          )} है.`,
          hinglish: `Aap thoda fast spend kar rahe ho. Is month ke liye safer cap ${formatCopilotCurrency(
            suggestedMonthlyBudget,
            language,
          )} hai.`,
        })
      : status === "caution"
        ? pickLanguageText(language, {
            en: `You can safely spend ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} this month, but your pace needs a little control now.`,
            hi: `आप इस महीने safely ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} spend कर सकते हैं, लेकिन अभी pace थोड़ा control करना होगा.`,
            hinglish: `Aap is month safely ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} spend kar sakte ho, lekin ab pace thoda control karna hoga.`,
          })
        : pickLanguageText(language, {
            en: `You can safely spend ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} this month based on your income pattern and fixed bills.`,
            hi: `आप अपनी income pattern और fixed bills के हिसाब से इस महीने safely ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} spend कर सकते हैं.`,
            hinglish: `Aap apni income pattern aur fixed bills ke hisaab se is month safely ${formatCopilotCurrency(
              suggestedMonthlyBudget,
              language,
            )} spend kar sakte ho.`,
          });

  const action =
    status === "over_budget"
      ? pickLanguageText(language, {
          en: "Slow down for a few days and let essentials go first.",
          hi: "कुछ दिन spend slow रखिए और essentials को पहले जाने दीजिए.",
          hinglish: "Kuch din spend slow rakho aur essentials ko pehle jaane do.",
        })
      : status === "caution"
        ? pickLanguageText(language, {
            en: `Try to stay near ${formatCopilotCurrency(
              dailySafeSpend,
              language,
            )} per day for the rest of the month.`,
            hi: `बाकी महीने में रोज़ लगभग ${formatCopilotCurrency(
              dailySafeSpend,
              language,
            )} के आसपास रहना बेहतर होगा.`,
            hinglish: `Baaki month mein roz lagbhag ${formatCopilotCurrency(
              dailySafeSpend,
              language,
            )} ke aaspaas rehna better hoga.`,
          })
        : pickLanguageText(language, {
            en: "Keep following this pace and you should finish the month comfortably.",
            hi: "यही pace रखा तो महीना comfortably निकल जाएगा.",
            hinglish: "Yahi pace rakha to month comfortably nikal jayega.",
          });

  return {
    suggestedMonthlyBudget,
    remainingSafeToSpend,
    fixedExpensesEstimate: roundMetric(fixedExpenseEstimate, 0),
    spentThisMonth: roundMetric(spentThisMonth, 0),
    projectedMonthSpend,
    dailySafeSpend,
    status,
    summary,
    action,
  };
};
