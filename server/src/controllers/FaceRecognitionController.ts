import type { Request, Response } from "express";
import axios, { AxiosError } from "axios";
import { Prisma, AuthMethod } from "@prisma/client";

import prisma from "../config/db.config.js";
import AppError from "../utils/AppError.js";
import {
  buildOwnerAuthUser,
  getAccessTokenExpiresAt,
  normalizeRememberMe,
} from "../lib/authSession.js";
import { issueAuthCookies } from "../lib/authCookies.js";
import { recordAuthEvent } from "../lib/modernAuth.js";
import { sendResponse } from "../utils/sendResponse.js";
import {
  decryptFaceEncoding,
  encryptFaceEncoding,
  looksEncryptedFaceEncoding,
} from "../lib/faceEncryption.js";

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || "http://localhost:5001";
const FACE_RECOGNITION_TIMEOUT = Number(process.env.FACE_RECOGNITION_TIMEOUT_MS || 15000);
const DEBUG_MODE = process.env.DEBUG === "true";
const prismaUnsafe = prisma as any;
const FACE_RECOGNITION_METHOD = "FACE_RECOGNITION" as unknown as AuthMethod;

enum FaceAuthError {
  DATABASE_ERROR = "DATABASE_ERROR",
  FACE_NOT_FOUND = "FACE_NOT_FOUND",
  FACE_NOT_DETECTED = "FACE_NOT_DETECTED",
  FACE_REENROLL_REQUIRED = "FACE_REENROLL_REQUIRED",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  IMAGE_PROCESSING_ERROR = "IMAGE_PROCESSING_ERROR",
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  INVALID_CONTENT_TYPE = "INVALID_CONTENT_TYPE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  INVALID_IMAGE_DATA = "INVALID_IMAGE_DATA",
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_RESPONSE = "INVALID_RESPONSE",
  LOW_CONFIDENCE = "LOW_CONFIDENCE",
  LOW_LIGHT = "LOW_LIGHT",
  MISSING_IMAGE_FIELD = "MISSING_IMAGE_FIELD",
  MULTIPLE_FACES_DETECTED = "MULTIPLE_FACES_DETECTED",
  NO_FACE_REGISTERED = "NO_FACE_REGISTERED",
  NO_FILE_UPLOADED = "NO_FILE_UPLOADED",
  NO_MATCH_FOUND = "NO_MATCH_FOUND",
  REQUEST_TIMEOUT = "REQUEST_TIMEOUT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  USER_NOT_FOUND = "USER_NOT_FOUND",
}

const ERROR_CODE_ALIASES: Record<string, string> = {
  NO_FACE_DETECTED: FaceAuthError.FACE_NOT_DETECTED,
  INTERNAL_ERROR: FaceAuthError.INTERNAL_SERVER_ERROR,
  IMAGE_TOO_LARGE: FaceAuthError.FILE_TOO_LARGE,
  MISSING_IMAGE: FaceAuthError.MISSING_IMAGE_FIELD,
  NO_IMAGE_DATA: FaceAuthError.NO_FILE_UPLOADED,
  INVALID_ENCODING: FaceAuthError.INVALID_IMAGE_DATA,
  MATCH_LOW_CONFIDENCE: FaceAuthError.LOW_CONFIDENCE,
};

const ERROR_MESSAGES: Record<string, string> = {
  [FaceAuthError.DATABASE_ERROR]: "Server error, try again.",
  [FaceAuthError.FACE_NOT_FOUND]: "No registered face found.",
  [FaceAuthError.FACE_NOT_DETECTED]:
    "No face detected. Please keep your face centered and try again.",
  [FaceAuthError.FACE_REENROLL_REQUIRED]:
    "Your saved face data needs to be enrolled again. Please register your face again.",
  [FaceAuthError.FILE_TOO_LARGE]: "Captured image is too large. Please try again.",
  [FaceAuthError.IMAGE_PROCESSING_ERROR]:
    "The image could not be processed. Please capture a clearer photo and retry.",
  [FaceAuthError.INTERNAL_SERVER_ERROR]: "Server error, try again.",
  [FaceAuthError.INVALID_CONTENT_TYPE]: "Invalid request format. Please send a supported image.",
  [FaceAuthError.INVALID_FILE_TYPE]: "Invalid file type. Please upload a JPG or PNG image.",
  [FaceAuthError.INVALID_IMAGE_DATA]: "The image data is invalid or corrupted.",
  [FaceAuthError.INVALID_REQUEST]: "Invalid request. Please verify the required fields and try again.",
  [FaceAuthError.INVALID_RESPONSE]: "Face recognition service returned an invalid response.",
  [FaceAuthError.LOW_CONFIDENCE]:
    "Face match confidence is too low. Please try again with better lighting and a steady frame.",
  [FaceAuthError.LOW_LIGHT]:
    "The image is too dark. Please move to better lighting and try again.",
  [FaceAuthError.MISSING_IMAGE_FIELD]: "Image is required.",
  [FaceAuthError.MULTIPLE_FACES_DETECTED]:
    "Multiple faces detected. Please ensure only your face is visible.",
  [FaceAuthError.NO_FACE_REGISTERED]:
    "No face is registered for this account. Please register first.",
  [FaceAuthError.NO_FILE_UPLOADED]: "No image was captured. Please capture your face and retry.",
  [FaceAuthError.NO_MATCH_FOUND]: "Face not recognized. Please try again.",
  [FaceAuthError.REQUEST_TIMEOUT]: "Face recognition service timed out. Please try again.",
  [FaceAuthError.SERVICE_UNAVAILABLE]:
    "Face recognition service is temporarily unavailable. Please try again.",
  [FaceAuthError.USER_NOT_FOUND]: "User not found or face is not registered for this account.",
};

