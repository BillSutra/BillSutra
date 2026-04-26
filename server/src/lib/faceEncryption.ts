import crypto from "crypto";
import AppError from "../utils/AppError.js";

const FACE_ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

let cachedFaceEncryptionKey: Buffer | null = null;

const normalizeFaceEncryptionKey = (rawKey: string) => {
  const trimmed = rawKey.trim();

  if (!trimmed) {
    throw new AppError("FACE_ENCRYPTION_KEY is required for biometric encryption.", 503);
  }

  const utf8Buffer = Buffer.from(trimmed, "utf8");
  if (utf8Buffer.length === 32) {
    return utf8Buffer;
  }

  if (/^[a-f0-9]{64}$/i.test(trimmed)) {
    const hexBuffer = Buffer.from(trimmed, "hex");
    if (hexBuffer.length === 32) {
      return hexBuffer;
    }
  }

  try {
    const base64Buffer = Buffer.from(trimmed, "base64");
    if (base64Buffer.length === 32) {
      return base64Buffer;
    }
  } catch {
    // Ignore invalid base64 input and fall through to the final error.
  }

  throw new AppError(
    "FACE_ENCRYPTION_KEY must resolve to exactly 32 bytes (raw text, hex, or base64).",
    503,
  );
};

const getFaceEncryptionKey = () => {
  if (cachedFaceEncryptionKey) {
    return cachedFaceEncryptionKey;
  }

  const rawKey = process.env.FACE_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new AppError("FACE_ENCRYPTION_KEY is required for biometric encryption.", 503);
  }

  cachedFaceEncryptionKey = normalizeFaceEncryptionKey(rawKey);
  return cachedFaceEncryptionKey;
};

export const looksEncryptedFaceEncoding = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return false;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    return false;
  }

  try {
    const decoded = Buffer.from(trimmed, "base64");
    return decoded.length > IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES;
  } catch {
    return false;
  }
};

export const encrypt = (data: string) => {
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(
    FACE_ENCRYPTION_ALGORITHM,
    getFaceEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decrypt = (encryptedValue: string) => {
  const payload = Buffer.from(encryptedValue, "base64");

  if (payload.length <= IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
    throw new AppError("Stored biometric data is malformed.", 500);
  }

  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const encrypted = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

  const decipher = crypto.createDecipheriv(
    FACE_ENCRYPTION_ALGORITHM,
    getFaceEncryptionKey(),
    iv,
  );
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
};

export const encryptFaceEncoding = (encoding: string) => encrypt(encoding);
export const decryptFaceEncoding = (encoding: string) => decrypt(encoding);
