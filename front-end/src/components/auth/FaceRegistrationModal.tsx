"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Camera, X, Check, AlertCircle, Loader, RotateCcw } from "lucide-react";
import { useWebcam, useFaceRegistration } from "@/hooks/useFaceRecognition";
import { getFriendlyFaceErrorMessage } from "@/utils/faceErrorHandler";
import { analyzeFaceBlob, validateFaceBlob } from "@/utils/faceCapture";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type FaceRegistrationStep =
  | "instruction"
  | "capture"
  | "preview"
  | "processing"
  | "success"
  | "error";

type FacePreview = {
  blob: Blob;
  url: string;
  summary: string;
};

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError: _onError,
}) => {
  const [step, setStep] = useState<FaceRegistrationStep>("instruction");
  const [preview, setPreview] = useState<FacePreview | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);

  const clearPreview = useCallback(() => {
    setPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  }, []);

  const { videoRef, isActive, startCamera, stopCamera, captureImage } =
    useWebcam({
      onError: (error) => {
        setFaceError(error);
        setStep("error");
      },
    });

  const { registerFace, isLoading, reset } = useFaceRegistration();

  const beginCapture = useCallback(async () => {
    setFaceError(null);
    clearPreview();
    reset();
    setStep("capture");
    await startCamera();
  }, [clearPreview, reset, startCamera]);

  const handleStartCapture = useCallback(async () => {
    try {
      await beginCapture();
    } catch (error) {
      setFaceError(
        error instanceof Error ? error.message : "Unable to start the camera.",
      );
      setStep("error");
    }
  }, [beginCapture]);

  const handleCapture = useCallback(async () => {
    try {
      setFaceError(null);
      const imageBlob = await captureImage();

      if (!imageBlob) {
        setFaceError("No image was captured. Please try again.");
        setStep("error");
        return;
      }

      const analysis = await analyzeFaceBlob(imageBlob);
      const validationError = validateFaceBlob(analysis);
      if (validationError) {
        setFaceError(
          getFriendlyFaceErrorMessage(
            validationError,
            analysis.brightnessMean < 55 ? "LOW_LIGHT" : "IMAGE_PROCESSING_ERROR",
          ),
        );
        setStep("error");
        return;
      }

      clearPreview();
      setPreview({
        blob: imageBlob,
        url: URL.createObjectURL(imageBlob),
        summary: `${analysis.width}x${analysis.height} - brightness ${Math.round(
          analysis.brightnessMean,
        )}`,
      });
      stopCamera();
      setStep("preview");
    } catch (error) {
      setFaceError(
        error instanceof Error ? error.message : "An unknown error occurred.",
      );
      setStep("error");
    }
  }, [captureImage, clearPreview, stopCamera]);

  const handleRegister = useCallback(async () => {
    if (!preview?.blob) {
      setFaceError("No image was captured. Please try again.");
      setStep("error");
      return;
    }

    try {
      setFaceError(null);
      setStep("processing");

      const result = await registerFace(preview.blob);
      if (result.success) {
        setStep("success");
        onSuccess?.();
        return;
      }

      setFaceError(
        getFriendlyFaceErrorMessage(
          result.error || "Face registration failed. Please try again.",
          result.code,
        ),
      );
      setStep("error");
    } catch (error) {
      setFaceError(
        error instanceof Error ? error.message : "An unknown error occurred.",
      );
      setStep("error");
    }
  }, [onSuccess, preview, registerFace]);

  const handleRetry = useCallback(async () => {
    try {
      await beginCapture();
    } catch (error) {
      setFaceError(
        error instanceof Error ? error.message : "Unable to restart the camera.",
      );
      setStep("error");
    }
  }, [beginCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    clearPreview();
    setFaceError(null);
    setStep("instruction");
    reset();
    onClose();
  }, [clearPreview, onClose, reset, stopCamera]);

  useEffect(() => {
    return () => {
      clearPreview();
    };
  }, [clearPreview]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Camera className="h-5 w-5" />
            Register Face
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
          {step === "instruction" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">Get Ready</h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-blue-800">
                  <li>Ensure good lighting on your face</li>
                  <li>Position your face 12-18 inches from camera</li>
                  <li>Keep your face straight and centered</li>
                  <li>Remove any obstructions like masks or strong glare</li>
                </ul>
              </div>
              <button
                onClick={() => void handleStartCapture()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                <Camera className="h-4 w-4" />
                Start Camera
              </button>
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-4">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full -scale-x-100 object-cover"
                />
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <p className="text-center text-sm text-gray-600">
                Capture a clear, well-lit preview before saving your face.
              </p>
              <p className="text-center text-xs text-gray-500">
                {isActive ? "Camera ready" : "Starting camera..."}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void handleCapture()}
                  disabled={!isActive || isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400"
                >
                  <Camera className="h-4 w-4" />
                  Capture Preview
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

          {step === "preview" && (
            <div className="space-y-4">
              {preview ? (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
                  <img
                    src={preview.url}
                    alt="Registered face preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Review your preview</p>
                <p className="mt-1">
                  Continue only if your face is centered and clearly visible.
                </p>
                {preview?.summary ? (
                  <p className="mt-2 text-xs text-gray-500">{preview.summary}</p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => void handleRegister()}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2 font-medium text-white transition hover:bg-green-700 disabled:bg-gray-400"
                >
                  {isLoading ? (
                    <>
                      <Loader className="h-4 w-4 animate-spin" />
                      Saving face...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Save Face
                    </>
                  )}
                </button>
                <button
                  onClick={() => void handleRetry()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-300 py-2 font-medium text-gray-700 transition hover:bg-gray-400"
                >
                  <RotateCcw className="h-4 w-4" />
                  Retake Photo
                </button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="space-y-4 py-8 text-center">
              <Loader className="mx-auto h-12 w-12 animate-spin text-blue-600" />
              <div>
                <h3 className="mb-1 font-semibold text-gray-900">
                  Registering face...
                </h3>
                <p className="text-sm text-gray-600">
                  This should only take a moment.
                </p>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  Face Registered Successfully
                </h3>
                <p className="text-sm text-gray-600">
                  You can now use facial recognition to login to your account.
                </p>
              </div>
              {preview ? (
                <div className="relative mx-auto h-40 w-32 overflow-hidden rounded-lg border-2 border-green-600">
                  <img
                    src={preview.url}
                    alt="Registered face"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <button
                onClick={handleClose}
                className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">
                  Registration Failed
                </h3>
                <p className="text-sm text-gray-600">
                  {faceError || "An error occurred during face registration."}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void handleRetry()}
                  className="flex-1 rounded-lg bg-blue-600 py-2 font-medium text-white transition hover:bg-blue-700"
                >
                  Try Again
                </button>
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

export default FaceRegistrationModal;
