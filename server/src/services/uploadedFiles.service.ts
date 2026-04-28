import crypto from "crypto";
import { Prisma } from "@prisma/client";
import prisma from "../config/db.config.js";
import { getBackendAppUrl } from "../lib/appUrls.js";

const TABLE_CACHE_TTL_MS = 60_000;
const tableAvailabilityCache = new Map<string, { value: boolean; checkedAt: number }>();
const DEFAULT_SIGNED_FILE_TTL_MS = 15 * 60 * 1000;

type RegisterUploadedFileInput = {
  ownerUserId: number;
  fileName: string;
  originalName?: string | null;
  filePath: string;
  legacyPublicUrl?: string | null;
  type: string;
  mimeType?: string | null;
};

export type UploadedFileRecord = {
  id: string;
  user_id: number;
  file_name: string;
  original_name: string | null;
  file_path: string;
  legacy_public_url: string | null;
  type: string;
  mime_type: string | null;
  created_at: Date;
};

const setTableAvailability = (tableName: string, value: boolean) => {
  tableAvailabilityCache.set(tableName, {
    value,
    checkedAt: Date.now(),
  });
};

const getSecureFileSigningSecret = () =>
  process.env.SECURE_FILE_SIGNING_SECRET?.trim() ||
  process.env.JWT_SECRET?.trim() ||
  "";

const buildSecureFileSignature = (fileId: string, expiresAt: number) =>
  crypto
    .createHmac("sha256", getSecureFileSigningSecret())
    .update(`${fileId}:${expiresAt}`)
    .digest("hex");

const safeCompare = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isUploadedFilesTableMissingError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2021";

export const isUploadedFilesTableAvailable = async () => {
  const cached = tableAvailabilityCache.get("uploaded_files");
  if (cached && Date.now() - cached.checkedAt < TABLE_CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'uploaded_files'
      ) AS "exists"
    `);

    const exists = result[0]?.exists === true;
    setTableAvailability("uploaded_files", exists);
    return exists;
  } catch {
    setTableAvailability("uploaded_files", false);
    return false;
  }
};

export const buildSecureFileUrl = (
  fileId: string,
  options?: {
    expiresInMs?: number;
  },
) => {
  const expiresAt = Date.now() + (options?.expiresInMs ?? DEFAULT_SIGNED_FILE_TTL_MS);
  const signature = buildSecureFileSignature(fileId, expiresAt);
  const url = new URL(
    `/api/secure-files/${encodeURIComponent(fileId)}`,
    getBackendAppUrl(),
  );
  url.searchParams.set("expires", String(expiresAt));
  url.searchParams.set("signature", signature);
  return url.toString();
};

export const verifySignedSecureFileRequest = (
  fileId: string,
  expires: string | null | undefined,
  signature: string | null | undefined,
) => {
  const secret = getSecureFileSigningSecret();
  if (!secret || !expires || !signature) {
    return false;
  }

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  return safeCompare(buildSecureFileSignature(fileId, expiresAt), signature);
};

export const registerUploadedFile = async (
  input: RegisterUploadedFileInput,
): Promise<UploadedFileRecord | null> => {
  if (!(await isUploadedFilesTableAvailable())) {
    return null;
  }

  try {
    const result = await prisma.$queryRaw<UploadedFileRecord[]>(Prisma.sql`
      INSERT INTO "uploaded_files" (
        "id",
        "user_id",
        "file_name",
        "original_name",
        "file_path",
        "legacy_public_url",
        "type",
        "mime_type"
      )
      VALUES (
        ${crypto.randomUUID()},
        ${input.ownerUserId},
        ${input.fileName},
        ${input.originalName ?? null},
        ${input.filePath},
        ${input.legacyPublicUrl ?? null},
        ${input.type},
        ${input.mimeType ?? null}
      )
      ON CONFLICT ("file_path") DO UPDATE
      SET
        "file_name" = EXCLUDED."file_name",
        "original_name" = EXCLUDED."original_name",
        "legacy_public_url" = EXCLUDED."legacy_public_url",
        "type" = EXCLUDED."type",
        "mime_type" = EXCLUDED."mime_type"
      RETURNING
        "id",
        "user_id",
        "file_name",
        "original_name",
        "file_path",
        "legacy_public_url",
        "type",
        "mime_type",
        "created_at"
    `);

    return result[0] ?? null;
  } catch (error) {
    if (isUploadedFilesTableMissingError(error)) {
      setTableAvailability("uploaded_files", false);
      return null;
    }

    throw error;
  }
};

export const findUploadedFileById = async (fileId: string) => {
  if (!(await isUploadedFilesTableAvailable())) {
    return null;
  }

  try {
    const result = await prisma.$queryRaw<UploadedFileRecord[]>(Prisma.sql`
      SELECT
        "id",
        "user_id",
        "file_name",
        "original_name",
        "file_path",
        "legacy_public_url",
        "type",
        "mime_type",
        "created_at"
      FROM "uploaded_files"
      WHERE "id" = ${fileId}
      LIMIT 1
    `);

    return result[0] ?? null;
  } catch (error) {
    if (isUploadedFilesTableMissingError(error)) {
      setTableAvailability("uploaded_files", false);
      return null;
    }

    throw error;
  }
};

export const deleteUploadedFileById = async (fileId?: string | null) => {
  if (!fileId || !(await isUploadedFilesTableAvailable())) {
    return;
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM "uploaded_files"
      WHERE "id" = ${fileId}
    `;
  } catch (error) {
    if (isUploadedFilesTableMissingError(error)) {
      setTableAvailability("uploaded_files", false);
      return;
    }

    throw error;
  }
};

export const deleteUploadedFileByPath = async (filePath?: string | null) => {
  if (!filePath || !(await isUploadedFilesTableAvailable())) {
    return;
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM "uploaded_files"
      WHERE "file_path" = ${filePath}
    `;
  } catch (error) {
    if (isUploadedFilesTableMissingError(error)) {
      setTableAvailability("uploaded_files", false);
      return;
    }

    throw error;
  }
};

export const deleteUploadedFilesByOwnerId = async (ownerUserId: number) => {
  if (!(await isUploadedFilesTableAvailable())) {
    return;
  }

  try {
    await prisma.$executeRaw`
      DELETE FROM "uploaded_files"
      WHERE "user_id" = ${ownerUserId}
    `;
  } catch (error) {
    if (isUploadedFilesTableMissingError(error)) {
      setTableAvailability("uploaded_files", false);
      return;
    }

    throw error;
  }
};
