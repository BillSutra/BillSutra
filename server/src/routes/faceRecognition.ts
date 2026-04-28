import { Router } from "express";
import * as FaceRecognitionController from "../controllers/FaceRecognitionController.js";
import AuthMiddleware from "../middlewares/AuthMIddleware.js";
import {
  faceAuthRateLimiter,
  uploadRateLimiter,
} from "../middlewares/rateLimit.middleware.js";
import multer from "multer";
import type { NextFunction, Request, Response } from "express";
import { matchesAllowedUploadKinds } from "../lib/fileUploadSecurity.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);
    if (allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
  },
});

const wrap =
  (
    handler: (
      req: Request,
      res: Response,
      next?: NextFunction,
    ) => Promise<unknown> | unknown,
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      return next(error);
    }
  };

const uploadImage = (req: Request, res: Response, next: NextFunction) => {
  upload.single("image")(req, res, (err: unknown) => {
    if (!err) {
      if (
        req.file &&
        !matchesAllowedUploadKinds(req.file.buffer, ["png", "jpeg"])
      ) {
        return res.status(400).json({
          success: false,
          message: "The uploaded face image content does not match a supported format.",
          error: "The uploaded face image content does not match a supported format.",
          code: "INVALID_FILE_TYPE",
        });
      }

      return next();
    }

    if (err instanceof multer.MulterError) {
      const fileSizeError = err.code === "LIMIT_FILE_SIZE";
      const invalidFileTypeError = err.code === "LIMIT_UNEXPECTED_FILE";
      return res.status(fileSizeError ? 413 : 400).json({
        success: false,
        message: fileSizeError
          ? "Image is too large. Please use an image smaller than 5MB."
          : invalidFileTypeError
            ? "Invalid file type. Please upload a JPG or PNG image."
            : err.message,
        error: fileSizeError
          ? "Image is too large. Please use an image smaller than 5MB."
          : invalidFileTypeError
            ? "Invalid file type. Please upload a JPG or PNG image."
            : err.message,
        code: fileSizeError
          ? "FILE_TOO_LARGE"
          : invalidFileTypeError
            ? "INVALID_FILE_TYPE"
            : "INVALID_REQUEST",
      });
    }

    console.error("[Face Route] Upload middleware error", {
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });

    return res.status(400).json({
      success: false,
      message: "Invalid upload request.",
      error: "Invalid upload request.",
      code: "INVALID_REQUEST",
    });
  });
};

/**
 * Face Registration
 * POST /api/face/register
 * Requires: Authentication
 * Body: Image file or base64 image data
 */
router.post(
  "/register",
  AuthMiddleware,
  faceAuthRateLimiter,
  uploadRateLimiter,
  uploadImage,
  wrap(FaceRecognitionController.registerFace),
);

/**
 * Face Authentication (Login)
 * POST /api/face/authenticate
 * Body: multipart/form-data with image + email, or legacy JSON { email, imageData (base64) }
 */
router.post(
  "/authenticate",
  faceAuthRateLimiter,
  uploadRateLimiter,
  uploadImage,
  wrap(FaceRecognitionController.authenticateFace),
);

/**
 * Get registered face profile data
 * GET /api/face
 * Requires: Authentication
 */
router.get("/", AuthMiddleware, wrap(FaceRecognitionController.getFaceData));

/**
 * Check Face Registration Status
 * GET /api/face/check
 * Requires: Authentication
 */
router.get(
  "/check",
  AuthMiddleware,
  wrap(FaceRecognitionController.checkFaceRegistration),
);

/**
 * Delete Face Data
 * DELETE /api/face
 * Requires: Authentication
 */
router.delete("/", AuthMiddleware, wrap(FaceRecognitionController.deleteFaceData));

/**
 * Delete Face Data
 * POST /api/face/delete
 * Requires: Authentication
 */
router.post(
  "/delete",
  AuthMiddleware,
  wrap(FaceRecognitionController.deleteFaceData),
);

export default router;
