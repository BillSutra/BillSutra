import { API_URL } from "./apiEndPoints";
import type {
  LandingAssistantHistoryMessage,
  LandingAssistantLanguage,
  LandingAssistantReply,
} from "../../../server/src/modules/landing-assistant/landingAssistant.contract";

type LandingAssistantApiResponse = {
  data?: LandingAssistantReply;
  message?: string;
};

export const queryLandingAssistant = async (params: {
  message: string;
  language: LandingAssistantLanguage;
  history?: LandingAssistantHistoryMessage[];
}) => {
  const response = await fetch(`${API_URL}/assistant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      language: params.language,
      history: params.history,
    }),
  });

  const payload = (await response.json()) as LandingAssistantApiResponse;

  if (!response.ok || !payload.data) {
    throw new Error(
      payload.message || "Assistant is unavailable right now. Please try again.",
    );
  }

  return payload.data;
};
