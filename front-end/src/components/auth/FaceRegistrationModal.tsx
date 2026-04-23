"use client";

import React, { useState, useCallback } from "react";
import { Camera, X, Check, AlertCircle, Loader } from "lucide-react";
import { useWebcam, useFaceRegistration } from "@/hooks/useFaceRecognition";
import { getFriendlyFaceErrorMessage } from "@/utils/faceErrorHandler";

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

/**
 * Face Registration Component for Profile Settings
 * Allows users to capture and register their face for facial recognition login
 */
export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onError: _onError,
}) => {
  const [step, setStep] = useState<"instruction" | "capture" | "success" | "error">("instruction");
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [faceError, setFaceError] = useState<string | null>(null);
  const MAX_RETRIES = 3;

  const { videoRef, isActive, startCamera, stopCamera, captureImage } =
    useWebcam({
      onError: (error) => {
        setFaceError(error);
        setStep("error");
      },
    });

  const { registerFace, isLoading, reset } = useFaceRegistration();

  const handleStartCapture = useCallback(async () => {
    try {
      setFaceError(null);
      setStep("capture");
      setRetryCount(0);
      setCapturedImageUrl(null);
      reset();
      await startCamera();
    } catch (err) {
      setFaceError(
        err instanceof Error ? err.message : "Unable to start the camera.",
      );
      setStep("error");
    }
  }, [startCamera, reset]);

  const handleCapture = useCallback(async () => {
    try {
      setFaceError(null);
      const imageBlob = await captureImage();

      if (!imageBlob) {
        setRetryCount((prev) => prev + 1);
        if (retryCount >= MAX_RETRIES) {
          setFaceError("Failed to capture image after multiple attempts.");
          setStep("error");
        }
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(imageBlob);
      setCapturedImageUrl(previewUrl);
      stopCamera();

      const result = await registerFace(imageBlob);

      if (result.success) {
        setFaceError(null);
        setStep("success");
        onSuccess?.();
      } else {
        const failureMessage = getFriendlyFaceErrorMessage(
          result.error || "Face registration failed. Please try again.",
          result.code,
        );
        setFaceError(failureMessage);
        setStep("error");
      }
    } catch (err) {
      setStep("error");
      setFaceError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
    }
  }, [
    captureImage,
    registerFace,
    stopCamera,
    retryCount,
    onSuccess,
  ]);

  const handleRetry = useCallback(async () => {
    try {
      setFaceError(null);
      setCapturedImageUrl(null);
      setStep("capture");
      reset();
      await startCamera();
    } catch (err) {
      setFaceError(
        err instanceof Error ? err.message : "Unable to restart the camera.",
      );
      setStep("error");
    }
  }, [startCamera, reset]);

  const handleClose = useCallback(() => {
    stopCamera();
    setFaceError(null);
    setCapturedImageUrl(null);
    setStep("instruction");
    setRetryCount(0);
    reset();
    onClose();
  }, [stopCamera, reset, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Register Face
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
          {step === "instruction" && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Get Ready</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Ensure good lighting on your face</li>
                  <li>Position your face 12-18 inches from camera</li>
                  <li>Keep your face straight and centered</li>
                  <li>Remove any obstructions (glasses, masks)</li>
                </ul>
              </div>
              <button
                onClick={handleStartCapture}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
            </div>
          )}

          {step === "capture" && (
            <div className="space-y-4">
              {/* Video Feed */}
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {!isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>

              {/* Instructions */}
              <p className="text-sm text-gray-600 text-center">
                Click "Capture Photo" when your face is clearly visible and
                well-lit
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
                      Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4" />
                      Capture Photo
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

          {step === "success" && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Face Registered Successfully
                </h3>
                <p className="text-sm text-gray-600">
                  You can now use facial recognition to login to your account.
                </p>
              </div>
              {capturedImageUrl && (
                <div className="relative w-32 h-40 mx-auto rounded-lg overflow-hidden border-2 border-green-600">
                  <img
                    src={capturedImageUrl}
                    alt="Registered face"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <button
                onClick={handleClose}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Done
              </button>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Registration Failed
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  {faceError || "An error occurred during face registration"}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRetry}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  Try Again
                </button>
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

export default FaceRegistrationModal;
