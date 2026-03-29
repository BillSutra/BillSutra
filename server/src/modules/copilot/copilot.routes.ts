import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import validate from "../../middlewares/validate.js";
import CopilotController from "./copilot.controller.js";
import {
  copilotGoalCreateSchema,
  copilotGoalParamSchema,
  copilotGoalUpdateSchema,
  copilotSummaryQuerySchema,
} from "./copilot.schema.js";

const router = Router();

router.get(
  "/summary",
  AuthMiddleware,
  validate({ query: copilotSummaryQuerySchema }),
  CopilotController.summary,
);

router.get("/goals", AuthMiddleware, CopilotController.listGoals);

router.post(
  "/goals",
  AuthMiddleware,
  validate({ body: copilotGoalCreateSchema }),
  CopilotController.createGoal,
);

router.put(
  "/goals/:id",
  AuthMiddleware,
  validate({ params: copilotGoalParamSchema, body: copilotGoalUpdateSchema }),
  CopilotController.updateGoal,
);

router.delete(
  "/goals/:id",
  AuthMiddleware,
  validate({ params: copilotGoalParamSchema }),
  CopilotController.deleteGoal,
);

export default router;
