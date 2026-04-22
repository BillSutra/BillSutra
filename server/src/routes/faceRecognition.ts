import { Router } from "express";
import * as FaceRecognitionController from "../controllers/FaceRecognitionController.js";
import AuthMiddleware from "../middlewares/AuthMIddleware.js";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Face Registration
 * POST /api/face/register
 * Requires: Authentication
 * Body: Image file or base64 image data
 */
router.post("/register", AuthMiddleware, upload.single("image"), FaceRecognitionController.registerFace);

/**
 * Face Authentication (Login)
 * POST /api/face/authenticate
 * Body: { email, imageData (base64) }
 */
router.post("/authenticate", FaceRecognitionController.authenticateFace);

/**
 * Check Face Registration Status
 * GET /api/face/check
 * Requires: Authentication
 */
router.get("/check", AuthMiddleware, FaceRecognitionController.checkFaceRegistration);

/**
 * Delete Face Data
 * POST /api/face/delete
 * Requires: Authentication
 */
router.post("/delete", AuthMiddleware, FaceRecognitionController.deleteFaceData);

export default router;
