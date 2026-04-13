import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import { answerAssistantQuery } from "./assistant.service.js";
import type { AssistantQueryInput } from "./assistant.schema.js";

class AssistantController {
  static async query(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    const startedAt = Date.now();

    try {
      const body = req.body as AssistantQueryInput;
      const reply = await answerAssistantQuery({
        userId,
        message: body.message,
        history: body.history,
      });

      if (process.env.NODE_ENV !== "production") {
        console.info("[assistant.controller] query completed", {
          userId,
          durationMs: Date.now() - startedAt,
        });
      }

      return sendResponse(res, 200, { data: reply });
    } catch (error) {
      console.error("[assistant.controller] query failed", {
        userId,
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : "unknown",
      });

      return sendResponse(res, 500, {
        message:
          "Assistant could not complete that request. Please try a short command like 'Show today's sales'.",
      });
    }
  }
}

export default AssistantController;