type FaceServiceSuccess<T extends object = Record<string, unknown>> = {
  success: true;
  data: T;
  message?: string;
};

type FaceServiceError = {
  success: false;
  error: string;
  code: string;
  details?: unknown;
};

type FaceServiceResponse<T extends object = Record<string, unknown>> =
  | FaceServiceSuccess<T>
  | FaceServiceError;

type LegacyFaceServiceSuccess<T extends object = Record<string, unknown>> = T & {
  success: true;
  message?: string;
};

type LegacyFaceServiceError = {
  success: false;
  message?: string;
  error?: string;
  error_code?: string;
  code?: string;
  details?: unknown;
};

type FaceRegisterPayload = {
  encoding: number[];
  faces_detected: number;
  processing_time_ms?: number;
};

type FaceAuthenticatePayload = {
  matched: boolean;
  confidence: number;
  score?: number;
  distance: number;
  processing_time_ms?: number;
  code?: string | null;
  reason?: string | null;
};

type FaceErrorMeta = {
  context?: Record<string, unknown>;
  details?: unknown;
  stack?: string;
};

type FaceErrorExtras = Partial<{
  reason: string;
  score: number;
  distance: number;
  processing_time_ms: number;
  requiresReenrollment: boolean;
}>;

const serviceEndpoint = (path: string) => `${FACE_SERVICE_URL}${path}`;

function buildFaceServiceHeaders(headers: Record<string, string>) {
  const nextHeaders: Record<string, string> = {
    ...headers,
    "X-Face-Service-Client": "billsutra-backend",
    "User-Agent": "BillSutra-Backend/1.0",
  };

  const apiKey = process.env.FACE_SERVICE_API_KEY?.trim();
  if (apiKey) {
    nextHeaders["X-API-KEY"] = apiKey;
  }

  return nextHeaders;
}

function logFace(level: "log" | "warn" | "error", event: string, payload: Record<string, unknown>) {
  console[level](
    `[Face Recognition] ${event}`,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        event,
        ...payload,
      },
      null,
      2,
    ),
  );
}

function getErrorMessage(code?: string, fallback?: string) {
  const normalizedCode = code ? ERROR_CODE_ALIASES[code] || code : undefined;

  if (normalizedCode && ERROR_MESSAGES[normalizedCode]) {
    return ERROR_MESSAGES[normalizedCode];
  }
  if (fallback && fallback.trim()) {
    return fallback;
  }
  return ERROR_MESSAGES[FaceAuthError.INTERNAL_SERVER_ERROR];
}

function normalizeErrorCode(code?: string) {
  if (!code) {
    return FaceAuthError.INTERNAL_SERVER_ERROR;
  }

  return ERROR_CODE_ALIASES[code] || code;
}

function buildErrorResponse(
  code: string,
  fallbackMessage?: string,
  meta?: FaceErrorMeta,
  extras?: FaceErrorExtras,
) {
  const message = getErrorMessage(code, fallbackMessage);
  const body: Record<string, unknown> = {
    success: false,
    error: message,
    message,
    code,
    ...(extras?.reason ? { reason: extras.reason } : {}),
    ...(typeof extras?.score === "number" ? { score: extras.score } : {}),
    ...(typeof extras?.distance === "number" ? { distance: extras.distance } : {}),
    ...(typeof extras?.processing_time_ms === "number"
      ? { processing_time_ms: extras.processing_time_ms }
      : {}),
    ...(extras?.requiresReenrollment ? { requiresReenrollment: true } : {}),
  };

  if (DEBUG_MODE) {
    body.details = {
      ...(meta?.details !== undefined ? { details: meta.details } : {}),
      ...(meta?.context ? { context: meta.context } : {}),
      ...(meta?.stack ? { stack: meta.stack } : {}),
    };
  }

  return body;
}

