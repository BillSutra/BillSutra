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

    try {
      const body = req.body as AssistantQueryInput;
      const reply = await answerAssistantQuery({
        userId,
        message: body.message,
        history: body.history,
      });

      return sendResponse(res, 200, { data: reply });
    } catch (error) {
      console.error("Assistant query error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Assistant request failed",
      });
    }
  }
}

export default AssistantController;
