import multer from "multer";
import type { Request, Response, NextFunction } from "express";
import path from "path";
import { sendResponse } from "../utils/sendResponse.js";
import { matchesAllowedUploadKinds } from "../lib/fileUploadSecurity.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SIZE_MB = Math.round(MAX_SIZE_BYTES / (1024 * 1024));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES, files: 1 },
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
        new Error("Unsupported image format. Upload a JPG, PNG, or WEBP image."),
        { status: 400 },
      ),
    );
  },
});

const getUploadedWorkerPhoto = (req: Request) => {
  const files = req.files as
    | Partial<Record<"profilePhoto" | "photo", Express.Multer.File[]>>
    | undefined;

  return files?.profilePhoto?.[0] ?? files?.photo?.[0] ?? null;
};

export const workerPhotoUploadMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (!err) {
      const uploadedPhoto = getUploadedWorkerPhoto(req);
      if (uploadedPhoto) {
        req.file = uploadedPhoto;
      }

      console.info("[worker] profile_photo_upload_received", {
        route: "/api/worker/profile/photo",
        fileSize: req.file?.size ?? null,
        mime: req.file?.mimetype ?? null,
        workerId: req.user?.workerId ?? null,
      });

      if (
        req.file &&
        !matchesAllowedUploadKinds(req.file.buffer, ["png", "jpeg", "webp"])
      ) {
        console.warn("[worker] profile_photo_upload_rejected", {
          route: "/api/worker/profile/photo",
          reason: "content_type_mismatch",
          fileSize: req.file.size,
          mime: req.file.mimetype,
          workerId: req.user?.workerId ?? null,
        });
        return sendResponse(res, 400, {
          message: "Unsupported image format. Upload a JPG, PNG, or WEBP image.",
        });
      }

      return next();
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        console.warn("[worker] profile_photo_upload_rejected", {
          route: "/api/worker/profile/photo",
          reason: "file_too_large",
          maxSizeBytes: MAX_SIZE_BYTES,
          workerId: req.user?.workerId ?? null,
        });
        return sendResponse(res, 400, {
          message: `Image exceeds ${MAX_SIZE_MB}MB limit.`,
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return sendResponse(res, 400, {
          message: "Upload the profile photo using the profilePhoto field.",
        });
      }
      return sendResponse(res, 400, { message: err.message });
    }

    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : "Invalid file upload.";
    console.warn("[worker] profile_photo_upload_rejected", {
      route: "/api/worker/profile/photo",
      reason: "validation_failed",
      message,
      workerId: req.user?.workerId ?? null,
    });
    return sendResponse(res, status, { message });
  });
};
