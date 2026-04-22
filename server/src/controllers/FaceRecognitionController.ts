import type { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import prisma from "../config/db.config.js";
import { sendResponse } from "../utils/sendResponse.js";
import { recordAuthEvent } from "../lib/modernAuth.js";
import { AuthMethod } from "@prisma/client";
import { buildOwnerAuthUser, createAuthBearerToken } from "../lib/authSession.js";

// Configuration for Face Recognition Service
const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://localhost:5001";
const FACE_RECOGNITION_TIMEOUT = 30000; // 30 seconds

// Error types for debugging
enum FaceAuthError {
  NO_FACE_DETECTED = "NO_FACE_DETECTED",
  MULTIPLE_FACES = "MULTIPLE_FACES_DETECTED",
  FACE_NOT_CLEAR = "FACE_NOT_CLEAR",
  FACE_TOO_SMALL = "FACE_TOO_SMALL",
  FACE_TOO_LARGE = "FACE_TOO_LARGE",
  INVALID_IMAGE = "IMAGE_INVALID",
  IMAGE_TOO_LARGE = "IMAGE_TOO_LARGE",
  ENCODING_FAILED = "ENCODING_FAILED",
  MATCH_LOW_CONFIDENCE = "MATCH_LOW_CONFIDENCE",
  NO_MATCH = "NO_MATCH_FOUND",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  INVALID_REQUEST = "INVALID_REQUEST",
  DATABASE_ERROR = "DATABASE_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// Error messages for client
const ERROR_MESSAGES: Record<FaceAuthError, string> = {
  [FaceAuthError.NO_FACE_DETECTED]:
    "No face detected in the image. Please ensure your face is clearly visible and well-lit.",
  [FaceAuthError.MULTIPLE_FACES]:
    "Multiple faces detected. Please ensure only your face is in the frame.",
  [FaceAuthError.FACE_NOT_CLEAR]:
    "Please capture your full face clearly inside the frame (including mouth and chin) with good lighting.",
  [FaceAuthError.FACE_TOO_SMALL]:
    "Your face is too small in the image. Please move closer to the camera (12-18 inches).",
  [FaceAuthError.FACE_TOO_LARGE]:
    "Your face is too large in the image. Please move away from the camera slightly.",
  [FaceAuthError.INVALID_IMAGE]:
    "The image format is invalid or the image is corrupted. Please try with a different image.",
  [FaceAuthError.IMAGE_TOO_LARGE]:
    "The image file is too large. Please use an image smaller than 5MB.",
  [FaceAuthError.ENCODING_FAILED]:
    "Failed to process your face. Please try again with a clearer image.",
  [FaceAuthError.MATCH_LOW_CONFIDENCE]:
    "Face match confidence is too low. Please align your full face in the guide box and try again.",
  [FaceAuthError.NO_MATCH]:
    "Your face does not match the registered face. Please try again.",
  [FaceAuthError.SERVICE_UNAVAILABLE]:
    "The facial recognition service is temporarily unavailable. Please try again later.",
  [FaceAuthError.INVALID_REQUEST]:
    "Invalid request. Please ensure you've provided a valid image.",
  [FaceAuthError.DATABASE_ERROR]:
    "Database error occurred. Please contact support.",
  [FaceAuthError.INTERNAL_ERROR]:
    "An internal error occurred. Please try again later.",
};

interface FaceServiceResponse {
  success?: boolean;
  encoding?: number[];
  matched?: boolean;
  confidence?: number;
  distance?: number;
  message?: string;
  error_code?: string;
}

/**
 * Register a face for the authenticated user
 * POST /api/face/register
 */
export const registerFace = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized. Please login first.",
        error_code: FaceAuthError.INVALID_REQUEST,
      });
    }

    // Validate image data
    if (!req.file && !req.body?.imageData) {
      return sendResponse(res, 400, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.INVALID_REQUEST],
        error_code: FaceAuthError.INVALID_REQUEST,
      });
    }

    const imageBuffer = req.file
      ? req.file.buffer
      : Buffer.from(req.body.imageData, "base64");

    if (!imageBuffer || imageBuffer.length === 0) {
      return sendResponse(res, 400, {
        success: false,
        message: "No image data provided.",
        error_code: FaceAuthError.INVALID_REQUEST,
      });
    }

    console.log(
      `[Face Register] User ${userId}: Image size: ${imageBuffer.length} bytes`
    );

    // Call Python face recognition service
    let faceResponse: FaceServiceResponse;
    try {
      const axiosResponse = await axios.post(
        `${FACE_SERVICE_URL}/api/face/register`,
        imageBuffer,
        {
          headers: {
            "Content-Type": "application/octet-stream",
          },
          timeout: FACE_RECOGNITION_TIMEOUT,
        }
      );
      faceResponse = axiosResponse.data;
    } catch (error) {
      console.error(
        `[Face Register] Service error for user ${userId}:`,
        error instanceof AxiosError ? error.message : error
      );

      if (error instanceof AxiosError && error.code === "ECONNREFUSED") {
        return sendResponse(res, 503, {
          success: false,
          message: ERROR_MESSAGES[FaceAuthError.SERVICE_UNAVAILABLE],
          error_code: FaceAuthError.SERVICE_UNAVAILABLE,
        });
      }

      if (error instanceof AxiosError && error.response?.data) {
        const serviceError = error.response.data as FaceServiceResponse;
        return sendResponse(res, 400, {
          success: false,
          message:
            ERROR_MESSAGES[serviceError.error_code as FaceAuthError] ||
            ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
          error_code: serviceError.error_code,
          debug_error: serviceError.message,
        });
      }

      return sendResponse(res, 500, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
        error_code: FaceAuthError.INTERNAL_ERROR,
      });
    }

    // Check if face registration was successful
    if (!faceResponse.success || !faceResponse.encoding) {
      console.log(
        `[Face Register] Failed for user ${userId}: ${faceResponse.error_code}`
      );

      return sendResponse(res, 400, {
        success: false,
        message:
          ERROR_MESSAGES[faceResponse.error_code as FaceAuthError] ||
          ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
        error_code: faceResponse.error_code,
      });
    }

    // Store face encoding in database
    try {
      const existingFaceData = await prisma.faceData.findUnique({
        where: { user_id: userId },
      });

      if (existingFaceData) {
        // Update existing face data
        await prisma.faceData.update({
          where: { user_id: userId },
          data: {
            face_encoding: JSON.stringify(faceResponse.encoding),
            face_encoding_json: JSON.stringify(faceResponse.encoding),
            updated_at: new Date(),
          },
        });
        console.log(`[Face Register] Updated face data for user ${userId}`);
      } else {
        // Create new face data
        await prisma.faceData.create({
          data: {
            user_id: userId,
            face_encoding: JSON.stringify(faceResponse.encoding),
            face_encoding_json: JSON.stringify(faceResponse.encoding),
            is_enabled: true,
          },
        });
        console.log(`[Face Register] Created new face data for user ${userId}`);
      }

      // Record auth event
      await recordAuthEvent({
        req,
        userId,
        method: AuthMethod.FACE_RECOGNITION,
        success: true,
        actorType: "user",
        metadata: { action: "face_registration" },
      });

      return sendResponse(res, 200, {
        success: true,
        message: "Face registered successfully. You can now use facial recognition to login.",
        error_code: null,
      });
    } catch (dbError) {
      console.error(
        `[Face Register] Database error for user ${userId}:`,
        dbError
      );

      await recordAuthEvent({
        req,
        userId,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: { action: "face_registration", error: "database_error" },
      });

      return sendResponse(res, 500, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.DATABASE_ERROR],
        error_code: FaceAuthError.DATABASE_ERROR,
      });
    }
  } catch (error) {
    console.error("[Face Register] Unexpected error:", error);

    return sendResponse(res, 500, {
      success: false,
      message: ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
      error_code: FaceAuthError.INTERNAL_ERROR,
    });
  }
};

