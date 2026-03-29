import type { AssistantLanguage } from "../../assistant/assistant.language.js";
import { formatCopilotCurrency, pickLanguageText } from "../copilot.language.js";
import type {
  CopilotBudgetInsight,
  CopilotDecision,
  CopilotDataset,
  CopilotGoalSummary,
  CopilotReminderItem,
} from "../copilot.types.js";
import { roundMetric } from "../copilot.utils.js";

export const buildDecisionEngine = (params: {
  language: AssistantLanguage;
  dataset: CopilotDataset;
  budget: CopilotBudgetInsight;
  reminders: CopilotReminderItem[];
  goals: CopilotGoalSummary;
  amount: number | null;
}): CopilotDecision | null => {
  const { language, dataset, budget, reminders, goals, amount } = params;
  if (amount == null || amount <= 0) {
    return null;
  }

  const reserveForDueBills = reminders
    .filter((item) => item.daysUntilDue != null && item.daysUntilDue <= 7)
    .reduce((total, item) => total + item.monthlyAmount, 0);
  const currentBalanceEstimate = Math.max(
    dataset.forecast.cashflow.trailing30Days.balanceEstimate,
    0,
  );
  const projectedClosingBalance = Math.max(
    dataset.forecast.cashflow.projected30Days.closingBalanceEstimate,
    0,
  );
  const budgetHeadroom = Math.max(budget.remainingSafeToSpend - reserveForDueBills, 0);
  const cashHeadroom = Math.max(currentBalanceEstimate - reserveForDueBills, 0);
  const safeHeadroom = Math.min(
    budgetHeadroom > 0 ? budgetHeadroom : Number.POSITIVE_INFINITY,
    cashHeadroom > 0 ? cashHeadroom : Number.POSITIVE_INFINITY,
  );
  const normalizedSafeHeadroom = Number.isFinite(safeHeadroom)
    ? safeHeadroom
    : Math.max(budgetHeadroom, cashHeadroom, 0);
  const warningHeadroom =
    normalizedSafeHeadroom +
    Math.max(goals.projectedMonthlySavings * 0.25, 0) +
    Math.max(budget.dailySafeSpend * 4, 0);

  const budgetOvershoot = Math.max(amount - Math.max(budget.remainingSafeToSpend, 0), 0);
  const verdict =
    amount <= normalizedSafeHeadroom * 0.85
      ? "safe"
      : amount <= warningHeadroom
        ? "warning"
        : "risky";

  const shortfall = Math.max(amount - normalizedSafeHeadroom, 0);
  const suggestedDelayDays =
    verdict === "warning" || verdict === "risky"
      ? Math.max(2, Math.ceil(shortfall / Math.max(budget.dailySafeSpend, 1)))
      : 0;
  const safeRoomAfterPurchase = roundMetric(
    normalizedSafeHeadroom - amount,
    0,
  );
  const reserveLabel = formatCopilotCurrency(reserveForDueBills, language);
  const roomLabel = formatCopilotCurrency(Math.max(safeRoomAfterPurchase, 0), language);
  const overshootLabel = formatCopilotCurrency(
    Math.max(budgetOvershoot, shortfall, 0),
    language,
  );

  return {
    amount: roundMetric(amount, 0),
    verdict,
    summary:
      verdict === "safe"
        ? pickLanguageText(language, {
            en: "Yes, you can afford this comfortably.",
            hi: "हाँ, आप इसे आराम से afford कर सकते हैं.",
            hinglish: "Haan, yeh comfortably afford ho jayega.",
          })
        : verdict === "warning"
          ? pickLanguageText(language, {
              en: "Yes, but this will leave your budget tight.",
              hi: "हाँ, लेकिन इससे आपका बजट टाइट हो जाएगा.",
              hinglish: "Haan, lekin isse budget tight ho jayega.",
            })
          : pickLanguageText(language, {
              en: "No, this looks risky right now.",
              hi: "नहीं, यह अभी risky लग रहा है.",
              hinglish: "Nahi, yeh abhi risky lag raha hai.",
            }),
    explanation:
      verdict === "safe"
        ? pickLanguageText(language, {
            en: `${formatCopilotCurrency(
              amount,
              language,
            )} fits within your remaining budget. After keeping ${reserveLabel} aside for upcoming bills, you should still have about ${roomLabel} of safe room left.`,
            hi: `${formatCopilotCurrency(
              amount,
              language,
            )} आपके बचे हुए बजट के अंदर है. आने वाले bills के लिए ${reserveLabel} अलग रखने के बाद भी आपके पास करीब ${roomLabel} की safe room बचेगी.`,
            hinglish: `${formatCopilotCurrency(
              amount,
              language,
            )} aapke remaining budget ke andar hai. Upcoming bills ke liye ${reserveLabel} side rakhne ke baad bhi lagbhag ${roomLabel} ki safe room bachegi.`,
          })
        : verdict === "warning"
          ? pickLanguageText(language, {
              en: `${formatCopilotCurrency(
                amount,
                language,
              )} is possible, but it will consume most of your cushion. You may need to keep the next few days light or delay this by about ${suggestedDelayDays} days.`,
              hi: `${formatCopilotCurrency(
                amount,
                language,
              )} possible है, लेकिन इससे आपका ज्यादातर cushion खत्म हो जाएगा. अगले कुछ दिन spending हल्की रखनी पड़ सकती है या इसे करीब ${suggestedDelayDays} दिन delay करना बेहतर रहेगा.`,
              hinglish: `${formatCopilotCurrency(
                amount,
                language,
              )} possible hai, lekin isse aapka zyada cushion use ho jayega. Agle kuch din spend halka rakhna padega ya ise lagbhag ${suggestedDelayDays} din delay karna better rahega.`,
            })
          : pickLanguageText(language, {
              en: `${formatCopilotCurrency(
                amount,
                language,
              )} may push you over by about ${overshootLabel}. You also have ${reserveLabel} of upcoming bills to protect, so spending this now could put the month under pressure.`,
              hi: `${formatCopilotCurrency(
                amount,
                language,
              )} से आप करीब ${overshootLabel} ज़्यादा निकल सकते हैं. साथ ही ${reserveLabel} के upcoming bills भी हैं, इसलिए अभी spend करना महीने को दबाव में डाल सकता है.`,
              hinglish: `${formatCopilotCurrency(
                amount,
                language,
              )} se aap lagbhag ${overshootLabel} se over ja sakte ho. Saath hi ${reserveLabel} ke upcoming bills bhi hain, isliye abhi spend karna month ko pressure mein daal sakta hai.`,
            }),
    suggestedDelayDays,
    impactOnBudget: roundMetric(budgetOvershoot, 0),
    safeRoomAfterPurchase,
    reserveForUpcomingExpenses: roundMetric(reserveForDueBills, 0),
    currentBalanceEstimate: roundMetric(currentBalanceEstimate, 0),
    projectedClosingBalance: roundMetric(projectedClosingBalance, 0),
  };
};
