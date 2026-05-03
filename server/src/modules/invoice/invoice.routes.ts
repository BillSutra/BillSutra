import { Router } from "express";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import RequireFeatureAccessMiddleware from "../../middlewares/RequireFeatureAccessMiddleware.js";
import RequirePermissionMiddleware from "../../middlewares/RequirePermissionMiddleware.js";
import validate from "../../middlewares/validate.js";
import {
  idParamSchema,
  invoiceCreateSchema,
  invoiceEmailRequestSchema,
  invoicePreviewPdfRequestSchema,
  invoiceUpdateSchema,
} from "../../validations/apiValidations.js";
import {
  bootstrap,
  destroy,
  duplicate as duplicateInvoice,
  index,
  pdf,
  previewPdf,
  reminder,
  send,
  show,
  store,
  update,
} from "./invoice.controller.js";

const router = Router();

router.get("/", AuthMiddleware, index);
router.get("/bootstrap", AuthMiddleware, bootstrap);
router.post(
  "/preview-pdf",
  AuthMiddleware,
  validate({ body: invoicePreviewPdfRequestSchema }),
  previewPdf,
);
router.post(
  "/",
  AuthMiddleware,
  RequirePermissionMiddleware("invoice:create", {
    logEvent: "[invoice.create.auth]",
    message: "You don't have permission to create invoices.",
  }),
  RequireFeatureAccessMiddleware("INVOICE_CREATE"),
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
