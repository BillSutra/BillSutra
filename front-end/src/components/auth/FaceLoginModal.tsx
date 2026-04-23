"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Camera, X, AlertCircle, Loader, ArrowLeft } from "lucide-react";
import { useWebcam, useFaceAuthentication } from "@/hooks/useFaceRecognition";
import { getFriendlyFaceErrorMessage } from "@/utils/faceErrorHandler";

interface FaceLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (auth: { user: any; token: string }) => void;
  onError?: (error: string) => void;
  email?: string;
}

type FaceLoginStep =
  | "email-input"
  | "instruction"
  | "capture"
  | "processing"
  | "success"
  | "error";

type FaceFeedbackState =
  | "detecting"
  | "no-face-detected"
  | "multiple-faces-detected"
  | "low-light-warning"
  | "retry-ready"
  | "system-error"
  | null;

const GUIDE_WIDTH_RATIO = 0.62;
const GUIDE_HEIGHT_RATIO = 0.78;
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

const getFriendlyFaceFeedback = (
  message?: string | null,
  code?: string | null,
): { faceError: string; faceFeedback: FaceFeedbackState } => {
  const normalizedCode = code?.trim().toUpperCase() || "";
  const normalizedMessage = getFriendlyFaceErrorMessage(message, code);
  const lowerMessage = normalizedMessage.toLowerCase();

  if (
    normalizedCode === "FACE_NOT_DETECTED" ||
    normalizedCode === "NO_FACE_DETECTED" ||
    lowerMessage.includes("no face detected")
  ) {
    return {
      faceError: "No face detected. Please keep your face centered.",
      faceFeedback: "no-face-detected",
    };
  }

  if (
    normalizedCode === "MULTIPLE_FACES" ||
    normalizedCode === "MULTIPLE_FACES_DETECTED" ||
    lowerMessage.includes("multiple faces")
  ) {
    return {
      faceError: "Multiple faces detected. Please ensure only your face is visible.",
      faceFeedback: "multiple-faces-detected",
    };
  }

  if (
    normalizedCode === "LOW_LIGHT" ||
    normalizedCode === "IMAGE_PROCESSING_ERROR" ||
    lowerMessage.includes("clearer photo") ||
    lowerMessage.includes("good lighting") ||
    lowerMessage.includes("low light") ||
    lowerMessage.includes("too dark")
  ) {
    return {
      faceError:
        "Low light warning: improve lighting and keep your face clearly visible.",
      faceFeedback: "low-light-warning",
    };
  }

  if (
    normalizedCode === "REQUEST_TIMEOUT" ||
    normalizedCode === "SERVICE_UNAVAILABLE" ||
    normalizedCode === "INVALID_RESPONSE"
  ) {
    return {
      faceError: normalizedMessage,
      faceFeedback: "system-error",
    };
  }

  return {
    faceError: normalizedMessage,
    faceFeedback: "retry-ready",
  };
};

const getStatusCopy = (faceFeedback: FaceFeedbackState) => {
  switch (faceFeedback) {
    case "detecting":
      return "Detecting face...";
    case "no-face-detected":
      return "No face detected";
    case "multiple-faces-detected":
      return "Multiple faces detected";
    case "low-light-warning":
      return "Low light warning";
    case "retry-ready":
      return "Please try again";
    case "system-error":
      return "Face system error";
    default:
      return null;
  }
};

