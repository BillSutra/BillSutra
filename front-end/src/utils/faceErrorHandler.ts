export type NormalizedFaceError = {
  message: string;
  code: string;
  status: number;
};

type ErrorWithResponse = {
  response?: {
    data?: {
      message?: string;
      error?: string;
      code?: string;
    };
    status?: number;
  };
  message?: string;
  error?: string;
  code?: string;
  status?: number;
};

const DEFAULT_FACE_ERROR: NormalizedFaceError = {
  message: "Face verification failed",
  code: "UNKNOWN_ERROR",
  status: 500,
};

export const faceErrorMessages: Record<string, string> = {
  FACE_NOT_FOUND: "No registered face found.",
  FACE_NOT_DETECTED: "No face detected. Keep your face inside the box.",
  NO_FACE_DETECTED: "No face detected. Keep your face inside the box.",
  MULTIPLE_FACES: "Multiple faces detected. Only one person allowed.",
  MULTIPLE_FACES_DETECTED:
    "Multiple faces detected. Only one person allowed.",
  NO_FACE_REGISTERED: "No registered face found.",
  LOW_LIGHT: "Lighting is too low. Improve lighting and try again.",
  IMAGE_PROCESSING_ERROR:
    "Lighting is too low. Improve lighting and try again.",
};

export const normalizeFaceError = (err: unknown): NormalizedFaceError => {
  const candidate =
    typeof err === "object" && err !== null ? (err as ErrorWithResponse) : null;

  if (candidate?.response?.data) {
    return {
      message:
        candidate.response.data.message ||
        candidate.response.data.error ||
        DEFAULT_FACE_ERROR.message,
      code: candidate.response.data.code || "FACE_ERROR",
      status:
        typeof candidate.response.status === "number"
          ? candidate.response.status
          : DEFAULT_FACE_ERROR.status,
    };
  }

  if (
    candidate &&
    (typeof candidate.message === "string" ||
      typeof candidate.error === "string" ||
      typeof candidate.code === "string")
  ) {
    return {
      message:
        candidate.message || candidate.error || DEFAULT_FACE_ERROR.message,
      code: candidate.code || "FACE_ERROR",
      status: typeof candidate.status === "number" ? candidate.status : 500,
    };
  }

  if (err instanceof Error) {
    return {
      message: err.message,
      code: "UNKNOWN_ERROR",
      status: 500,
    };
  }

  return {
    message: "Something went wrong",
    code: "UNKNOWN_ERROR",
    status: 500,
  };
};

export const getFriendlyFaceErrorMessage = (
  message?: string | null,
  code?: string | null,
) => {
  const normalizedCode = code?.trim().toUpperCase() || "";
  return (
    (normalizedCode ? faceErrorMessages[normalizedCode] : undefined) ||
    message?.trim() ||
    DEFAULT_FACE_ERROR.message
  );
};
