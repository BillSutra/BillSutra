import "dotenv/config";
import prisma from "../config/db.config.js";
import { ensureFaceDataTable } from "../lib/schemaCompatibility.js";
import {
  decryptFaceEncoding,
  looksEncryptedFaceEncoding,
} from "../lib/faceEncryption.js";

type FaceDataAuditRecord = {
  id: number;
  user_id: number;
  face_encoding: string;
  face_encoding_json: string;
  is_enabled: boolean;
  is_encrypted: boolean;
};

const BATCH_SIZE = Number(process.env.FACE_ENCODING_AUDIT_BATCH_SIZE || 100);

const isValidEncoding = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.length === 128 &&
  value.every((entry) => typeof entry === "number" && Number.isFinite(entry));

const auditBatch = async (lastId: number) =>
  prisma.$queryRaw<FaceDataAuditRecord[]>`
    SELECT id, user_id, face_encoding, face_encoding_json, is_enabled, is_encrypted
    FROM "face_data"
    WHERE id > ${lastId}
    ORDER BY id ASC
    LIMIT ${BATCH_SIZE}
  `;

const run = async () => {
  await ensureFaceDataTable();

  let processed = 0;
  let disabled = 0;
  let lastId = 0;

  while (true) {
    const batch = await auditBatch(lastId);
    if (!batch.length) {
      break;
    }

    for (const row of batch) {
      processed += 1;
      lastId = row.id;

      if (!row.is_enabled) {
        continue;
      }

      const rawEncoding =
        row.face_encoding_json?.trim() || row.face_encoding?.trim() || "";
      if (!rawEncoding) {
        await prisma.$executeRaw`
          UPDATE "face_data"
          SET "is_enabled" = false
          WHERE "id" = ${row.id}
        `;
        disabled += 1;
        continue;
      }

      try {
        const decryptedEncoding =
          row.is_encrypted || looksEncryptedFaceEncoding(rawEncoding)
            ? decryptFaceEncoding(rawEncoding)
            : rawEncoding;
        const parsed = JSON.parse(decryptedEncoding);

        if (!isValidEncoding(parsed)) {
          throw new Error("invalid_encoding_dimensions");
        }
      } catch (error) {
        await prisma.$executeRaw`
          UPDATE "face_data"
          SET "is_enabled" = false
          WHERE "id" = ${row.id}
        `;
        disabled += 1;
        console.warn("[face-audit] disabled invalid face record", {
          id: row.id,
          userId: row.user_id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.info("[face-audit] batch completed", {
      processed,
      disabled,
      lastId,
    });
  }

  console.info("[face-audit] audit finished", {
    processed,
    disabled,
  });
};

run()
  .catch((error) => {
    console.error("[face-audit] audit failed", {
      message: error instanceof Error ? error.message : error,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
