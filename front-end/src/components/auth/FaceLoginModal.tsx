"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Camera, X, AlertCircle, Loader, ArrowLeft } from "lucide-react";
import { useWebcam, useFaceAuthentication } from "@/hooks/useFaceRecognition";

interface FaceLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (auth: { user: any; token: string }) => void;
  onError?: (error: string) => void;
  email?: string;
}

type FaceLoginStep = "email-input" | "instruction" | "capture" | "processing" | "success" | "error";
const GUIDE_WIDTH_RATIO = 0.62;
const GUIDE_HEIGHT_RATIO = 0.78;

/**
 * Face Authentication/Login Component
 * Allows users to login using facial recognition
 */
export const FaceLoginModal: React.FC<FaceLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError,
  email: initialEmail,
}) => {
  const [step, setStep] = useState<FaceLoginStep>(initialEmail ? "instruction" : "email-input");
  const [email, setEmail] = useState(initialEmail || "");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const MAX_ATTEMPTS = 5;
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);
  const lockoutWasActiveRef = useRef(false);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const guideBoxRef = useRef<HTMLDivElement | null>(null);

  const isLockedOut =
    typeof lockoutUntilMs === "number" && Date.now() < lockoutUntilMs;

  const normalizeInlineError = (value: unknown) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.startsWith("Error: ") ? trimmed.slice("Error: ".length) : trimmed;
  };

  const { videoRef, isActive, startCamera, stopCamera, captureImage } =
    useWebcam({
      onError: (error) => {
        console.warn("[FaceLogin] Webcam error:", error);
        setInlineError(error);
        setStep("error");
        onError?.(error);
      },
    });

  const { authenticateFace, isLoading, error, reset } =
    useFaceAuthentication();

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!email.trim()) {
        onError?.("Please enter your email address");
        return;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        onError?.("Please enter a valid email address");
        return;
      }

      console.log("[FaceLogin] Email submitted:", email);
      setStep("instruction");
      setInlineError(null);
      reset();
    },
    [email, onError, reset]
  );

  const handleStartCapture = useCallback(async () => {
    try {
      if (isLockedOut) {
        const remaining = Math.max(
          1,
          Math.ceil((lockoutUntilMs! - Date.now()) / 1000),
        );
        setInlineError(
          `Too many failed attempts. Please wait ${remaining}s or use another login method.`,
        );
        setStep("error");
        return;
      }
      console.log("[FaceLogin] Starting camera");
      setStep("capture");
      setAttemptsRemaining(MAX_ATTEMPTS);
      setCapturedImageUrl(null);
      setInlineError(null);
      reset();
      await startCamera();
    } catch (err) {
      console.error("[FaceLogin] Failed to start camera:", err);
      setStep("error");
    }
  }, [MAX_ATTEMPTS, isLockedOut, lockoutUntilMs, reset, startCamera]);

  const handleCapture = useCallback(async () => {
    const captureFromGuideBox = async (): Promise<Blob | null> => {
      if (!videoRef.current || !isActive || !videoFrameRef.current || !guideBoxRef.current) {
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

      // Map the visual guide box to source pixels with object-cover math.
      const coverScale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
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
        Math.min(
          sourceWidth - sourceX,
          Math.floor(guideWidth / coverScale),
        ),
      );
      const cropHeight = Math.max(
        1,
        Math.min(
          sourceHeight - sourceY,
          Math.floor(guideHeight / coverScale),
        ),
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
    };

    try {
      console.log("[FaceLogin] Capturing image");
      const imageBlob = await captureFromGuideBox();

      if (!imageBlob) {
        console.warn("[FaceLogin] Failed to capture image");
        setAttemptsRemaining((prev) => prev - 1);
        if (attemptsRemaining <= 1) {
          setStep("error");
          onError?.("Failed to capture image after multiple attempts");
        }
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(imageBlob);
      setCapturedImageUrl(previewUrl);

      // Start authentication
      setStep("processing");
      console.log("[FaceLogin] Authenticating face");
      stopCamera();
      const result = await authenticateFace(email, imageBlob);

      if (result.success && result.user && result.token) {
        console.log("[FaceLogin] Authentication successful");
        setStep("success");
        onSuccess?.({ user: result.user, token: result.token });
      } else {
        const authFailureMessage =
          result.error || error || "Face authentication failed";
        console.warn("[FaceLogin] Authentication failed:", authFailureMessage);
        const displayMessage = normalizeInlineError(authFailureMessage);

        const LOCKOUT_SECONDS = 30;
        const remainingAttempts = attemptsRemaining - 1;
        setAttemptsRemaining(Math.max(0, remainingAttempts));

        if (remainingAttempts <= 0) {
          const until = Date.now() + LOCKOUT_SECONDS * 1000;
          setLockoutUntilMs(until);
          setInlineError(
            "Too many failed attempts. Please wait a moment or use another login method.",
          );
          setStep("error");
          return;
        }

        // Go back to capture for retry (no more processing spinner)
        setInlineError(
          displayMessage ?? "Face could not be verified. Please try again.",
        );
        setCapturedImageUrl(null);
        setStep("capture");
        await startCamera();
      }
    } catch (err) {
      console.error("[FaceLogin] Capture/Auth error:", err);
      setStep("error");
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred";
      setInlineError(errorMessage);
      onError?.(errorMessage);
    }
  }, [
    captureImage,
    authenticateFace,
    email,
    attemptsRemaining,
    error,
    onError,
    onSuccess,
    stopCamera,
    startCamera,
    isActive,
    videoRef,
  ]);

  const handleRetry = useCallback(async () => {
    if (isLockedOut) {
      const remaining = Math.max(
        1,
        Math.ceil((lockoutUntilMs! - Date.now()) / 1000),
      );
      setInlineError(
        `Too many failed attempts. Please wait ${remaining}s or use another login method.`,
      );
      setStep("error");
      return;
    }
    setCapturedImageUrl(null);
    setInlineError(null);
    reset();
    setStep("capture");
    await startCamera();
  }, [isLockedOut, lockoutUntilMs, reset, startCamera]);

  const handleBackToEmail = useCallback(() => {
    stopCamera();
    setCapturedImageUrl(null);
    setInlineError(null);
    setStep("email-input");
    reset();
  }, [stopCamera, reset]);

  const handleClose = useCallback(() => {
    stopCamera();
    setCapturedImageUrl(null);
    setInlineError(null);
    setStep(initialEmail ? "instruction" : "email-input");
    setEmail(initialEmail || "");
    setAttemptsRemaining(MAX_ATTEMPTS);
    reset();
    onClose();
  }, [stopCamera, reset, onClose, initialEmail]);

  useEffect(() => {
    if (!isLockedOut || !lockoutUntilMs) {
      setLockoutRemainingSec(0);
      if (lockoutWasActiveRef.current) {
        lockoutWasActiveRef.current = false;
        // Cooldown ended; return user to normal login options.
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
  }, [isLockedOut, lockoutUntilMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isOpen === false) {
        stopCamera();
      }
    };
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {step !== "email-input" && step !== "instruction" && (
              <button
                onClick={handleBackToEmail}
                className="p-1 hover:bg-gray-100 rounded-lg transition mr-1"
                aria-label="Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Camera className="w-5 h-5" />
            Face Login
          </h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "email-input" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Continue with Face
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Cancel
              </button>
            </form>
          )}

          {step === "instruction" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Get Ready</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Ensure good lighting on your face</li>
                  <li>Position your face 12-18 inches from camera</li>
                  <li>Keep your face straight and centered</li>
                  <li>Make sure your face matches your registration photo</li>
                </ul>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-gray-900 mb-1">Logging in as:</p>
                <p className="text-sm text-gray-600 break-all">{email}</p>
              </div>
              <button
                onClick={handleStartCapture}
                disabled={isLockedOut}
                className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                {isLockedOut && lockoutRemainingSec > 0
                  ? `Locked (${lockoutRemainingSec}s)`
                  : "Start Camera"}
              </button>
              <button
                onClick={handleBackToEmail}
                className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
              >
                Use Different Email
              </button>
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-4">
              {inlineError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {inlineError}
                </div>
              ) : null}
              {/* Video Feed */}
              <div
                ref={videoFrameRef}
                className="relative w-full aspect-video bg-black rounded-lg overflow-hidden"
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
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
                    <Loader className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Instructions */}
              <p className="text-sm text-gray-600 text-center">
                Keep your full face inside the box, then click "Verify Face".
              </p>

              <p className="text-xs text-gray-500 text-center">
                Attempts remaining: {attemptsRemaining}
              </p>

              {/* Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleCapture}
                  disabled={!isActive || isLoading}
                  className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition font-medium disabled:bg-gray-400 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Verify Face
                    </>
                  )}
                </button>
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4 text-center py-8">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Verifying Face</h3>
                <p className="text-sm text-gray-600">
                  This should only take a few seconds...
                </p>
              </div>
              {capturedImageUrl && (
                <div className="relative w-20 h-24 mx-auto rounded-lg overflow-hidden border-2 border-blue-600">
                  <img
                    src={capturedImageUrl}
                    alt="Captured face"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center py-8">
              <div className="text-4xl">✅</div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">
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
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {attemptsRemaining <= 0
                    ? "Maximum Attempts Reached"
                    : "Face Not Recognized"}
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {inlineError ||
                    error ||
                    (attemptsRemaining <= 0
                      ? "You have exceeded the maximum number of attempts. Please try again later or use another login method."
                      : "Your face could not be verified. Please try again.")}
                </p>
                {attemptsRemaining <= 0 && lockoutRemainingSec > 0 ? (
                  <p className="text-xs text-gray-500">
                    You can try again in {lockoutRemainingSec}s.
                  </p>
                ) : null}
                {/* Debug info intentionally hidden in UI */}
              </div>
              <div className="flex gap-2">
                {attemptsRemaining > 0 && !isLockedOut && (
                  <button
                    onClick={handleRetry}
                    className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition font-medium"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition font-medium"
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