/**
 * Authenticate user with face recognition
 * POST /api/face/authenticate
 */
export const authenticateFace = async (req: Request, res: Response) => {
  try {
    const { email, imageData } = req.body;

    if (!email || !imageData) {
      return sendResponse(res, 400, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.INVALID_REQUEST],
        error_code: FaceAuthError.INVALID_REQUEST,
      });
    }

    console.log(`[Face Auth] Attempt for email: ${email}`);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { face_data: true },
    });

    if (!user) {
      console.log(`[Face Auth] User not found: ${email}`);

      await recordAuthEvent({
        req,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: { email, error: "user_not_found" },
      });

      return sendResponse(res, 401, {
        success: false,
        message: "User not found or face not registered.",
        error_code: "USER_NOT_FOUND",
      });
    }

    if (!user.face_data || !user.face_data.is_enabled) {
      console.log(`[Face Auth] No face data registered for user: ${user.id}`);

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: { error: "no_face_registered" },
      });

      return sendResponse(res, 400, {
        success: false,
        message: "No face registered for this account. Please register a face first.",
        error_code: "NO_FACE_REGISTERED",
      });
    }

    // Convert image data to buffer
    const imageBuffer = Buffer.from(imageData, "base64");

    if (!imageBuffer || imageBuffer.length === 0) {
      return sendResponse(res, 400, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.INVALID_REQUEST],
        error_code: FaceAuthError.INVALID_REQUEST,
      });
    }

    console.log(
      `[Face Auth] User ${user.id}: Image size: ${imageBuffer.length} bytes`
    );

    // Parse stored encoding
    let storedEncoding: number[];
    try {
      storedEncoding = JSON.parse(user.face_data.face_encoding_json);
    } catch (parseError) {
      console.error(
        `[Face Auth] Failed to parse stored encoding for user ${user.id}:`,
        parseError
      );

      return sendResponse(res, 500, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.DATABASE_ERROR],
        error_code: FaceAuthError.DATABASE_ERROR,
      });
    }

    // Call Python face recognition service
    let faceResponse: FaceServiceResponse;
    try {
      const axiosResponse = await axios.post(
        `${FACE_SERVICE_URL}/api/face/authenticate`,
        {
          image: imageBuffer.toString("base64"),
          encoding: storedEncoding,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: FACE_RECOGNITION_TIMEOUT,
        }
      );
      faceResponse = axiosResponse.data;
    } catch (error) {
      console.error(
        `[Face Auth] Service error for user ${user.id}:`,
        error instanceof AxiosError ? error.message : error
      );

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: { error: "service_error" },
      });

      if (error instanceof AxiosError && error.code === "ECONNREFUSED") {
        return sendResponse(res, 503, {
          success: false,
          message: ERROR_MESSAGES[FaceAuthError.SERVICE_UNAVAILABLE],
          error_code: FaceAuthError.SERVICE_UNAVAILABLE,
        });
      }

      if (error instanceof AxiosError && error.response?.data) {
        const serviceError = error.response.data as FaceServiceResponse;
        return sendResponse(res, 400, {
          success: false,
          message:
            ERROR_MESSAGES[serviceError.error_code as FaceAuthError] ||
            ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
          error_code: serviceError.error_code,
          debug_error: serviceError.message,
        });
      }

      return sendResponse(res, 500, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
        error_code: FaceAuthError.INTERNAL_ERROR,
      });
    }

    // Check if face authentication was successful
    if (!faceResponse.success) {
      console.log(
        `[Face Auth] Service error for user ${user.id}: ${faceResponse.error_code}`
      );

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: {
          error: faceResponse.error_code,
          distance: faceResponse.distance,
          confidence: faceResponse.confidence,
        },
      });

      return sendResponse(res, 400, {
        success: false,
        message:
          ERROR_MESSAGES[faceResponse.error_code as FaceAuthError] ||
          ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
        error_code: faceResponse.error_code,
      });
    }

    if (!faceResponse.matched) {
      console.log(
        `[Face Auth] Face not matched for user ${user.id}. Distance: ${faceResponse.distance}, Confidence: ${faceResponse.confidence}`
      );

      await recordAuthEvent({
        req,
        userId: user.id,
        method: AuthMethod.FACE_RECOGNITION,
        success: false,
        actorType: "user",
        metadata: {
          matched: false,
          distance: faceResponse.distance,
          confidence: faceResponse.confidence,
        },
      });

      return sendResponse(res, 401, {
        success: false,
        message: ERROR_MESSAGES[FaceAuthError.NO_MATCH],
        error_code: FaceAuthError.NO_MATCH,
        debug_info: {
          distance: faceResponse.distance,
          confidence: faceResponse.confidence,
        },
      });
    }

    console.log(
      `[Face Auth] Successful for user ${user.id}. Confidence: ${faceResponse.confidence}`
    );

    // Record successful auth event
    await recordAuthEvent({
      req,
      userId: user.id,
      method: AuthMethod.FACE_RECOGNITION,
      success: true,
      actorType: "user",
      metadata: {
        matched: true,
        distance: faceResponse.distance,
        confidence: faceResponse.confidence,
      },
    });

    const authUser = await buildOwnerAuthUser({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    const token = createAuthBearerToken(authUser);

    // Return user data for NextAuth integration
    return sendResponse(res, 200, {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        provider: "face_recognition",
      },
      token,
      message: "Face authenticated successfully",
      debug_info: {
        confidence: faceResponse.confidence,
        distance: faceResponse.distance,
      },
    });
  } catch (error) {
    console.error("[Face Auth] Unexpected error:", error);

    return sendResponse(res, 500, {
      success: false,
      message: ERROR_MESSAGES[FaceAuthError.INTERNAL_ERROR],
      error_code: FaceAuthError.INTERNAL_ERROR,
    });
  }
};

