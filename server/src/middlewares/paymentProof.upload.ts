import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import path from "path";
import { sendResponse } from "../utils/sendResponse.js";
import { matchesAllowedUploadKinds } from "../lib/fileUploadSecurity.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/pdf",
]);
const ALLOWED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (
      ALLOWED_MIME_TYPES.has(file.mimetype) &&
      ALLOWED_EXTENSIONS.has(extension)
    ) {
      cb(null, true);
      return;
    }

    cb(
      Object.assign(
        new Error("Only JPG, JPEG, PNG, WEBP, and PDF payment proofs are allowed."),
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
  upload.fields([
    { name: "paymentProof", maxCount: 1 },
    { name: "screenshot", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (!err) {
      const files = req.files as
        | Record<string, Express.Multer.File[]>
        | undefined;
      const paymentProof = files?.paymentProof?.[0] ?? files?.screenshot?.[0];
      if (paymentProof) {
        if (
          !matchesAllowedUploadKinds(paymentProof.buffer, [
            "png",
            "jpeg",
            "webp",
            "pdf",
          ])
        ) {
          sendResponse(res, 400, {
            message: "The uploaded payment proof content does not match a supported file format.",
          });
          return;
        }

        (req as Request & { file?: Express.Multer.File }).file = paymentProof;
      }
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        sendResponse(res, 400, {
          message: "Payment proof size must not exceed 5MB.",
        });
        return;
      }

      sendResponse(res, 400, { message: err.message });
      return;
    }

    const status = (err as { status?: number }).status ?? 400;
    const message =
      err instanceof Error ? err.message : "Invalid payment proof upload.";

    sendResponse(res, status, { message });
  });
};
