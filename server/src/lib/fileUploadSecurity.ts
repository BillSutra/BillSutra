const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];

const startsWithSignature = (buffer: Buffer, signature: number[]) =>
  signature.every((value, index) => buffer[index] === value);

const isWebp = (buffer: Buffer) =>
  buffer.length >= 12 &&
  startsWithSignature(buffer, WEBP_RIFF_SIGNATURE) &&
  WEBP_WEBP_SIGNATURE.every((value, index) => buffer[index + 8] === value);

export type AllowedUploadKind = "png" | "jpeg" | "webp" | "pdf";

export const detectUploadKind = (buffer?: Buffer | null): AllowedUploadKind | null => {
  if (!buffer || buffer.length < 4) {
    return null;
  }

  if (startsWithSignature(buffer, PNG_SIGNATURE)) {
    return "png";
  }

  if (startsWithSignature(buffer, JPEG_SIGNATURE)) {
    return "jpeg";
  }

  if (isWebp(buffer)) {
    return "webp";
  }

  if (startsWithSignature(buffer, PDF_SIGNATURE)) {
    return "pdf";
  }

  return null;
};

export const matchesAllowedUploadKinds = (
  buffer: Buffer | undefined,
  allowedKinds: AllowedUploadKind[],
) => {
  const detectedKind = detectUploadKind(buffer);
  return detectedKind ? allowedKinds.includes(detectedKind) : false;
};
