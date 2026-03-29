import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type {
  CopilotBudgetInsight,
  CopilotDataset,
  CopilotGoalSummary,
} from "../copilot.types.js";
import { addMonthsUtc, average, roundMetric } from "../copilot.utils.js";

export const buildGoalTrackerEngine = (params: {
  language: AssistantLanguage;
  dataset: CopilotDataset;
  budget: CopilotBudgetInsight;
}): CopilotGoalSummary => {
  const { language, dataset } = params;
  const referenceMonths = dataset.monthStats.slice(-4, -1);
  const effectiveMonths =
    referenceMonths.length >= 2 ? referenceMonths : dataset.monthStats.slice(-3);
  const averageSurplus = average(
    effectiveMonths.map((entry) => Math.max(entry.inflow - entry.outflow, 0)),
  );
  const projectedMonthlySavings = roundMetric(
    Math.max(averageSurplus, dataset.forecast.cashflow.projected30Days.net * 0.6, 0),
    0,
  );

  const fallbackPerGoal =
    dataset.goals.length > 0
      ? projectedMonthlySavings / dataset.goals.length
      : projectedMonthlySavings;

  const items = dataset.goals.map((goal) => {
    const remainingAmount = Math.max(goal.targetAmount - goal.currentAmount, 0);
    const contribution =
      goal.monthlyContributionTarget && goal.monthlyContributionTarget > 0
        ? goal.monthlyContributionTarget
        : fallbackPerGoal;
    const monthsToGoal =
      contribution > 0 ? Math.ceil(remainingAmount / contribution) : null;
    const projectedCompletionDate =
      monthsToGoal == null
        ? null
        : addMonthsUtc(dataset.currentMonthStart, monthsToGoal).toISOString();
    const progressPercent =
      goal.targetAmount <= 0
        ? 0
        : roundMetric((goal.currentAmount / goal.targetAmount) * 100, 0);

    return {
      ...goal,
      progressPercent,
      remainingAmount: roundMetric(remainingAmount, 0),
      projectedCompletionDate,
      monthsToGoal,
      summary:
        monthsToGoal == null
          ? pickLanguageText(language, {
              en: `Add a monthly contribution to move this goal faster.`,
              hi: `इस goal को तेज़ी से आगे बढ़ाने के लिए monthly contribution जोड़िए.`,
              hinglish: `Is goal ko fast move karne ke liye monthly contribution add karo.`,
            })
          : pickLanguageText(language, {
              en: `At this pace, you can reach it in about ${monthsToGoal} month${monthsToGoal === 1 ? "" : "s"}.`,
              hi: `इस pace पर आप इसे लगभग ${monthsToGoal} महीने में पा सकते हैं.`,
              hinglish: `Is pace par aap ise lagbhag ${monthsToGoal} month mein paa sakte ho.`,
            }),
    };
  });

  const summary =
    items.length === 0
      ? pickLanguageText(language, {
          en: "Set a goal and I will track progress, timeline, and the amount you still need.",
          hi: "एक goal set कीजिए, फिर मैं उसकी progress, timeline और बाकी amount track करूँगा.",
          hinglish: "Ek goal set karo, phir main uski progress, timeline aur baki amount track karunga.",
        })
      : pickLanguageText(language, {
          en: `If you protect about ${formatCopilotCurrency(
            projectedMonthlySavings,
            language,
          )} each month, your goals keep moving steadily.`,
          hi: `अगर आप हर महीने लगभग ${formatCopilotCurrency(
            projectedMonthlySavings,
            language,
          )} बचाते हैं, तो goals steady चलते रहेंगे.`,
          hinglish: `Agar aap har month lagbhag ${formatCopilotCurrency(
            projectedMonthlySavings,
            language,
          )} protect karte ho, to goals steady move karte rahenge.`,
        });

  return {
    projectedMonthlySavings,
    summary,
    items,
  };
};
