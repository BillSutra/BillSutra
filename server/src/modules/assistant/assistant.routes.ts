import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import { assistantRateLimiter } from "../../middlewares/rateLimit.middleware.js";
import validate from "../../middlewares/validate.js";
import AssistantController from "./assistant.controller.js";
import { assistantQuerySchema } from "./assistant.schema.js";

const router = Router();

router.post(
  "/query",
  AuthMiddleware,
  assistantRateLimiter,
  validate({ body: assistantQuerySchema }),
  AssistantController.query,
);

export default router;
