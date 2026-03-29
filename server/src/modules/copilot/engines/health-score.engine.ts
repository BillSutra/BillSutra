import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { pickLanguageText } from "../copilot.language.js";
import type {
  CopilotBudgetInsight,
  CopilotDataset,
  CopilotHealthScore,
} from "../copilot.types.js";
import { average, clamp, roundMetric, standardDeviation } from "../copilot.utils.js";

export const buildHealthScoreEngine = (params: {
  language: AssistantLanguage;
  dataset: CopilotDataset;
  budget: CopilotBudgetInsight;
}): CopilotHealthScore => {
  const { language, dataset, budget } = params;
  const referenceMonths = dataset.monthStats.slice(-4, -1);
  const effectiveMonths =
    referenceMonths.length >= 2 ? referenceMonths : dataset.monthStats.slice(-3);
  const inflows = effectiveMonths.map((entry) => entry.inflow).filter((value) => value > 0);
  const outflows = effectiveMonths.map((entry) => entry.outflow).filter((value) => value > 0);
  const averageOutflow = average(outflows);
  const consistencyRatio =
    averageOutflow <= 0 ? 1 : 1 - Math.min(standardDeviation(outflows) / averageOutflow, 1);
  const consistencyScore = roundMetric(consistencyRatio * 20, 0);

  const savingsRates = effectiveMonths.map((entry) =>
    entry.inflow <= 0 ? 0 : Math.max(0, (entry.inflow - entry.outflow) / entry.inflow),
  );
  const savingsRateScore = roundMetric(
    clamp(average(savingsRates) / 0.25, 0, 1) * 40,
    0,
  );

  const adherenceReference = Math.max(budget.suggestedMonthlyBudget, 1);
  const adherenceSamples = [...effectiveMonths.map((entry) => entry.outflow), budget.projectedMonthSpend];
  const adherenceRatios = adherenceSamples.map((spent) =>
    clamp(1 - Math.max(0, spent - adherenceReference) / adherenceReference, 0, 1),
  );
  const budgetAdherenceScore = roundMetric(average(adherenceRatios) * 30, 0);

  const overspendingMonths = adherenceSamples.filter(
    (spent) => spent > adherenceReference * 1.03,
  ).length;
  const overspendingFrequencyScore = roundMetric(
    (1 - overspendingMonths / Math.max(adherenceSamples.length, 1)) * 10,
    0,
  );

  const score = roundMetric(
    savingsRateScore +
      budgetAdherenceScore +
      consistencyScore +
      overspendingFrequencyScore,
    0,
  );
  const band =
    score >= 80
      ? "excellent"
      : score >= 60
        ? "good"
        : score >= 40
          ? "needs_improvement"
          : "poor";

  const breakdown = [
    { label: "Savings rate", score: savingsRateScore, outOf: 40 },
    { label: "Budget adherence", score: budgetAdherenceScore, outOf: 30 },
    { label: "Spending consistency", score: consistencyScore, outOf: 20 },
    { label: "Overspending frequency", score: overspendingFrequencyScore, outOf: 10 },
  ];

  const weakest = [...breakdown].sort((left, right) => left.score - right.score)[0];
  const bandLabel =
    band === "excellent"
      ? pickLanguageText(language, {
          en: "Excellent",
          hi: "Excellent",
          hinglish: "Excellent",
        })
      : band === "good"
        ? pickLanguageText(language, {
            en: "Good",
            hi: "Good",
            hinglish: "Good",
          })
        : band === "needs_improvement"
          ? pickLanguageText(language, {
              en: "Needs improvement",
              hi: "Needs improvement",
              hinglish: "Needs improvement",
            })
          : pickLanguageText(language, {
              en: "Poor",
              hi: "Poor",
              hinglish: "Poor",
            });

  return {
    score,
    band,
    summary: pickLanguageText(language, {
      en: `Your financial health score is ${score}/100 (${bandLabel}).`,
      hi: `आपका financial health score ${score}/100 (${bandLabel}) है.`,
      hinglish: `Aapka financial health score ${score}/100 (${bandLabel}) hai.`,
    }),
    nextBestAction: pickLanguageText(language, {
      en:
        weakest.label === "Savings rate"
          ? "The biggest improvement will come from protecting more savings each month."
          : weakest.label === "Budget adherence"
            ? "Staying closer to your monthly budget will lift this score fastest."
            : weakest.label === "Spending consistency"
              ? "More even spending through the month will improve this score."
              : "Fewer overspend months will lift your score quickly.",
      hi:
        weakest.label === "Savings rate"
          ? "हर महीने थोड़ी और savings बचाने से score सबसे जल्दी सुधरेगा."
          : weakest.label === "Budget adherence"
            ? "महीने के budget के करीब रहने से यह score जल्दी बेहतर होगा."
            : weakest.label === "Spending consistency"
              ? "महीने भर spending को थोड़ा steady रखने से score सुधरेगा."
              : "Overspend वाले महीने कम करने से score जल्दी ऊपर जाएगा.",
      hinglish:
        weakest.label === "Savings rate"
          ? "Har month thodi aur savings protect karoge to score sabse fast improve hoga."
          : weakest.label === "Budget adherence"
            ? "Monthly budget ke closer rahoge to yeh score jaldi better hoga."
            : weakest.label === "Spending consistency"
              ? "Month bhar spending ko thoda steady rakhoge to score improve hoga."
              : "Overspend wale months kam karoge to score jaldi upar jayega.",
    }),
    breakdown,
  };
};
