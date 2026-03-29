import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type {
  CopilotBudgetInsight,
  CopilotGoalSummary,
  CopilotNudge,
  CopilotReminderItem,
  CopilotSavingsOpportunity,
} from "../copilot.types.js";

export const buildNudgeEngine = (params: {
  language: AssistantLanguage;
  budget: CopilotBudgetInsight;
  reminders: CopilotReminderItem[];
  savingsOpportunities: CopilotSavingsOpportunity[];
  goals: CopilotGoalSummary;
}): CopilotNudge[] => {
  const { language, budget, reminders, savingsOpportunities, goals } = params;
  const nudges: CopilotNudge[] = [];

  if (budget.status === "over_budget") {
    nudges.push({
      id: "budget-over",
      tone: "critical",
      message: pickLanguageText(language, {
        en: "You are close to the edge this month. Skip non-essential spending today.",
        hi: "आप इस महीने edge के काफ़ी पास हैं. आज non-essential spending रोकिए.",
        hinglish: "Aap is month edge ke kaafi paas ho. Aaj non-essential spending skip karo.",
      }),
      action: pickLanguageText(language, {
        en: "Pause optional spends",
        hi: "Optional spends रोकिए",
        hinglish: "Optional spends roko",
      }),
    });
  } else if (budget.status === "caution") {
    nudges.push({
      id: "budget-caution",
      tone: "warning",
      message: pickLanguageText(language, {
        en: `Stay near ${formatCopilotCurrency(
          budget.dailySafeSpend,
          language,
        )} per day to finish the month safely.`,
        hi: `महीना safely निकालने के लिए रोज़ लगभग ${formatCopilotCurrency(
          budget.dailySafeSpend,
          language,
        )} के आसपास रहें.`,
        hinglish: `Month safely nikalne ke liye roz lagbhag ${formatCopilotCurrency(
          budget.dailySafeSpend,
          language,
        )} ke aaspaas raho.`,
      }),
      action: pickLanguageText(language, {
        en: "Slow the pace",
        hi: "Pace slow कीजिए",
        hinglish: "Pace slow karo",
      }),
    });
  }

  const dueSoon = reminders.find(
    (item) => item.daysUntilDue != null && item.daysUntilDue <= 2,
  );
  if (dueSoon) {
    nudges.push({
      id: "bill-due",
      tone: "warning",
      message: dueSoon.description,
      action: dueSoon.suggestedAction,
    });
  }

  const topSaving = savingsOpportunities[0];
  if (topSaving) {
    nudges.push({
      id: "save-more",
      tone: "info",
      message: topSaving.description,
      action: topSaving.title,
    });
  }

  const closestGoal = goals.items
    .filter((goal) => goal.progressPercent < 100)
    .sort((left, right) => right.progressPercent - left.progressPercent)[0];
  if (closestGoal) {
    nudges.push({
      id: "goal-progress",
      tone: "positive",
      message: pickLanguageText(language, {
        en: `${closestGoal.title} is ${closestGoal.progressPercent}% complete.`,
        hi: `${closestGoal.title} ${closestGoal.progressPercent}% पूरा हो चुका है.`,
        hinglish: `${closestGoal.title} ${closestGoal.progressPercent}% complete ho chuka hai.`,
      }),
      action: pickLanguageText(language, {
        en: "Protect this month's savings",
        hi: "इस महीने की savings बचाइए",
        hinglish: "Is month ki savings protect karo",
      }),
    });
  }

  return nudges.slice(0, 3);
};
