import crypto from "crypto";

const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

const ENCRYPTED_PREFIX = "enc::";

const normalizeEncryptionKey = (raw: string) => {
  const trimmed = raw.trim();

  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }

  if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    try {
      const buffer = Buffer.from(trimmed, "base64");
      if (buffer.length === 32) {
        return buffer;
      }
    } catch {
      // Fall through to utf-8 handling.
    }
  }

  return Buffer.from(trimmed, "utf8");
};

const getEncryptionKey = () => {
  const rawKey =
    process.env.DATA_ENCRYPTION_KEY?.trim() ||
    process.env.FIELD_ENCRYPTION_KEY?.trim() ||
    "";

  if (!rawKey) {
    return null;
  }

  const key = normalizeEncryptionKey(rawKey);
  if (key.length !== 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM.",
    );
  }

  return key;
};

export const isSensitiveFieldEncryptionEnabled = () => Boolean(getEncryptionKey());

export const looksEncryptedValue = (value?: string | null) =>
  typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);

export const encryptSensitiveValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (looksEncryptedValue(trimmed)) {
    return trimmed;
  }

  const key = getEncryptionKey();
  if (!key) {
    return trimmed;
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString("base64")}`;
};

export const decryptSensitiveValue = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (!looksEncryptedValue(value)) {
    return value;
  }

  const key = getEncryptionKey();
  if (!key) {
    return value;
  }

  const payload = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), "base64");
  const iv = payload.subarray(0, IV_LENGTH_BYTES);
  const authTag = payload.subarray(
    IV_LENGTH_BYTES,
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );
  const encrypted = payload.subarray(
    IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
  );

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
};

export const maybeDecryptSensitiveValue = (value?: string | null) => {
  try {
    return decryptSensitiveValue(value);
  } catch {
    return value ?? null;
  }
};