export const FaceLoginModal: React.FC<FaceLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError: _onError,
  email: initialEmail,
}) => {
  const [step, setStep] = useState<FaceLoginStep>(
    initialEmail ? "instruction" : "email-input",
  );
  const [email, setEmail] = useState(initialEmail || "");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(MAX_ATTEMPTS);
  const [faceError, setFaceError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState<FaceFeedbackState>(null);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);
  const lockoutWasActiveRef = useRef(false);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const guideBoxRef = useRef<HTMLDivElement | null>(null);

  const isLockedOut =
    typeof lockoutUntilMs === "number" && Date.now() < lockoutUntilMs;

  const clearPreview = useCallback(() => {
    setCapturedImageUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
  }, []);

  const clearModalState = useCallback(() => {
    setFaceError(null);
    setFaceFeedback(null);
    setLoading(false);
  }, []);

  const applyFaceFailure = useCallback(
    (message?: string | null, code?: string | null) => {
      const next = getFriendlyFaceFeedback(message, code);
      setFaceError(next.faceError);
      setFaceFeedback(next.faceFeedback);
      setStep("error");
    },
    [],
  );

  const { videoRef, isActive, startCamera, stopCamera, captureImage } =
    useWebcam({
      onError: (error) => {
        applyFaceFailure(error, "CAMERA_ERROR");
      },
    });

  const { authenticateFace, reset } = useFaceAuthentication();

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      clearModalState();

      if (!email.trim()) {
        setFaceError("Please enter your email address.");
        setFaceFeedback("retry-ready");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setFaceError("Please enter a valid email address.");
        setFaceFeedback("retry-ready");
        return;
      }

      setStep("instruction");
      reset();
    },
    [clearModalState, email, reset],
  );

  const handleStartCapture = useCallback(async () => {
    try {
      clearModalState();
      clearPreview();
      reset();

      if (isLockedOut && lockoutUntilMs) {
        const remaining = Math.max(
          1,
          Math.ceil((lockoutUntilMs - Date.now()) / 1000),
        );
        applyFaceFailure(
          `Too many failed attempts. Please wait ${remaining}s or use another login method.`,
          "LOCKED_OUT",
        );
        return;
      }

      setStep("capture");
      setAttemptsRemaining(MAX_ATTEMPTS);
      await startCamera();
    } catch (error) {
      applyFaceFailure(
        error instanceof Error ? error.message : "Unable to start the camera.",
        "CAMERA_ERROR",
      );
    }
  }, [
    applyFaceFailure,
    clearModalState,
    clearPreview,
    isLockedOut,
    lockoutUntilMs,
    reset,
    startCamera,
  ]);

  const captureFromGuideBox = useCallback(async (): Promise<Blob | null> => {
    if (
      !videoRef.current ||
      !isActive ||
      !videoFrameRef.current ||
      !guideBoxRef.current
    ) {
      return captureImage();
    }

    const video = videoRef.current;
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;

    if (!sourceWidth || !sourceHeight) {
      return captureImage();
    }

    const frameRect = videoFrameRef.current.getBoundingClientRect();
    const guideRect = guideBoxRef.current.getBoundingClientRect();
    const frameWidth = frameRect.width;
    const frameHeight = frameRect.height;

    if (frameWidth <= 0 || frameHeight <= 0) {
      return captureImage();
    }

    const coverScale = Math.max(
      frameWidth / sourceWidth,
      frameHeight / sourceHeight,
    );
    const renderedWidth = sourceWidth * coverScale;
    const renderedHeight = sourceHeight * coverScale;
    const overflowX = (renderedWidth - frameWidth) / 2;
    const overflowY = (renderedHeight - frameHeight) / 2;

    const guideXInFrame = guideRect.left - frameRect.left;
    const guideYInFrame = guideRect.top - frameRect.top;
    const guideWidth = guideRect.width;
    const guideHeight = guideRect.height;

    const sourceX = Math.max(
      0,
      Math.min(
        sourceWidth - 1,
        Math.floor((guideXInFrame + overflowX) / coverScale),
      ),
    );
    const sourceY = Math.max(
      0,
      Math.min(
        sourceHeight - 1,
        Math.floor((guideYInFrame + overflowY) / coverScale),
      ),
    );
    const cropWidth = Math.max(
      1,
      Math.min(sourceWidth - sourceX, Math.floor(guideWidth / coverScale)),
    );
    const cropHeight = Math.max(
      1,
      Math.min(sourceHeight - sourceY, Math.floor(guideHeight / coverScale)),
    );

    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      return captureImage();
    }

    context.drawImage(
      video,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
    });
  }, [captureImage, isActive, videoRef]);

  const handleCapture = useCallback(async () => {
    if (loading) {
      return;
    }

    try {
      clearModalState();
      setLoading(true);
      setFaceFeedback("detecting");
      setStep("processing");

      const imageBlob = await captureFromGuideBox();

      if (!imageBlob) {
        applyFaceFailure(
          "No image was captured. Please capture your face again.",
          "NO_FILE_UPLOADED",
        );
        setAttemptsRemaining((current) => Math.max(0, current - 1));
        return;
      }

      clearPreview();
      setCapturedImageUrl(URL.createObjectURL(imageBlob));
      stopCamera();

      const result = await authenticateFace(email.trim(), imageBlob);

      if (result.success && result.user && result.token) {
        setFaceFeedback(null);
        setFaceError(null);
        setStep("success");
        onSuccess?.({ user: result.user, token: result.token });
        return;
      }

      const remainingAttempts = attemptsRemaining - 1;
      setAttemptsRemaining(Math.max(0, remainingAttempts));

      if (remainingAttempts <= 0) {
        setLockoutUntilMs(Date.now() + LOCKOUT_SECONDS * 1000);
        applyFaceFailure(
          "Too many failed attempts. Please wait a moment or use another login method.",
          result.code || "LOCKED_OUT",
        );
        return;
      }

      const next = getFriendlyFaceFeedback(
        result.error || "Face verification failed.",
        result.code,
      );
      setFaceError(next.faceError);
      setFaceFeedback(next.faceFeedback);
      setStep("capture");

      try {
        await startCamera();
      } catch (error) {
        applyFaceFailure(
          error instanceof Error ? error.message : next.faceError,
          result.code || "CAMERA_ERROR",
        );
      }
    } catch (error) {
      applyFaceFailure(
        error instanceof Error ? error.message : "Something went wrong.",
        "INTERNAL_SERVER_ERROR",
      );
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    clearModalState,
    captureFromGuideBox,
    clearPreview,
    stopCamera,
    authenticateFace,
    email,
    onSuccess,
    attemptsRemaining,
    applyFaceFailure,
    startCamera,
  ]);

  const handleRetry = useCallback(async () => {
    try {
      if (isLockedOut && lockoutUntilMs) {
        const remaining = Math.max(
          1,
          Math.ceil((lockoutUntilMs - Date.now()) / 1000),
        );
        applyFaceFailure(
          `Too many failed attempts. Please wait ${remaining}s or use another login method.`,
          "LOCKED_OUT",
        );
        return;
      }

      clearModalState();
      clearPreview();
      reset();
      setStep("capture");
      await startCamera();
    } catch (error) {
      applyFaceFailure(
        error instanceof Error ? error.message : "Unable to restart camera.",
        "CAMERA_ERROR",
      );
    }
  }, [
    applyFaceFailure,
    clearModalState,
    clearPreview,
    isLockedOut,
    lockoutUntilMs,
    reset,
    startCamera,
  ]);

  const handleBackToEmail = useCallback(() => {
    stopCamera();
    clearPreview();
    clearModalState();
    setStep("email-input");
    reset();
  }, [clearModalState, clearPreview, reset, stopCamera]);

  const handleClose = useCallback(() => {
    stopCamera();
    clearPreview();
    clearModalState();
    setStep(initialEmail ? "instruction" : "email-input");
    setEmail(initialEmail || "");
    setAttemptsRemaining(MAX_ATTEMPTS);
    setLockoutUntilMs(null);
    reset();
    onClose();
  }, [
    stopCamera,
    clearPreview,
    clearModalState,
    initialEmail,
    reset,
    onClose,
  ]);

  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, [clearPreview]);

  useEffect(() => {
    if (!isOpen) {
      setEmail(initialEmail || "");
      setStep(initialEmail ? "instruction" : "email-input");
    }
  }, [initialEmail, isOpen]);

  useEffect(() => {
    if (!isLockedOut || !lockoutUntilMs) {
      setLockoutRemainingSec(0);
      if (lockoutWasActiveRef.current) {
        lockoutWasActiveRef.current = false;
        handleClose();
      }
      return;
    }

    lockoutWasActiveRef.current = true;

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((lockoutUntilMs - Date.now()) / 1000),
      );
      setLockoutRemainingSec(remaining);
      if (remaining <= 0) {
        setLockoutUntilMs(null);
      }
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [handleClose, isLockedOut, lockoutUntilMs]);

  useEffect(() => {
    return () => {
      if (isOpen === false) {
        stopCamera();
      }
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const statusCopy = getStatusCopy(faceFeedback);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {step !== "email-input" && step !== "instruction" && (
              <button
                onClick={handleBackToEmail}
                className="mr-1 rounded-lg p-1 transition hover:bg-gray-100"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Camera className="h-5 w-5" />
            Face Login
          </h2>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 transition hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {faceError ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-100 p-3 text-sm text-red-600">
              {statusCopy ? <p className="mb-1 font-medium">{statusCopy}</p> : null}
              <p>{faceError}</p>
            </div>
          ) : null}

          {!faceError && statusCopy && step === "processing" ? (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              {statusCopy}
            </div>
          ) : null}

          {step === "email-input" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                <Camera className="h-4 w-4" />
                Continue with Face
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full rounded-lg bg-gray-300 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
              >
                Cancel
              </button>
            </form>
          )}

          {step === "instruction" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">Get Ready</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
                  <li>Ensure good lighting on your face</li>
                  <li>Position your face 12-18 inches from camera</li>
                  <li>Keep your face straight and centered</li>
                  <li>Make sure your face matches your registration photo</li>
                </ul>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-sm font-medium text-gray-900">
                  Logging in as:
                </p>
                <p className="break-all text-sm text-gray-600">{email}</p>
              </div>
              <button
                onClick={() => void handleStartCapture()}
                disabled={isLockedOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400"
              >
                <Camera className="h-4 w-4" />
                {isLockedOut && lockoutRemainingSec > 0
                  ? `Locked (${lockoutRemainingSec}s)`
                  : "Start Camera"}
              </button>
              <button
                onClick={handleBackToEmail}
                className="w-full rounded-lg bg-gray-300 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
              >
                Use Different Email
              </button>
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-4">
              <div
                ref={videoFrameRef}
                className="relative aspect-video w-full overflow-hidden rounded-lg bg-black"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    ref={guideBoxRef}
                    className="rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.32)]"
                    style={{
                      width: `${GUIDE_WIDTH_RATIO * 100}%`,
                      height: `${GUIDE_HEIGHT_RATIO * 100}%`,
                    }}
                  />
                </div>
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>

              <p className="text-center text-sm text-gray-600">
                Keep your full face inside the box, then click "Verify Face".
              </p>

              <p className="text-center text-xs text-gray-500">
                Attempts remaining: {attemptsRemaining}
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void handleCapture()}
                  disabled={!isActive || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400"
                >
                  {loading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Detecting face...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Verify Face
                    </>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="w-full rounded-lg bg-gray-300 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4 py-8 text-center">
              <Loader className="mx-auto h-12 w-12 animate-spin text-blue-600" />
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  Detecting face...
                </h3>
                <p className="text-sm text-gray-600">
                  This should only take a few seconds.
                </p>
              </div>
              {capturedImageUrl ? (
                <div className="relative mx-auto h-24 w-20 overflow-hidden rounded-lg border-2 border-blue-600">
                  <img
                    src={capturedImageUrl}
                    alt="Captured face"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 py-8 text-center">
              <div className="text-4xl">Success</div>
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  Login Successful
                </h3>
                <p className="text-sm text-gray-600">
                  Redirecting you to your dashboard...
                </p>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  {attemptsRemaining <= 0
                    ? "Maximum Attempts Reached"
                    : "Face Verification Failed"}
                </h3>
                <p className="mb-3 text-sm text-gray-600">
                  {faceError ||
                    (attemptsRemaining <= 0
                      ? "You have exceeded the maximum number of attempts. Please try again later or use another login method."
                      : "Your face could not be verified. Please try again.")}
                </p>
                {attemptsRemaining <= 0 && lockoutRemainingSec > 0 ? (
                  <p className="text-xs text-gray-500">
                    You can try again in {lockoutRemainingSec}s.
                  </p>
                ) : null}
                {attemptsRemaining > 0 ? (
                  <p className="text-xs text-gray-500">
                    Attempts remaining: {attemptsRemaining}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {attemptsRemaining > 0 && !isLockedOut ? (
                  <button
                    onClick={() => void handleRetry()}
                    className="flex-1 rounded-lg bg-yellow-600 py-2 font-medium text-white transition hover:bg-yellow-700"
                  >
                    Try Again
                  </button>
                ) : null}
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-lg bg-gray-300 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceLoginModal;
