import type { AssistantLanguage } from "../assistant/assistant.language.js";
import {
  buildCopilotDataset,
  createFinancialGoal,
  deleteFinancialGoal,
  listFinancialGoals,
  updateFinancialGoal,
} from "./copilot.data.js";
import {
  formatCopilotCurrency,
  pickLanguageText,
  resolveCopilotLanguage,
} from "./copilot.language.js";
import { buildBudgetEngine } from "./engines/budget.engine.js";
import { buildBehaviorEngine } from "./engines/behavior.engine.js";
import { buildDecisionEngine } from "./engines/decision.engine.js";
import { buildGoalTrackerEngine } from "./engines/goal-tracker.engine.js";
import { buildHealthScoreEngine } from "./engines/health-score.engine.js";
import { buildNudgeEngine } from "./engines/nudge.engine.js";
import { buildReminderEngine } from "./engines/reminder.engine.js";
import { buildSavingsEngine } from "./engines/savings.engine.js";
import type { FinancialCopilotPayload } from "./copilot.types.js";

const buildOverview = (params: {
  language: AssistantLanguage;
  payload: Omit<FinancialCopilotPayload, "overview" | "generatedAt" | "language" | "examples">;
}) => {
  const { language, payload } = params;
  const healthBandLabel =
    payload.healthScore.band === "excellent"
      ? pickLanguageText(language, {
          en: "Excellent",
          hi: "Excellent",
          hinglish: "Excellent",
        })
      : payload.healthScore.band === "good"
        ? pickLanguageText(language, {
            en: "Good",
            hi: "Good",
            hinglish: "Good",
          })
        : payload.healthScore.band === "needs_improvement"
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
    headline: pickLanguageText(language, {
      en: `Health score ${payload.healthScore.score}/100 (${healthBandLabel})`,
      hi: `Health score ${payload.healthScore.score}/100 (${healthBandLabel})`,
      hinglish: `Health score ${payload.healthScore.score}/100 (${healthBandLabel})`,
    }),
    summary:
      payload.budget.status === "over_budget"
        ? pickLanguageText(language, {
            en: `You need a tighter month. Hold total spend near ${formatCopilotCurrency(
              payload.budget.suggestedMonthlyBudget,
              language,
            )}.`,
            hi: `आपको इस महीने tighter control चाहिए. Total spend को लगभग ${formatCopilotCurrency(
              payload.budget.suggestedMonthlyBudget,
              language,
            )} के आसपास रखिए.`,
            hinglish: `Aapko is month tighter control chahiye. Total spend ko lagbhag ${formatCopilotCurrency(
              payload.budget.suggestedMonthlyBudget,
              language,
            )} ke aaspaas rakho.`,
          })
        : pickLanguageText(language, {
            en: `You still have about ${formatCopilotCurrency(
              Math.max(payload.budget.remainingSafeToSpend, 0),
              language,
            )} of safe room left this month.`,
            hi: `इस महीने आपके पास अभी भी लगभग ${formatCopilotCurrency(
              Math.max(payload.budget.remainingSafeToSpend, 0),
              language,
            )} की safe room बाकी है.`,
            hinglish: `Is month aapke paas abhi bhi lagbhag ${formatCopilotCurrency(
              Math.max(payload.budget.remainingSafeToSpend, 0),
              language,
            )} ki safe room baki hai.`,
          }),
    action:
      payload.behaviorInsights.items[0]?.title ||
      payload.nudges[0]?.action ||
      pickLanguageText(language, {
        en: "Protect your next few days of spending",
        hi: "अगले कुछ दिनों की spending को protect कीजिए",
        hinglish: "Agle kuch dino ki spending ko protect karo",
      }),
  };
};

const buildExamples = (language: AssistantLanguage) => {
  if (language === "hi") {
    return [
      "मेरा इस महीने safe budget कितना है?",
      "मैं ₹10,000 afford कर सकता हूँ क्या?",
      "किस expense को कम करके मैं बचत बढ़ा सकता हूँ?",
      "मेरा goal कब तक पूरा होगा?",
      "मेरे spending patterns में क्या चल रहा है?",
    ];
  }

  if (language === "hinglish") {
    return [
      "Mera is month safe budget kitna hai?",
      "Main ₹10,000 afford kar sakta hoon kya?",
      "Kis expense ko cut karke main bachat badha sakta hoon?",
      "Mera goal kab tak complete hoga?",
      "Mere spending patterns mein kya chal raha hai?",
    ];
  }

  return [
    "What is my safe budget this month?",
    "Can I afford ₹10,000 right now?",
    "Where can I save more this month?",
    "When will I hit my goal?",
    "What spending behavior should I watch?",
  ];
};

export const buildFinancialCopilot = async (params: {
  userId: number;
  language?: string | null;
  fallbackMessage?: string;
  decisionAmount?: number | null;
}): Promise<FinancialCopilotPayload> => {
  const language = resolveCopilotLanguage(params.language, params.fallbackMessage);
  const dataset = await buildCopilotDataset(params.userId);
  const reminders = buildReminderEngine(language, dataset);
  const budget = buildBudgetEngine({
    language,
    dataset,
    fixedExpenseEstimate: reminders.fixedExpenseEstimate,
  });
  const savings = buildSavingsEngine(language, dataset);
  const healthScore = buildHealthScoreEngine({
    language,
    dataset,
    budget,
  });
  const behaviorInsights = buildBehaviorEngine(language, dataset);
  const goals = buildGoalTrackerEngine({
    language,
    dataset,
    budget,
  });
  const decision = buildDecisionEngine({
    language,
    dataset,
    budget,
    reminders: reminders.items,
    goals,
    amount: params.decisionAmount ?? null,
  });
  const nudges = buildNudgeEngine({
    language,
    budget,
    reminders: reminders.items,
    savingsOpportunities: savings.opportunities,
    goals,
  });

  const payloadWithoutOverview = {
    budget,
    savings,
    reminders: {
      summary: reminders.summary,
      items: reminders.items,
    },
    healthScore,
    behaviorInsights,
    nudges,
    goals,
    decision,
  };

  return {
    generatedAt: new Date().toISOString(),
    language,
    overview: buildOverview({
      language,
      payload: payloadWithoutOverview,
    }),
    ...payloadWithoutOverview,
    examples: buildExamples(language),
  };
};

export const listCopilotGoals = async (userId: number) => listFinancialGoals(userId);

export const createCopilotGoal = async (params: {
  userId: number;
  title: string;
  emoji?: string | null;
  targetAmount: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
}) => createFinancialGoal(params);

export const updateCopilotGoal = async (params: {
  userId: number;
  goalId: number;
  title?: string;
  emoji?: string | null;
  targetAmount?: number;
  currentAmount?: number;
  monthlyContributionTarget?: number | null;
  targetDate?: string | null;
}) => updateFinancialGoal(params);

export const deleteCopilotGoal = async (params: {
  userId: number;
  goalId: number;
}) => deleteFinancialGoal(params);
