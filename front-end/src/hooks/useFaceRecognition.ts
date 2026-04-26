import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";
import { normalizeFaceError } from "@/utils/faceErrorHandler";

interface UseWebcamOptions {
  autoStart?: boolean;
  onError?: (error: string) => void;
}

interface WebcamStream {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureImage: () => Promise<Blob | null>;
}

/**
 * Hook for managing webcam access and image capture
 * Handles permissions, error handling, and cleanup
 */
export const useWebcam = (options: UseWebcamOptions = {}): WebcamStream => {
  const { autoStart = false, onError } = options;
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsActive(true);
        };
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (error) {
      const errorMessage =
        error instanceof DOMException
          ? error.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in your browser settings."
            : error.name === "NotFoundError"
              ? "No camera found on this device."
              : `Camera error: ${error.message}`
          : "Failed to access camera";

      onErrorRef.current?.(errorMessage);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStream(null);
    setIsActive(false);
  }, []);

  const captureImage = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !isActive) {
      onErrorRef.current?.("Camera is not ready. Please wait a moment.");
      return null;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      ctx.drawImage(videoRef.current, 0, 0);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/jpeg",
          0.9,
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to capture image";
      onErrorRef.current?.(`Image capture failed: ${errorMessage}`);
      return null;
    }
  }, [isActive]);

  useEffect(() => {
    if (autoStart) {
      startCamera();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [autoStart, startCamera]);

  return {
    stream,
    videoRef,
    isActive,
    startCamera,
    stopCamera,
    captureImage,
  };
};

/**
 * Structured error info for debugging
 */
interface ErrorInfo {
  message: string;
  status?: number;
  code?: string;
  responseData?: unknown;
  isServerError: boolean;
  details?: unknown;
}

function toLoggableError(err: unknown) {
  if (err instanceof Error) {
    const errorWithCode = err as unknown as { code?: unknown };
    const errorWithResponse = err as unknown as {
      response?: { status?: number; data?: unknown };
    };

    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
      ...(typeof errorWithCode.code === "string"
        ? { code: errorWithCode.code }
        : {}),
      ...(errorWithResponse.response
        ? {
            response: {
              status: errorWithResponse.response.status,
              data: errorWithResponse.response.data,
            },
          }
        : {}),
    };
  }

  if (typeof err === "object" && err !== null) {
    return {
      ...err,
      keys: Object.keys(err),
    };
  }

  return { value: err };
}

const FRIENDLY_ERROR_BY_CODE: Record<string, string> = {
  FACE_NOT_DETECTED:
    "No face detected. Please keep your face centered and try again.",
  NO_FACE_DETECTED:
    "No face detected. Please keep your face centered and try again.",
  MULTIPLE_FACES_DETECTED:
    "Multiple faces found. Please ensure only your face is visible.",
  NO_FILE_UPLOADED:
    "No image was captured. Please capture your face and retry.",
  FILE_TOO_LARGE: "Captured image is too large. Please try again.",
  DATABASE_ERROR: "Server error, try again.",
  INVALID_RESPONSE:
    "Face recognition service returned an invalid response. Please try again.",
  SERVICE_UNAVAILABLE:
    "Face recognition service is temporarily unavailable. Please try again.",
};

/**
 * Extract structured error info from various error sources
 */
function extractErrorInfo(err: any): ErrorInfo {
  const result: ErrorInfo = {
    message: "An unexpected error occurred. Please try again.",
    isServerError: true,
  };

  // Case 1: Axios error with response
  if (err?.response) {
    result.status = err.response.status;
    result.responseData = err.response.data;
    result.details = err.response.data?.details;
    result.isServerError = (result.status ?? 0) >= 500;

    const data = err.response.data;
    const errorMessage =
      data?.error ||
      data?.message ||
      data?.data?.error ||
      err.message ||
      "Unknown error";
    if (typeof data?.code === "string") {
      result.code = data.code;
    }

    if (typeof data === "string" && data) {
      result.message = data;
    } else if (
      typeof errorMessage === "string" &&
      errorMessage.trim().length > 0
    ) {
      result.message = errorMessage;
    }

    if (result.code && FRIENDLY_ERROR_BY_CODE[result.code]) {
      result.message = FRIENDLY_ERROR_BY_CODE[result.code];
    }

    // Status-based fallbacks
    if (!result.message || result.message === "An unexpected error occurred") {
      switch (result.status) {
        case 400:
          result.message = "Invalid request. Please check your image.";
          break;
        case 401:
          result.message = "Authentication failed. Please login again.";
          break;
        case 403:
          result.message = "Access denied.";
          break;
        case 404:
          result.message = "Service not found.";
          break;
        case 503:
          result.message =
            "Face recognition service is temporarily unavailable.";
          break;
      }
    }
    return result;
  }

  // Case 2: Network errors
  if (err?.code) {
    result.code = err.code;
    if (err.code === "ECONNREFUSED") {
      result.message =
        "Cannot connect to face recognition service. Please try again later.";
      result.isServerError = true;
    } else if (err.code === "ETIMEDOUT" || err.code === "ECONNABORTED") {
      result.message = "Request timed out. Please try again.";
      result.isServerError = true;
    }
    return result;
  }

  // Case 3: Error with message property
  if (err instanceof Error) {
    result.message = err.message;
    result.isServerError = false;
    return result;
  }

  // Case 4: Plain string error
  if (typeof err === "string" && err) {
    result.message = err;
    result.isServerError = false;
    return result;
  }

  // Case 5: Unknown error
  console.warn("[extractErrorInfo] Unknown error format:", err);
  return result;
}

