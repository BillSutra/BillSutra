import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import validate from "../../middlewares/validate.js";
import {
  idParamSchema,
  invoiceCreateSchema,
  invoiceEmailRequestSchema,
  invoiceUpdateSchema,
} from "../../validations/apiValidations.js";
import {
  destroy,
  duplicate as duplicateInvoice,
  index,
  pdf,
  reminder,
  send,
  show,
  store,
  update,
} from "./invoice.controller.js";

const router = Router();

router.get("/", AuthMiddleware, index);
router.post(
  "/",
  AuthMiddleware,
  validate({ body: invoiceCreateSchema }),
  store,
);
router.get("/:id", AuthMiddleware, validate({ params: idParamSchema }), show);
router.put(
  "/:id",
  AuthMiddleware,
  validate({ params: idParamSchema, body: invoiceUpdateSchema }),
  update,
);
router.get(
  "/:id/pdf",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  pdf,
);
router.post(
  "/:id/duplicate",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  duplicateInvoice,
);
router.post(
  "/:id/send",
  AuthMiddleware,
  validate({ params: idParamSchema, body: invoiceEmailRequestSchema }),
  send,
);
router.post(
  "/:id/reminder",
  AuthMiddleware,
  validate({ params: idParamSchema, body: invoiceEmailRequestSchema }),
  reminder,
);
router.delete(
  "/:id",
  AuthMiddleware,
  validate({ params: idParamSchema }),
  destroy,
);

export default router;
