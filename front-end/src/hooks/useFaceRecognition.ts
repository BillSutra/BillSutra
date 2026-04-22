import { useEffect, useRef, useState, useCallback } from "react";
import { apiClient } from "@/lib/apiClient";

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
      console.log("[Webcam] Requesting camera access");

      // Request camera permission with specific constraints for optimal quality
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });

      console.log("[Webcam] Camera access granted");

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for video to load before setting isActive
        videoRef.current.onloadedmetadata = () => {
          setIsActive(true);
          console.log("[Webcam] Video stream is active");
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

      console.error("[Webcam] Error:", errorMessage, error);
      onErrorRef.current?.(errorMessage);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log("[Webcam] Stopping camera");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`[Webcam] Stopped ${track.kind} track`);
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
      console.error("[Webcam] Cannot capture: video not ready");
      onError?.("Camera is not ready. Please wait a moment.");
      return null;
    }

    try {
      console.log("[Webcam] Capturing image");

      // Create canvas from video frame
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Draw current video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0);

      // Convert canvas to blob (JPEG format for better compatibility)
      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(
                `[Webcam] Image captured successfully. Size: ${blob.size} bytes`
              );
            } else {
              console.error("[Webcam] Failed to create image blob");
            }
            resolve(blob);
          },
          "image/jpeg",
          0.9
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to capture image";
      console.error("[Webcam] Capture error:", errorMessage, error);
      onErrorRef.current?.(`Image capture failed: ${errorMessage}`);
      return null;
    }
  }, [isActive]);

  // Auto-start camera if requested
  useEffect(() => {
    if (autoStart) {
      startCamera();
    }

    return () => {
      // Cleanup: stop camera when component unmounts
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
 * Hook for managing face registration state and API calls
 */
export const useFaceRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);

  const registerFace = useCallback(
    async (imageBlob: Blob): Promise<boolean> => {
      try {
        setIsLoading(true);
        setError(null);
        setSuccess(false);

        console.log("[Face Register] Starting registration", {
          imageSize: imageBlob.size,
          imageType: imageBlob.type,
        });

        // Create FormData for file upload
        const formData = new FormData();
        formData.append("image", imageBlob, "face.jpg");

        const response = await apiClient.post("/face/register", formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
        const data = response.data;

        console.log("[Face Register] Success");
        setSuccess(true);
        setError(null);
        return true;
      } catch (err: any) {
        let errorMessage = "An unexpected error occurred";
        if (err.response) {
            errorMessage = err.response.data?.message || `Face registration failed with status ${err.response.status}`;
            setDebugInfo({
                errorCode: err.response.data?.error_code,
                message: err.response.data?.debug_error,
            });
        } else if (err instanceof Error) {
            errorMessage = err.message;
        }
        const status = Number(err.response?.status ?? 0);
        if (status > 0 && status < 500) {
          console.warn("[Face Register] Failed:", errorMessage);
        } else {
          console.error("[Face Register] Exception:", errorMessage, err);
        }
        setError(`Error: ${errorMessage}`);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    registerFace,
    isLoading,
    error,
    success,
    debugInfo,
    reset: () => {
      setError(null);
      setSuccess(false);
      setDebugInfo(null);
    },
  };
};

/**
 * Hook for managing face authentication state and API calls
 */
export const useFaceAuthentication = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);

  const authenticateFace = useCallback(
    async (
      email: string,
      imageBlob: Blob
    ): Promise<{ success: boolean; user?: any; token?: string; error?: string }> => {
      try {
        setIsLoading(true);
        setError(null);

        console.log("[Face Auth] Starting authentication", {
          email,
          imageSize: imageBlob.size,
        });

        // Convert image to base64
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
        const payload = data?.data ?? data;

        if (!payload?.user || typeof payload?.token !== "string" || !payload.token.trim()) {
          const mismatchMessage =
            "Face authentication response was incomplete.";
          console.warn("[Face Auth] Missing user in successful response");
          setError(mismatchMessage);
          setDebugInfo({
            ...payload?.debug_info,
          });
          return {
            success: false,
            error: mismatchMessage,
          };
        }

        console.log("[Face Auth] Success");
        setError(null);
        return {
          success: true,
          user: payload.user,
          token: payload.token,
        };
      } catch (err: any) {
        let errorMessage = "An unexpected error occurred";
        if (err.response) {
            errorMessage = err.response.data?.message || `Face authentication failed with status ${err.response.status}`;
            setDebugInfo({
                errorCode: err.response.data?.error_code,
                message: err.response.data?.debug_error,
                ...err.response.data?.debug_info,
            });
        } else if (err instanceof Error) {
            errorMessage = err.message;
        }
        const status = Number(err.response?.status ?? 0);
        if (status > 0 && status < 500) {
          console.warn("[Face Auth] Failed:", errorMessage);
        } else {
          console.error("[Face Auth] Exception:", errorMessage, err);
        }
        setError(`Error: ${errorMessage}`);
        return {
          success: false,
          error: `Error: ${errorMessage}`,
        };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    authenticateFace,
    isLoading,
    error,
    debugInfo,
    reset: () => {
      setError(null);
      setDebugInfo(null);
    },
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
    try {
      setIsChecking(true);
      setError(null);

      const response = await apiClient.get("/face/check");
      const data = response.data;
      setFaceRegistered(data.faceRegistered || false);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || (err instanceof Error ? err.message : "Unknown error");
      setError(errorMessage);
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
