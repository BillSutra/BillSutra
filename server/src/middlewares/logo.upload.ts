import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import { sendResponse } from "../utils/sendResponse.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
]);

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Multer instance configured with:
 *  - memory storage (buffer handed off to the storage provider)
 *  - MIME type whitelist (PNG, JPG, SVG only)
 *  - 2 MB file size limit
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        Object.assign(new Error("Only PNG, JPG, and SVG files are allowed."), {
          status: 400,
        }),
      );
    }
  },
});

/**
 * Express middleware that runs Multer for a single `logo` field and converts
 * Multer-specific errors into clean JSON responses.
 */
export const logoUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload.single("logo")(req, res, (err: unknown) => {
    if (!err) {
      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return sendResponse(res, 400, {
          message: "File size must not exceed 2MB.",
        });
      }
      return sendResponse(res, 400, { message: err.message });
    }

    // fileFilter error or other thrown error
    const status = (err as { status?: number }).status ?? 400;
    const message =
      err instanceof Error ? err.message : "Invalid file upload.";
    return sendResponse(res, status, { message });
  });
};