function sendFaceError(
  res: Response,
  status: number,
  code: string,
  fallbackMessage?: string,
  meta?: FaceErrorMeta,
  extras?: FaceErrorExtras,
) {
  return res.status(status).json(buildErrorResponse(code, fallbackMessage, meta, extras));
}

function resolveUserId(req: Request): number | null {
  const authUserId = Number((req as Request & { user?: { id?: number | string } }).user?.id);
  const bodyUserId = req.body?.userId ? Number(req.body.userId) : null;

  if (Number.isFinite(authUserId) && authUserId > 0) {
    if (bodyUserId && bodyUserId !== authUserId) {
      return -1;
    }
    return authUserId;
  }

  if (bodyUserId && Number.isFinite(bodyUserId) && bodyUserId > 0) {
    return bodyUserId;
  }

  return null;
}

function decodeBase64Image(raw: string): Buffer {
  const normalized = raw.includes(",") ? raw.split(",")[1] : raw;
  return Buffer.from(normalized, "base64");
}

function resolveImageBuffer(req: Request): {
  buffer: Buffer | null;
  mimeType: string | null;
  source: "multipart" | "base64" | null;
} {
  if (req.file?.buffer?.length) {
    return {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype || null,
      source: "multipart",
    };
  }

  if (typeof req.body?.imageData === "string" && req.body.imageData.trim()) {
    return {
      buffer: decodeBase64Image(req.body.imageData),
      mimeType: null,
      source: "base64",
    };
  }

  return {
    buffer: null,
    mimeType: null,
    source: null,
  };
}

function validateEncoding(encoding: unknown): encoding is number[] {
  return (
    Array.isArray(encoding) &&
    encoding.length === 128 &&
    encoding.every((value) => typeof value === "number" && Number.isFinite(value))
  );
}

function validateAndSerializeEncoding(encoding: unknown): string {
  if (!validateEncoding(encoding)) {
    throw new Error("Encoding must be an array of 128 finite numeric values.");
  }

  return JSON.stringify(encoding);
}

function sanitizeFaceServiceResponseForLogs(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const sanitized = { ...(payload as Record<string, unknown>) };
  if ("data" in sanitized && sanitized.data && typeof sanitized.data === "object") {
    const data = { ...(sanitized.data as Record<string, unknown>) };
    if ("encoding" in data) {
      data.encoding = "[REDACTED]";
    }
    sanitized.data = data;
  }
  if ("encoding" in sanitized) {
    sanitized.encoding = "[REDACTED]";
  }

  return sanitized;
}

function resolveStoredEncodingString(faceData: {
  face_encoding?: string | null;
  face_encoding_json?: string | null;
  is_encrypted?: boolean | null;
}) {
  const rawEncoding =
    faceData.face_encoding_json?.trim() ||
    faceData.face_encoding?.trim() ||
    "";

  if (!rawEncoding) {
    throw new Error("Stored face encoding is missing.");
  }

  const shouldDecrypt =
    faceData.is_encrypted === true || looksEncryptedFaceEncoding(rawEncoding);

  return shouldDecrypt ? decryptFaceEncoding(rawEncoding) : rawEncoding;
}

async function disableFaceDataForReenrollment(userId: number, reason: string) {
  try {
    await prismaUnsafe.faceData.updateMany({
      where: { user_id: userId, is_enabled: true },
      data: {
        is_enabled: false,
        updated_at: new Date(),
      },
    });

    logFace("warn", "face_data.disabled_for_reenrollment", {
      userId,
      reason,
    });
  } catch (error) {
    logFace("error", "face_data.disable_failed", {
      userId,
      reason,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
  }
}

function isStructuredSuccess<T extends object>(payload: unknown): payload is FaceServiceSuccess<T> {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as FaceServiceSuccess<T>).success === true &&
      typeof (payload as FaceServiceSuccess<T>).data === "object",
  );
}

function isStructuredError(payload: unknown): payload is FaceServiceError {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as FaceServiceError).success === false &&
      typeof (payload as FaceServiceError).code === "string" &&
      typeof (payload as FaceServiceError).error === "string",
  );
}

