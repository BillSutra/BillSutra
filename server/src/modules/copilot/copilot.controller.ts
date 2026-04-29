import type { Request, Response } from "express";
import { sendResponse } from "../../utils/sendResponse.js";
import {
  createCopilotGoal,
  deleteCopilotGoal,
  listCopilotGoals,
  updateCopilotGoal,
} from "./copilot.service.js";
import { buildDashboardQuickInsights } from "../../services/dashboardQuickInsights.service.js";
import type {
  CopilotGoalCreateInput,
  CopilotGoalParamInput,
  CopilotGoalUpdateInput,
  CopilotSummaryQueryInput,
} from "./copilot.schema.js";

class CopilotController {
  static async summary(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const query = req.query as unknown as CopilotSummaryQueryInput;
      const [insights, goals] = await Promise.all([
        buildDashboardQuickInsights({
          userId,
          language: query.language,
          filters: { range: "30d", granularity: "day" },
        }),
        listCopilotGoals(userId),
      ]);

      const data = {
        deprecated: true,
        redirect: "/dashboard/quick-insights",
        generatedAt: insights.generatedAt,
        language: query.language ?? "en",
        overview: {
          headline: insights.headline,
          summary: insights.summary,
          action:
            "Quick Insights now replaces the old copilot summary for faster business guidance.",
        },
        quickInsights: insights.items,
        goals: {
          count: goals.length,
          items: goals.slice(0, 5),
        },
      };

      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Copilot summary error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Copilot request failed",
      });
    }
  }

  static async listGoals(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const data = await listCopilotGoals(userId);
      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("List copilot goals error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Unable to load goals",
      });
    }
  }

  static async createGoal(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const body = req.body as CopilotGoalCreateInput;
      const data = await createCopilotGoal({
        userId,
        ...body,
      });

      return sendResponse(res, 201, { data });
    } catch (error) {
      console.error("Create copilot goal error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Unable to create goal",
      });
    }
  }

  static async updateGoal(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const body = req.body as CopilotGoalUpdateInput;
      const params = req.params as unknown as CopilotGoalParamInput;
      const data = await updateCopilotGoal({
        userId,
        goalId: params.id,
        ...body,
      });

      if (!data) {
        return sendResponse(res, 404, { message: "Goal not found" });
      }

      return sendResponse(res, 200, { data });
    } catch (error) {
      console.error("Update copilot goal error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Unable to update goal",
      });
    }
  }

  static async deleteGoal(req: Request, res: Response) {
    const userId = req.user?.id;
    if (!userId) {
      return sendResponse(res, 401, { message: "Unauthorized" });
    }

    try {
      const params = req.params as unknown as CopilotGoalParamInput;
      const deleted = await deleteCopilotGoal({
        userId,
        goalId: params.id,
      });

      if (!deleted) {
        return sendResponse(res, 404, { message: "Goal not found" });
      }

      return sendResponse(res, 200, { data: { success: true } });
    } catch (error) {
      console.error("Delete copilot goal error:", error);
      return sendResponse(res, 500, {
        message: error instanceof Error ? error.message : "Unable to delete goal",
      });
    }
  }
}

export default CopilotController;
