import prisma from "../config/db.config.js";

let extraEntriesTablePromise: Promise<void> | null = null;
let schemaCompatibilityPromise: Promise<void> | null = null;

const ensureInvoiceDiscountMetadataColumnsInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(32) NOT NULL DEFAULT 'FIXED',
      ADD COLUMN IF NOT EXISTS "discount_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "discount_calculated" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_mode" VARCHAR(32) NOT NULL DEFAULT 'CGST_SGST';
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "invoices"
    SET
      "discount_type" = COALESCE(NULLIF("discount_type", ''), 'FIXED'),
      "discount_value" = CASE
        WHEN COALESCE("discount_value", 0) = 0 THEN COALESCE("discount", 0)
        ELSE "discount_value"
      END,
      "discount_calculated" = CASE
        WHEN COALESCE("discount_calculated", 0) = 0 THEN COALESCE("discount", 0)
        ELSE "discount_calculated"
      END,
      "tax_mode" = CASE
        WHEN COALESCE("tax", 0) <= 0 THEN 'NONE'
        ELSE COALESCE(NULLIF("tax_mode", ''), 'CGST_SGST')
      END;
  `);
};

const ensureExtraEntriesTableInternal = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'EntryType'
      ) THEN
        CREATE TYPE "EntryType" AS ENUM ('INCOME', 'EXPENSE', 'LOSS', 'INVESTMENT');
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'userId'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'user_id'
      ) THEN
        ALTER TABLE "extra_entries" RENAME COLUMN "userId" TO "user_id";
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'createdAt'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'created_at'
      ) THEN
        ALTER TABLE "extra_entries" RENAME COLUMN "createdAt" TO "created_at";
      END IF;

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'updatedAt'
      ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE "extra_entries" RENAME COLUMN "updatedAt" TO "updated_at";
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "extra_entries" (
      "id" VARCHAR(191) NOT NULL,
      "title" VARCHAR(191) NOT NULL,
      "amount" NUMERIC(12,2) NOT NULL,
      "type" "EntryType" NOT NULL,
      "date" TIMESTAMP(3) NOT NULL,
      "notes" VARCHAR(500),
      "user_id" INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "extra_entries_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'extra_entries'
          AND column_name = 'type'
          AND udt_name <> 'EntryType'
      ) THEN
        ALTER TABLE "extra_entries"
        ALTER COLUMN "type" TYPE "EntryType"
        USING "type"::text::"EntryType";
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "extra_entries_user_id_idx"
    ON "extra_entries"("user_id");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "extra_entries_user_id_date_idx"
    ON "extra_entries"("user_id", "date");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'extra_entries_user_id_fkey'
          AND table_name = 'extra_entries'
      ) THEN
        ALTER TABLE "extra_entries"
        ADD CONSTRAINT "extra_entries_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

export const ensureExtraEntriesTable = async () => {
  if (!extraEntriesTablePromise) {
    extraEntriesTablePromise = ensureExtraEntriesTableInternal().catch(
      (error) => {
        extraEntriesTablePromise = null;
        throw error;
      },
    );
  }

  await extraEntriesTablePromise;
};

export const ensureSchemaCompatibility = async () => {
  if (!schemaCompatibilityPromise) {
    schemaCompatibilityPromise = (async () => {
      await ensureInvoiceDiscountMetadataColumnsInternal();
      await ensureExtraEntriesTable();
    })().catch((error) => {
      schemaCompatibilityPromise = null;
      throw error;
    });
  }

  await schemaCompatibilityPromise;
};
