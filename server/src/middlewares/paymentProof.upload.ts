import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { sendResponse } from "../utils/sendResponse.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(
      Object.assign(
        new Error("Only PNG, JPG, and WEBP screenshots are allowed."),
        {
          status: 400,
        },
      ),
    );
  },
});

export const paymentProofUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload.single("screenshot")(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        sendResponse(res, 400, {
          message: "Screenshot size must not exceed 5MB.",
        });
        return;
      }

      sendResponse(res, 400, { message: err.message });
      return;
    }

    const status = (err as { status?: number }).status ?? 400;
    const message =
      err instanceof Error ? err.message : "Invalid screenshot upload.";

    sendResponse(res, status, { message });
  });
};