function isLegacySuccess(payload: unknown): payload is LegacyFaceServiceSuccess {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as LegacyFaceServiceSuccess).success === true &&
      !("data" in (payload as Record<string, unknown>)),
  );
}

function isLegacyError(payload: unknown): payload is LegacyFaceServiceError {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as LegacyFaceServiceError).success === false &&
      (typeof (payload as LegacyFaceServiceError).error_code === "string" ||
        typeof (payload as LegacyFaceServiceError).code === "string" ||
        typeof (payload as LegacyFaceServiceError).message === "string" ||
        typeof (payload as LegacyFaceServiceError).error === "string"),
  );
}

function normalizeLegacySuccess<T extends object>(
  payload: LegacyFaceServiceSuccess<T>,
): FaceServiceSuccess<T> {
  const { success: _success, message, ...data } = payload;
  return {
    success: true,
    message,
    data: data as T,
  };
}

function normalizeLegacyError(payload: LegacyFaceServiceError): FaceServiceError {
  const code = normalizeErrorCode(
    payload.code ||
      payload.error_code ||
      FaceAuthError.INTERNAL_SERVER_ERROR,
  );

  return {
    success: false,
    code,
    error: payload.error || payload.message || getErrorMessage(code),
    details: payload.details,
  };
}

function extractServiceError(error: unknown): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  const axiosError = error as AxiosError<FaceServiceResponse>;

  if (axiosError.code === "ECONNABORTED") {
    return {
      status: 504,
      code: FaceAuthError.REQUEST_TIMEOUT,
      message: ERROR_MESSAGES[FaceAuthError.REQUEST_TIMEOUT],
      details: { axiosCode: axiosError.code },
    };
  }

  if (axiosError.code === "ECONNREFUSED" || axiosError.code === "ENOTFOUND") {
    return {
      status: 503,
      code: FaceAuthError.SERVICE_UNAVAILABLE,
      message: ERROR_MESSAGES[FaceAuthError.SERVICE_UNAVAILABLE],
      details: { axiosCode: axiosError.code },
    };
  }

  const serviceData = axiosError.response?.data;
  if (serviceData && isStructuredError(serviceData)) {
    const normalizedCode = normalizeErrorCode(serviceData.code);
    return {
      status:
        normalizedCode === FaceAuthError.FACE_NOT_DETECTED ||
        normalizedCode === FaceAuthError.MULTIPLE_FACES_DETECTED ||
        normalizedCode === FaceAuthError.LOW_LIGHT ||
        normalizedCode === FaceAuthError.LOW_CONFIDENCE
          ? 422
          : axiosError.response?.status && axiosError.response.status >= 400
            ? axiosError.response.status
            : 502,
      code: normalizedCode,
      message: getErrorMessage(normalizedCode, serviceData.error),
      details: serviceData.details,
    };
  }

  return {
    status: 503,
    code: FaceAuthError.SERVICE_UNAVAILABLE,
    message: ERROR_MESSAGES[FaceAuthError.SERVICE_UNAVAILABLE],
    details: { axiosMessage: axiosError.message },
  };
}

function mapPrismaError(error: unknown): { status: number; code: string; message: string; details?: unknown } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        status: 409,
        code: FaceAuthError.DATABASE_ERROR,
        message: "Face data already exists for this user.",
        details: { prismaCode: error.code, meta: error.meta },
      };
    }

    return {
      status: 500,
      code: FaceAuthError.DATABASE_ERROR,
      message: ERROR_MESSAGES[FaceAuthError.DATABASE_ERROR],
      details: { prismaCode: error.code, meta: error.meta },
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 500,
      code: FaceAuthError.DATABASE_ERROR,
      message: "Face data schema validation failed.",
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      code: FaceAuthError.DATABASE_ERROR,
      message: "Database connection failed while storing face data.",
    };
  }

  return {
    status: 500,
    code: FaceAuthError.DATABASE_ERROR,
    message: ERROR_MESSAGES[FaceAuthError.DATABASE_ERROR],
  };
}