/**
 * Check if user has face data registered
 * GET /api/face/check
 */
export const checkFaceRegistration = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized",
      });
    }

    const faceData = await prisma.faceData.findUnique({
      where: { user_id: userId },
    });

    return sendResponse(res, 200, {
      success: true,
      faceRegistered: !!faceData && faceData.is_enabled,
      created_at: faceData?.created_at,
      updated_at: faceData?.updated_at,
    });
  } catch (error) {
    console.error("[Face Check] Error:", error);

    return sendResponse(res, 500, {
      success: false,
      message: "Error checking face registration status",
    });
  }
};

/**
 * Delete/disable face data for user
 * POST /api/face/delete
 */
export const deleteFaceData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return sendResponse(res, 401, {
        success: false,
        message: "Unauthorized",
      });
    }

    await prisma.faceData.update({
      where: { user_id: userId },
      data: { is_enabled: false },
    });

    console.log(`[Face Delete] Disabled face data for user ${userId}`);

    await recordAuthEvent({
      req,
      userId,
      method: AuthMethod.FACE_RECOGNITION,
      success: true,
      actorType: "user",
      metadata: { action: "face_data_deleted" },
    });

    return sendResponse(res, 200, {
      success: true,
      message: "Face data removed successfully",
    });
  } catch (error) {
    console.error("[Face Delete] Error:", error);

    return sendResponse(res, 500, {
      success: false,
      message: "Error removing face data",
    });
  }
};