/**
 * Hook for managing face registration state and API calls
 */
export const useFaceRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const registerFace = useCallback(
    async (
      imageBlob: Blob,
    ): Promise<{ success: boolean; error?: string; code?: string }> => {
      setIsLoading(true);
      setError(null);
      setSuccess(false);

      const maxAttempts = 2;
      let attempt = 0;

      try {
        const formData = new FormData();
        formData.append("image", imageBlob, "face.jpg");

        while (attempt < maxAttempts) {
          attempt += 1;

          try {
            const response = await apiClient.post("/face/register", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            });

            const data = response.data;
            const payload = data?.data;

            if (!data?.success || !payload) {
              const normalizedError = normalizeFaceError({
                message: data?.message,
                error: data?.error,
                code: data?.code,
                status:
                  typeof response.status === "number"
                    ? response.status
                    : undefined,
              });
              setError(normalizedError.message);
              return {
                success: false,
                error: normalizedError.message,
                code: normalizedError.code,
              };
            }

            setSuccess(true);

            return { success: true };
          } catch (err) {
            const errorInfo = extractErrorInfo(err);
            const shouldRetry =
              attempt < maxAttempts &&
              (errorInfo.status === 503 ||
                errorInfo.status === 504 ||
                errorInfo.code === "REQUEST_TIMEOUT" ||
                errorInfo.isServerError);

            if (!shouldRetry) {
              const normalizedError = normalizeFaceError(err);
              setError(normalizedError.message);
              return {
                success: false,
                error: normalizedError.message,
                code: normalizedError.code,
              };
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }

        return { success: false, error: "Face registration failed." };
      } catch (err) {
        const errorInfo = normalizeFaceError(err);
        setError(errorInfo.message);

        return {
          success: false,
          error: errorInfo.message,
          code: errorInfo.code,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return {
    registerFace,
    isLoading,
    error,
    success,
    reset,
  };
};

/**
 * Hook for managing face authentication state and API calls
 */
export const useFaceAuthentication = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticateFace = useCallback(
    async (
      email: string,
      imageBlob: Blob,
    ): Promise<{
      success: boolean;
      user?: any;
      token?: string;
      error?: string;
      code?: string;
      status?: number;
      details?: unknown;
    }> => {
      setIsLoading(true);
      setError(null);

      try {
        const reader = new FileReader();
        const imageBase64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageBlob);
        });

        const response = await apiClient.post("/face/authenticate", {
          email,
          imageData: imageBase64.split(",")[1],
        });

        const data = response.data;
        console.log("Face authentication API response:", data);

        if (!data?.success || !data?.data) {
          const normalizedError = normalizeFaceError({
            message: data?.message,
            error: data?.error,
            code: data?.code,
            status:
              typeof response.status === "number" ? response.status : undefined,
          });
          setError(normalizedError.message);
          return {
            success: false,
            error: normalizedError.message,
            code: normalizedError.code,
            status: normalizedError.status,
          };
        }

        const payload = data.data;

        if (
          !payload?.user ||
          typeof payload?.token !== "string" ||
          !payload.token.trim()
        ) {
          const normalizedError = normalizeFaceError({
            message: "Face authentication response was incomplete.",
            code: "INVALID_RESPONSE",
            status:
              typeof response.status === "number" ? response.status : undefined,
          });
          setError(normalizedError.message);
          return {
            success: false,
            error: normalizedError.message,
            code: normalizedError.code,
            status: normalizedError.status,
          };
        }

        return {
          success: true,
          user: payload.user,
          token: payload.token,
        };
      } catch (err: any) {
        const errorInfo = normalizeFaceError(err);
        setError(errorInfo.message);

        return {
          success: false,
          error: errorInfo.message,
          code: errorInfo.code,
          status: errorInfo.status,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    authenticateFace,
    isLoading,
    error,
    reset,
  };
};

/**
 * Hook for checking if face is registered
 */
export const useFaceCheckStatus = () => {
  const [isChecking, setIsChecking] = useState(true);
  const [faceRegistered, setFaceRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await apiClient.get("/face/check");
      const data = response.data;
      if (!data?.success) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Failed to check face registration status.",
        );
      }

      setFaceRegistered(Boolean(data?.data?.faceRegistered));
    } catch (err: any) {
      const errorInfo = extractErrorInfo(err);
      console.error("[Face Check] Error:", errorInfo);
      setError(errorInfo.message);
      setFaceRegistered(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    faceRegistered,
    isChecking,
    error,
    refetch: checkStatus,
  };
};