async function postToFaceService<T extends object>(
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<FaceServiceSuccess<T>> {
  const response = await axios.post<FaceServiceResponse<T>>(serviceEndpoint(path), body, {
    headers: buildFaceServiceHeaders(headers),
    timeout: FACE_RECOGNITION_TIMEOUT,
    validateStatus: () => true,
  });

  logFace("log", "service.response_received", {
    path,
    status: response.status,
    success: response.data?.success,
  });

  if (isStructuredSuccess<T>(response.data)) {
    return response.data;
  }

  if (isLegacySuccess(response.data)) {
    return normalizeLegacySuccess<T>(response.data);
  }

  if (isStructuredError(response.data)) {
    const structuredError = new Error(response.data.error || "Face service request failed.");
    (
      structuredError as Error & {
        response?: { status: number; data: FaceServiceError };
      }
    ).response = {
      status: response.status,
      data: response.data,
    };
    throw structuredError;
  }

  if (isLegacyError(response.data)) {
    const normalizedError = normalizeLegacyError(response.data);
    const structuredError = new Error(normalizedError.error);
    (
      structuredError as Error & {
        response?: { status: number; data: FaceServiceError };
      }
    ).response = {
      status: response.status,
      data: normalizedError,
    };
    throw structuredError;
  }

  const invalidShapeError = new Error("Invalid face service response shape.");
  (
    invalidShapeError as Error & {
      response?: { status: number; data: unknown };
    }
  ).response = {
    status: response.status,
    data: response.data,
  };
  throw invalidShapeError;
}

export const registerFace = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const userId = resolveUserId(req);

  logFace("log", "register.request_received", {
    userId,
    bodyUserId: req.body?.userId,
    hasFile: Boolean(req.file),
    hasImageData: Boolean(req.body?.imageData),
    contentType: req.headers["content-type"],
    mimeType: req.file?.mimetype,
    imageBytes: req.file?.buffer?.length,
    ip: req.ip,
  });

  try {
    if (userId === -1) {
      return sendFaceError(res, 400, FaceAuthError.INVALID_REQUEST, "Authenticated user and payload userId do not match.");
    }

    if (!userId) {
      return sendFaceError(res, 400, FaceAuthError.INVALID_REQUEST, "userId is required.");
    }

    const { buffer: imageBuffer, mimeType, source } = resolveImageBuffer(req);
    logFace("log", "register.image_buffer_resolved", {
      userId,
      source,
      mimeType,
      imageBytes: imageBuffer?.length ?? 0,
    });

    if (!imageBuffer?.length) {
      return sendFaceError(res, 400, FaceAuthError.MISSING_IMAGE_FIELD);
    }

    let faceServiceResponse: FaceServiceSuccess<FaceRegisterPayload>;
    try {
      faceServiceResponse = await postToFaceService<FaceRegisterPayload>(
        "/api/face/register",
        imageBuffer,
        { "Content-Type": "application/octet-stream" },
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid face service response shape.") {
        logFace("error", "register.invalid_service_response", {
          userId,
          message: error.message,
          rawResponse: (error as Error & { response?: { status?: number; data?: unknown } }).response,
        });
        return sendFaceError(
          res,
          502,
          FaceAuthError.INVALID_RESPONSE,
          "Face recognition service returned an invalid response.",
          {
            details: sanitizeFaceServiceResponseForLogs(
              (error as Error & { response?: { status?: number; data?: unknown } }).response,
            ),
            stack: error.stack,
          },
        );
      }

      const serviceError = extractServiceError(error);
      logFace("error", "register.face_service_failed", {
        userId,
        serviceError,
        stack: (error as Error)?.stack,
      });
      return sendFaceError(res, serviceError.status, serviceError.code, serviceError.message, {
        details: serviceError.details,
        stack: (error as Error)?.stack,
      });
    }

    const payload = faceServiceResponse.data;
    let serializedEncoding: string;
    let encryptedEncoding: string;
    try {
      serializedEncoding = validateAndSerializeEncoding(payload.encoding);
    } catch (error) {
      logFace("error", "register.invalid_encoding_payload", {
        userId,
        message: (error as Error).message,
      });
      return sendFaceError(
        res,
        502,
        FaceAuthError.INVALID_RESPONSE,
        "Face service produced invalid encoding data.",
      );
    }

    try {
      encryptedEncoding = encryptFaceEncoding(serializedEncoding);
    } catch (error) {
      logFace("error", "register.encoding_encryption_failed", {
        userId,
        message: (error as Error).message,
      });
      return sendFaceError(
        res,
        error instanceof AppError ? error.statusCode : 500,
        FaceAuthError.DATABASE_ERROR,
        "Biometric data encryption is unavailable right now.",
      );
    }

    try {
      const dbResult = await prismaUnsafe.faceData.upsert({
        where: { user_id: userId },
        update: {
          face_encoding: encryptedEncoding,
          face_encoding_json: encryptedEncoding,
          is_enabled: true,
          is_encrypted: true,
          updated_at: new Date(),
        },
        create: {
          user_id: userId,
          face_encoding: encryptedEncoding,
          face_encoding_json: encryptedEncoding,
          is_enabled: true,
          is_encrypted: true,
        },
        select: {
          id: true,
          user_id: true,
          is_enabled: true,
          is_encrypted: true,
          created_at: true,
          updated_at: true,
        },
      });

      logFace("log", "register.db_upsert_success", {
        userId,
        dbResult,
      });
    } catch (error) {
      const dbError = mapPrismaError(error);
      logFace("error", "register.db_upsert_failed", {
        userId,
        dbError,
        stack: (error as Error)?.stack,
      });

      await recordAuthEvent({
        req,
        userId,
        method: FACE_RECOGNITION_METHOD,
        success: false,
        actorType: "user",
        metadata: { action: "face_registration", error: dbError.code },
      });

      return sendFaceError(res, dbError.status, dbError.code, dbError.message, {
        details: dbError.details,
        stack: (error as Error)?.stack,
      });
    }

    await recordAuthEvent({
      req,
      userId,
      method: FACE_RECOGNITION_METHOD,
      success: true,
      actorType: "user",
      metadata: {
        action: "face_registration",
        faces_detected: payload.faces_detected,
      },
    });

    return sendResponse(res, 200, {
      success: true,
      message: faceServiceResponse.message || "Face registered successfully.",
      data: {
        faces_detected: payload.faces_detected,
        processing_time_ms: payload.processing_time_ms ?? Date.now() - startedAt,
      },
    });
  } catch (error) {
    logFace("error", "register.unexpected_error", {
      userId,
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });

    return sendFaceError(res, 500, FaceAuthError.INTERNAL_SERVER_ERROR, undefined, {
      stack: (error as Error)?.stack,
    });
  }
};

