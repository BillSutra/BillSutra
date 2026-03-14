import { Router, type RequestHandler } from "express";
import multer, { type FileFilterCallback } from "multer";
import AuthMiddleware from "../../middlewares/AuthMIddleware.js";
import { sendResponse } from "../../utils/sendResponse.js";
import {
  downloadClientTemplateController,
  downloadInvoiceItemsTemplateController,
  downloadInvoiceTemplateController,
  downloadProductTemplateController,
  importClientsController,
  importInvoiceItemsController,
  importInvoicesController,
  importProductsController,
} from "./import.controller.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb: FileFilterCallback) => {
    const fileName = file.originalname.toLowerCase();
    const allowedExtensions =
      fileName.endsWith(".csv") || fileName.endsWith(".xlsx");
    const allowedMimeTypes = [
      "text/csv",
      "application/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ].includes(file.mimetype);

    if (!allowedExtensions && !allowedMimeTypes) {
      cb(new Error("Only CSV and XLSX files are allowed"));
      return;
    }

    cb(null, true);
  },
});

const uploadFile: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      sendResponse(res, 413, {
        message: "File exceeds 5MB limit",
      });
      return;
    }

    const message = err instanceof Error ? err.message : "Invalid file upload";
    sendResponse(res, 400, { message });
  });
};

router.post("/clients", AuthMiddleware, uploadFile, importClientsController);
router.post("/products", AuthMiddleware, uploadFile, importProductsController);
router.post("/invoices", AuthMiddleware, uploadFile, importInvoicesController);
router.post(
  "/invoice-items",
  AuthMiddleware,
  uploadFile,
  importInvoiceItemsController,
);

router.get(
  "/templates/clients",
  AuthMiddleware,
  downloadClientTemplateController,
);
router.get(
  "/templates/products",
  AuthMiddleware,
  downloadProductTemplateController,
);
router.get(
  "/templates/invoices",
  AuthMiddleware,
  downloadInvoiceTemplateController,
);
router.get(
  "/templates/invoice-items",
  AuthMiddleware,
  downloadInvoiceItemsTemplateController,
);

export default router;
