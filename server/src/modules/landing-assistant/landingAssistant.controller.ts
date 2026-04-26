import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import { answerLandingAssistantQuery } from "./landingAssistant.service.js";
import type { LandingAssistantQueryInput } from "./landingAssistant.schema.js";

class LandingAssistantController {
  static async query(req: Request, res: Response) {
    const startedAt = Date.now();

    try {
      const body = req.body as LandingAssistantQueryInput;
      const reply = await answerLandingAssistantQuery({
        message: body.message,
        language: body.language,
        history: body.history,
      });

      if (process.env.NODE_ENV !== "production") {
        console.info("[landing-assistant] query completed", {
          durationMs: Date.now() - startedAt,
          language: reply.language,
          source: reply.source,
        });
      }

      return sendResponse(res, 200, { data: reply });
    } catch (error) {
      console.error("[landing-assistant] query failed", {
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "unknown",
      });

      return sendResponse(res, 500, {
        message:
          "Assistant could not answer right now. Please try again in a moment.",
      });
    }
  }
}

export default LandingAssistantController;
