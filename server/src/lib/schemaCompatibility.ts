import prisma from "../config/db.config.js";

let extraEntriesTablePromise: Promise<void> | null = null;
let schemaCompatibilityPromise: Promise<void> | null = null;

const ensureInvoiceDiscountMetadataColumnsInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(32) NOT NULL DEFAULT 'FIXED',
      ADD COLUMN IF NOT EXISTS "discount_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "discount_calculated" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "tax_mode" VARCHAR(32) NOT NULL DEFAULT 'CGST_SGST',
      ADD COLUMN IF NOT EXISTS "total_base" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_cgst" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_sgst" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "total_igst" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "grand_total" NUMERIC(12,2) NOT NULL DEFAULT 0;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "gst_type" VARCHAR(32) NOT NULL DEFAULT 'NONE',
      ADD COLUMN IF NOT EXISTS "base_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "gst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "cgst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "sgst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "igst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0;
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
      END,
      "total_base" = CASE
        WHEN COALESCE("total_base", 0) = 0 THEN COALESCE("subtotal", 0)
        ELSE "total_base"
      END,
      "total_cgst" = CASE
        WHEN COALESCE("total_cgst", 0) = 0 AND COALESCE("tax_mode", 'CGST_SGST') = 'CGST_SGST'
          THEN ROUND(COALESCE("tax", 0) / 2, 2)
        ELSE COALESCE("total_cgst", 0)
      END,
      "total_sgst" = CASE
        WHEN COALESCE("total_sgst", 0) = 0 AND COALESCE("tax_mode", 'CGST_SGST') = 'CGST_SGST'
          THEN ROUND(COALESCE("tax", 0) - ROUND(COALESCE("tax", 0) / 2, 2), 2)
        ELSE COALESCE("total_sgst", 0)
      END,
      "total_igst" = CASE
        WHEN COALESCE("total_igst", 0) = 0 AND COALESCE("tax_mode", '') = 'IGST'
          THEN COALESCE("tax", 0)
        ELSE COALESCE("total_igst", 0)
      END,
      "grand_total" = CASE
        WHEN COALESCE("grand_total", 0) = 0 THEN COALESCE("total", 0)
        ELSE "grand_total"
      END;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "invoice_items"
    SET
      "gst_type" = COALESCE(NULLIF("gst_type", ''), 'NONE'),
      "base_amount" = CASE
        WHEN COALESCE("base_amount", 0) = 0 THEN COALESCE(quantity, 0) * COALESCE("unit_price", 0)
        ELSE "base_amount"
      END,
      "gst_amount" = CASE
        WHEN COALESCE("gst_amount", 0) = 0 THEN GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0)
        ELSE "gst_amount"
      END,
      "cgst_amount" = CASE
        WHEN COALESCE("cgst_amount", 0) = 0 AND COALESCE("gst_type", 'NONE') = 'CGST_SGST'
          THEN ROUND(GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0) / 2, 2)
        ELSE COALESCE("cgst_amount", 0)
      END,
      "sgst_amount" = CASE
        WHEN COALESCE("sgst_amount", 0) = 0 AND COALESCE("gst_type", 'NONE') = 'CGST_SGST'
          THEN ROUND(GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0) / 2, 2)
        ELSE COALESCE("sgst_amount", 0)
      END,
      "igst_amount" = CASE
        WHEN COALESCE("igst_amount", 0) = 0 AND COALESCE("gst_type", 'NONE') = 'IGST'
          THEN GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0)
        ELSE COALESCE("igst_amount", 0)
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