export const authenticateFace = async (req: Request, res: Response) => {
  const startedAt = Date.now();
  const { email } = req.body ?? {};
  const { buffer: imageBuffer, mimeType, source } = resolveImageBuffer(req);

  logFace("log", "authenticate.request_received", {
    email,
    hasFile: Boolean(req.file),
    hasImageData: Boolean(req.body?.imageData),
    imageBytes: imageBuffer?.length ?? 0,
    mimeType,
    source,
    contentType: req.headers["content-type"],
    ip: req.ip,
  });

  try {
    if (typeof email !== "string" || !email.trim()) {
      return sendFaceError(res, 400, FaceAuthError.INVALID_REQUEST, "email is required.");
    }

    if (!imageBuffer?.length) {
      return sendFaceError(res, 400, FaceAuthError.MISSING_IMAGE_FIELD);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    const faceData = user
      ? await prismaUnsafe.faceData.findUnique({
          where: { user_id: user.id },
          select: {
            id: true,
            user_id: true,
            face_encoding: true,
            face_encoding_json: true,
            is_enabled: true,
            is_encrypted: true,
          },
        })
      : null;

    if (!user) {
      await recordAuthEvent({
        req,
        method: FACE_RECOGNITION_METHOD,
        success: false,
        actorType: "user",
        metadata: { email, error: "user_not_found" },
      });
      return sendFaceError(
        res,
        404,
        FaceAuthError.USER_NOT_FOUND,
        undefined,
        undefined,
        { reason: FaceAuthError.USER_NOT_FOUND },
      );
    }

    if (!faceData?.is_enabled) {
      await recordAuthEvent({
        req,
        userId: user.id,
        method: FACE_RECOGNITION_METHOD,
        success: false,
        actorType: "user",
        metadata: { error: "no_face_registered" },
      });
      return sendFaceError(
        res,
        400,
        FaceAuthError.NO_FACE_REGISTERED,
        undefined,
        undefined,
        { reason: "USER_NOT_ENROLLED" },
      );
    }

    let storedEncoding: unknown;
    try {
      storedEncoding = JSON.parse(resolveStoredEncodingString(faceData));
    } catch (error) {
      await disableFaceDataForReenrollment(
        user.id,
        `encoding_parse_failed:${(error as Error).message}`,
      );
      logFace("error", "authenticate.encoding_parse_failed", {
        userId: user.id,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      return sendFaceError(
        res,
        409,
        FaceAuthError.FACE_REENROLL_REQUIRED,
        "Stored face encoding is corrupted. Please register your face again.",
        {
          stack: (error as Error).stack,
        },
        {
          reason: FaceAuthError.FACE_REENROLL_REQUIRED,
          requiresReenrollment: true,
        },
      );
    }

    if (!validateEncoding(storedEncoding)) {
      await disableFaceDataForReenrollment(user.id, "encoding_invalid_dimensions");
      return sendFaceError(
        res,
        409,
        FaceAuthError.FACE_REENROLL_REQUIRED,
        "Stored face encoding is invalid. Please register your face again.",
        undefined,
        {
          reason: FaceAuthError.FACE_REENROLL_REQUIRED,
          requiresReenrollment: true,
        },
      );
    }

    let faceServiceResponse: FaceServiceSuccess<FaceAuthenticatePayload>;
    try {
      faceServiceResponse = await postToFaceService<FaceAuthenticatePayload>(
        "/api/face/authenticate",
        {
          image: imageBuffer.toString("base64"),
          encoding: storedEncoding,
          mimeType,
        },
        { "Content-Type": "application/json" },
      );
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid face service response shape.") {
        return sendFaceError(
          res,
          502,
          FaceAuthError.INVALID_RESPONSE,
          "Face recognition service returned an invalid response.",
          {
            details: sanitizeFaceServiceResponseForLogs(
              (error as Error & { response?: { status?: number; data?: unknown } }).response,
            ),
            stack: error.stack,
          },
        );
      }

      const serviceError = extractServiceError(error);
      await recordAuthEvent({
        req,
        userId: user.id,
        method: FACE_RECOGNITION_METHOD,
        success: false,
        actorType: "user",
        metadata: { error: serviceError.code },
      });

      return sendFaceError(res, serviceError.status, serviceError.code, serviceError.message, {
        details: serviceError.details,
        stack: (error as Error)?.stack,
      });
    }

    const payload = faceServiceResponse.data;
    logFace("log", "authenticate.face_service_payload", {
      userId: user.id,
      matched: payload.matched,
      confidence: payload.confidence,
      score: payload.score,
      distance: payload.distance,
      reason: payload.reason,
      processing_time_ms: payload.processing_time_ms,
    });

    if (!payload.matched) {
      await recordAuthEvent({
        req,
        userId: user.id,
        method: FACE_RECOGNITION_METHOD,
        success: false,
        actorType: "user",
        metadata: {
          matched: false,
          distance: payload.distance,
          confidence: payload.confidence,
          score: payload.score,
          code: payload.code || FaceAuthError.NO_MATCH_FOUND,
        },
      });

      return sendFaceError(
        res,
        401,
        payload.code || FaceAuthError.NO_MATCH_FOUND,
        faceServiceResponse.message || ERROR_MESSAGES[FaceAuthError.NO_MATCH_FOUND],
        {
          details: {
            distance: payload.distance,
            confidence: payload.confidence,
            score: payload.score,
          },
        },
        {
          reason: payload.reason || payload.code || FaceAuthError.NO_MATCH_FOUND,
          score: payload.score ?? payload.confidence,
          distance: payload.distance,
          processing_time_ms: payload.processing_time_ms,
        },
      );
    }

    await recordAuthEvent({
      req,
      userId: user.id,
      method: FACE_RECOGNITION_METHOD,
      success: true,
      actorType: "user",
      metadata: {
        matched: true,
        distance: payload.distance,
        confidence: payload.confidence,
        score: payload.score,
      },
    });

    const authUser = await buildOwnerAuthUser({
      id: user.id,
      email: user.email,
      name: user.name,
      is_email_verified: user.is_email_verified,
    });
    const { accessToken } = await issueAuthCookies(req, res, authUser, {
      rememberMe: normalizeRememberMe(req.body?.rememberMe),
    });
    const token = `Bearer ${accessToken}`;

    return sendResponse(res, 200, {
      success: true,
      message: faceServiceResponse.message || "Face authenticated successfully.",
      data: {
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          provider: "face_recognition",
          is_email_verified: user.is_email_verified,
        },
        token,
        expiresAt: getAccessTokenExpiresAt(),
        matched: true,
        confidence: payload.confidence,
        score: payload.score ?? payload.confidence,
        distance: payload.distance,
        reason: payload.reason || "MATCH_SUCCESS",
        processing_time_ms: payload.processing_time_ms ?? Date.now() - startedAt,
      },
    });
  } catch (error) {
    logFace("error", "authenticate.unexpected_error", {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    return sendFaceError(res, 500, FaceAuthError.INTERNAL_SERVER_ERROR, undefined, {
      stack: (error as Error)?.stack,
    });
  }
};

export const checkFaceRegistration = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);

    if (!userId || userId < 0) {
      return sendFaceError(res, 400, FaceAuthError.INVALID_REQUEST, "userId is required.");
    }

    const faceData = await prismaUnsafe.faceData.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        is_enabled: true,
        face_encoding: true,
        face_encoding_json: true,
        is_encrypted: true,
        created_at: true,
        updated_at: true,
      },
    });

    let faceRegistered = Boolean(faceData?.is_enabled);
    if (faceRegistered && faceData) {
      try {
        const parsedEncoding = JSON.parse(resolveStoredEncodingString(faceData));
        if (!validateEncoding(parsedEncoding)) {
          throw new Error("encoding_invalid_dimensions");
        }
      } catch (error) {
        await disableFaceDataForReenrollment(
          faceData.user_id,
          `status_check_failed:${(error as Error).message}`,
        );
        faceRegistered = false;
      }
    }

    logFace("log", "check.face_registration_result", {
      userId,
      faceRegistered,
    });

    return sendResponse(res, 200, {
      success: true,
      message: "Face registration status fetched successfully.",
      data: {
        faceRegistered,
        created_at: faceData?.created_at ?? null,
        updated_at: faceData?.updated_at ?? null,
      },
    });
  } catch (error) {
    logFace("error", "check.unexpected_error", {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    return sendFaceError(res, 500, FaceAuthError.INTERNAL_SERVER_ERROR, undefined, {
      stack: (error as Error)?.stack,
    });
  }
};

export const getFaceData = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);

    if (!userId || userId < 0) {
      return sendFaceError(
        res,
        400,
        FaceAuthError.INVALID_REQUEST,
        "userId is required.",
      );
    }

    const faceData = await prismaUnsafe.faceData.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        is_enabled: true,
        face_encoding: true,
        face_encoding_json: true,
        is_encrypted: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!faceData?.is_enabled) {
      return sendFaceError(res, 404, FaceAuthError.FACE_NOT_FOUND);
    }

    try {
      const parsedEncoding = JSON.parse(resolveStoredEncodingString(faceData));
      if (!validateEncoding(parsedEncoding)) {
        throw new Error("encoding_invalid_dimensions");
      }
    } catch (error) {
      await disableFaceDataForReenrollment(
        faceData.user_id,
        `profile_fetch_failed:${(error as Error).message}`,
      );
      return sendFaceError(
        res,
        409,
        FaceAuthError.FACE_REENROLL_REQUIRED,
        "Your saved face data needs to be enrolled again.",
        undefined,
        {
          reason: FaceAuthError.FACE_REENROLL_REQUIRED,
          requiresReenrollment: true,
        },
      );
    }

    const user = await prismaUnsafe.user.findUnique({
      where: { id: userId },
      select: {
        image: true,
        name: true,
        email: true,
      },
    });

    return res.status(200).json({
      success: true,
      image: user?.image ?? null,
      name: user?.name ?? null,
      email: user?.email ?? null,
      createdAt: faceData.created_at,
      updatedAt: faceData.updated_at,
      faceRegistered: true,
    });
  } catch (error) {
    logFace("error", "face_profile.unexpected_error", {
      message: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    return sendFaceError(
      res,
      500,
      FaceAuthError.INTERNAL_SERVER_ERROR,
      undefined,
      {
        stack: (error as Error)?.stack,
      },
    );
  }
};

export const deleteFaceData = async (req: Request, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const faceDataIdParam = req.params.id ? Number(req.params.id) : null;

    if (!userId || userId < 0) {
      return sendFaceError(res, 400, FaceAuthError.INVALID_REQUEST, "userId is required.");
    }

    const existing = await prismaUnsafe.faceData.findUnique({
      where: { user_id: userId },
      select: { id: true, is_enabled: true },
    });

    if (!existing) {
      return sendFaceError(res, 404, FaceAuthError.FACE_NOT_FOUND);
    }

    if (faceDataIdParam && existing.id !== faceDataIdParam) {
      return sendFaceError(res, 404, FaceAuthError.FACE_NOT_FOUND);
    }

    const result = await prismaUnsafe.faceData.delete({
      where: { user_id: userId },
      select: { id: true, user_id: true },
    });

    logFace("log", "delete.db_delete_success", {
      userId,
      result,
    });

    await recordAuthEvent({
      req,
      userId,
      method: FACE_RECOGNITION_METHOD,
      success: true,
      actorType: "user",
      metadata: { action: "face_data_deleted" },
    });

    return res.status(200).json({
      success: true,
      message: "Face deleted successfully",
    });
  } catch (error) {
    const dbError = mapPrismaError(error);
    logFace("error", "delete.unexpected_error", {
      dbError,
      stack: (error as Error)?.stack,
    });
    return sendFaceError(res, dbError.status, dbError.code, dbError.message, {
      details: dbError.details,
      stack: (error as Error)?.stack,
    });
  }
};
