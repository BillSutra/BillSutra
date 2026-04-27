"use client";

export const FACE_MIN_WIDTH = 640;
export const FACE_MIN_HEIGHT = 480;
export const FACE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const FACE_MIN_BRIGHTNESS = 55;

export type FaceBlobAnalysis = {
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  brightnessMean: number;
};

export const analyzeFaceBlob = async (
  blob: Blob,
): Promise<FaceBlobAnalysis> => {
  const imageUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error("Unable to read the captured image."));
      nextImage.src = imageUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to inspect the captured image.");
    }

    context.drawImage(image, 0, 0);
    const sampleWidth = Math.min(64, canvas.width);
    const sampleHeight = Math.min(64, canvas.height);
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = sampleWidth;
    sampleCanvas.height = sampleHeight;
    const sampleContext = sampleCanvas.getContext("2d");
    if (!sampleContext) {
      throw new Error("Unable to inspect the captured image.");
    }

    sampleContext.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight)
      .data;

    let totalBrightness = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      totalBrightness +=
        0.299 * pixels[index] +
        0.587 * pixels[index + 1] +
        0.114 * pixels[index + 2];
    }

    const pixelCount = Math.max(1, pixels.length / 4);

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      sizeBytes: blob.size,
      mimeType: blob.type || "image/jpeg",
      brightnessMean: totalBrightness / pixelCount,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export const validateFaceBlob = (analysis: FaceBlobAnalysis) => {
  if (analysis.sizeBytes <= 0) {
    return "No image was captured. Please try again.";
  }

  if (analysis.sizeBytes > FACE_MAX_UPLOAD_BYTES) {
    return "Captured image is too large. Please try again.";
  }

  if (
    analysis.width < FACE_MIN_WIDTH ||
    analysis.height < FACE_MIN_HEIGHT
  ) {
    return `Camera resolution is too low. Minimum supported size is ${FACE_MIN_WIDTH}x${FACE_MIN_HEIGHT}.`;
  }

  if (analysis.brightnessMean < FACE_MIN_BRIGHTNESS) {
    return "The image is too dark. Please move to better lighting and try again.";
  }

  return null;
};

export const blobToDataUrl = async (blob: Blob): Promise<string> =>
  await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Unable to read captured image."));
    reader.readAsDataURL(blob);
  });

export const buildFaceUploadFormData = (
  imageBlob: Blob,
  fields?: Record<string, string | number | boolean | null | undefined>,
) => {
  const formData = new FormData();
  formData.append("image", imageBlob, "face.jpg");

  Object.entries(fields || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
};
