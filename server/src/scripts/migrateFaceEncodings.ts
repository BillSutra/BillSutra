import "dotenv/config";
import prisma from "../config/db.config.js";
import { ensureFaceDataTable } from "../lib/schemaCompatibility.js";
import {
  encryptFaceEncoding,
  looksEncryptedFaceEncoding,
} from "../lib/faceEncryption.js";

const BATCH_SIZE = Number(process.env.FACE_ENCODING_MIGRATION_BATCH_SIZE || 100);

type FaceDataMigrationRecord = {
  id: number;
  face_encoding: string;
  face_encoding_json: string;
  is_encrypted: boolean;
};

const migrateBatch = async (lastId: number) =>
  prisma.$queryRaw<FaceDataMigrationRecord[]>`
    SELECT id, face_encoding, face_encoding_json, is_encrypted
    FROM "face_data"
    WHERE id > ${lastId}
    ORDER BY id ASC
    LIMIT ${BATCH_SIZE}
  `;

const run = async () => {
  await ensureFaceDataTable();

  let processed = 0;
  let updated = 0;
  let lastId = 0;

  while (true) {
    const batch = await migrateBatch(lastId);
    if (!batch.length) {
      break;
    }

    for (const row of batch) {
      processed += 1;
      lastId = row.id;

      const currentEncoding =
        row.face_encoding_json?.trim() || row.face_encoding?.trim() || "";
      if (!currentEncoding) {
        continue;
      }

      if (row.is_encrypted) {
        continue;
      }

      const encryptedEncoding = looksEncryptedFaceEncoding(currentEncoding)
        ? currentEncoding
        : encryptFaceEncoding(currentEncoding);

      await prisma.$executeRaw`
        UPDATE "face_data"
        SET
          "face_encoding" = ${encryptedEncoding},
          "face_encoding_json" = ${encryptedEncoding},
          "is_encrypted" = true
        WHERE "id" = ${row.id}
      `;
      updated += 1;
    }

    console.info("[face-migration] batch completed", {
      processed,
      updated,
      lastId,
    });
  }

  console.info("[face-migration] migration finished", {
    processed,
    updated,
  });
};

run()
  .catch((error) => {
    console.error("[face-migration] migration failed", {
      message: error instanceof Error ? error.message : error,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
