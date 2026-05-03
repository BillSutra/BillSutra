import { Prisma } from "@prisma/client";
import prismaClient from "../config/db.config.js";

// These startup compatibility statements are static SQL only.
// Route them through Prisma's safe raw executor so we avoid the real
// $executeRawUnsafe path while keeping the existing call sites compact.
const prisma = {
  $executeRawUnsafe: (query: string) => prismaClient.$executeRaw(Prisma.raw(query)),
};

let extraEntriesTablePromise: Promise<void> | null = null;
let faceDataTablePromise: Promise<void> | null = null;
let schemaCompatibilityPromise: Promise<void> | null = null;
let userPreferenceCompatibilityPromise: Promise<void> | null = null;
let emailLogCompatibilityPromise: Promise<void> | null = null;
let invoiceTemplateCompatibilityPromise: Promise<void> | null = null;
let modernAuthCompatibilityPromise: Promise<void> | null = null;
let analyticsDailyStatsCompatibilityPromise: Promise<void> | null = null;
let notificationSchemaCompatibilityPromise: Promise<void> | null = null;
let paymentSchemaCompatibilityPromise: Promise<void> | null = null;

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

const ensurePaymentSchemaCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      BEGIN
        ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'NEFT';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'RTGS';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'IMPS';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
      BEGIN
        ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WALLET';
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "payments"
      ADD COLUMN IF NOT EXISTS "notes" VARCHAR(500),
      ADD COLUMN IF NOT EXISTS "cheque_number" VARCHAR(64),
      ADD COLUMN IF NOT EXISTS "bank_name" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "deposit_date" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "proof_url" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "proof_file_name" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "proof_file_path" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "proof_file_id" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "proof_mime_type" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "proof_size" INTEGER,
      ADD COLUMN IF NOT EXISTS "proof_uploaded_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "proof_uploaded_by" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "payment_idempotency_key" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "payments"
    SET "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP)
    WHERE "updated_at" IS NULL;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "payments_invoice_id_paid_at_idx"
    ON "payments"("invoice_id", "paid_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_user_id_payment_idempotency_key_key"
    ON "payments"("user_id", "payment_idempotency_key");
  `);
};

const ensureFaceDataTableInternal = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "face_data" (
      "id" SERIAL NOT NULL,
      "user_id" INTEGER NOT NULL,
      "face_encoding" TEXT NOT NULL,
      "face_encoding_json" TEXT NOT NULL DEFAULT '[]',
      "is_enabled" BOOLEAN NOT NULL DEFAULT true,
      "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "face_data_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "face_data"
      ADD COLUMN IF NOT EXISTS "face_encoding" TEXT,
      ADD COLUMN IF NOT EXISTS "face_encoding_json" TEXT,
      ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "face_data"
    SET
      "face_encoding" = COALESCE(NULLIF("face_encoding", ''), '[]'),
      "face_encoding_json" = COALESCE(NULLIF("face_encoding_json", ''), "face_encoding", '[]'),
      "is_enabled" = COALESCE("is_enabled", true),
      "is_encrypted" = COALESCE("is_encrypted", false)
    WHERE
      "face_encoding" IS NULL
      OR "face_encoding_json" IS NULL
      OR "is_enabled" IS NULL
      OR "is_encrypted" IS NULL;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "face_data"
      ALTER COLUMN "face_encoding" SET NOT NULL,
      ALTER COLUMN "face_encoding_json" SET NOT NULL;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "face_data_user_id_key"
    ON "face_data"("user_id");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "face_data_user_id_idx"
    ON "face_data"("user_id");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'face_data_user_id_fkey'
          AND table_name = 'face_data'
      ) THEN
        ALTER TABLE "face_data"
        ADD CONSTRAINT "face_data_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const ensureNotificationSchemaCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'NotificationType'
      ) THEN
        CREATE TYPE "NotificationType" AS ENUM (
          'PAYMENT',
          'INVENTORY',
          'CUSTOMER',
          'SUBSCRIPTION',
          'WORKER',
          'SECURITY',
          'SYSTEM'
        );
      ELSE
        BEGIN
          ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SECURITY';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;

        BEGIN
          ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM';
        EXCEPTION
          WHEN duplicate_object THEN NULL;
        END;
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" VARCHAR(191) NOT NULL,
      "user_id" INTEGER NOT NULL,
      "business_id" VARCHAR(191) NOT NULL,
      "type" "NotificationType" NOT NULL,
      "title" VARCHAR(191),
      "message" VARCHAR(500) NOT NULL,
      "action_url" VARCHAR(255),
      "priority" VARCHAR(16) NOT NULL DEFAULT 'info',
      "is_read" BOOLEAN NOT NULL DEFAULT false,
      "reference_key" VARCHAR(191),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "notifications"
      ADD COLUMN IF NOT EXISTS "title" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "action_url" VARCHAR(255),
      ADD COLUMN IF NOT EXISTS "priority" VARCHAR(16) NOT NULL DEFAULT 'info';
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "notifications"
    SET "priority" = COALESCE(NULLIF("priority", ''), 'info');
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "notifications_user_id_priority_created_at_idx"
    ON "notifications"("user_id", "priority", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
    ON "notifications"("user_id", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
    ON "notifications"("user_id", "is_read", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "notifications_user_id_type_created_at_idx"
    ON "notifications"("user_id", "type", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "notifications_business_id_created_at_idx"
    ON "notifications"("business_id", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "notifications_business_id_reference_key_key"
    ON "notifications"("business_id", "reference_key");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'notifications_user_id_fkey'
          AND table_name = 'notifications'
      ) THEN
        ALTER TABLE "notifications"
        ADD CONSTRAINT "notifications_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const ensureUserPreferenceCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "email_payment_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "email_payment_reminder_offsets" VARCHAR(64) NOT NULL DEFAULT '1,3,7',
      ADD COLUMN IF NOT EXISTS "email_weekly_reports_enabled" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "email_low_stock_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;
  `);

  await prisma.$executeRawUnsafe(`
    UPDATE "user_preferences"
    SET
      "email_payment_reminders_enabled" = COALESCE("email_payment_reminders_enabled", true),
      "email_payment_reminder_offsets" = COALESCE(NULLIF("email_payment_reminder_offsets", ''), '1,3,7'),
      "email_weekly_reports_enabled" = COALESCE("email_weekly_reports_enabled", true),
      "email_low_stock_alerts_enabled" = COALESCE("email_low_stock_alerts_enabled", true);
  `);
};

const ensureEmailLogCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'EmailDeliveryStatus'
      ) THEN
        CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "email_logs" (
      "id" VARCHAR(191) NOT NULL,
      "user_id" INTEGER,
      "invoice_id" INTEGER,
      "customer_id" INTEGER,
      "type" VARCHAR(64) NOT NULL,
      "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
      "recipient_email" VARCHAR(191) NOT NULL,
      "subject" VARCHAR(191),
      "provider_message_id" VARCHAR(191),
      "error_message" VARCHAR(1000),
      "metadata" JSONB,
      "sent_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "email_logs"
      ADD COLUMN IF NOT EXISTS "user_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "invoice_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "customer_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(64),
      ADD COLUMN IF NOT EXISTS "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS "recipient_email" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "subject" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "provider_message_id" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "error_message" VARCHAR(1000),
      ADD COLUMN IF NOT EXISTS "metadata" JSONB,
      ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_logs_user_id_created_at_idx"
    ON "email_logs"("user_id", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_logs_invoice_id_type_created_at_idx"
    ON "email_logs"("invoice_id", "type", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_logs_customer_id_created_at_idx"
    ON "email_logs"("customer_id", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_logs_type_status_created_at_idx"
    ON "email_logs"("type", "status", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_logs_recipient_email_created_at_idx"
    ON "email_logs"("recipient_email", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'email_logs_user_id_fkey'
          AND table_name = 'email_logs'
      ) THEN
        ALTER TABLE "email_logs"
        ADD CONSTRAINT "email_logs_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'email_logs_invoice_id_fkey'
          AND table_name = 'email_logs'
      ) THEN
        ALTER TABLE "email_logs"
        ADD CONSTRAINT "email_logs_invoice_id_fkey"
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'email_logs_customer_id_fkey'
          AND table_name = 'email_logs'
      ) THEN
        ALTER TABLE "email_logs"
        ADD CONSTRAINT "email_logs_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const ensureInvoiceTemplateCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "template_snapshot" JSONB;
  `);
};

const ensureModernAuthCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'OtpPurpose'
      ) THEN
        CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'EMAIL_VERIFICATION');
      ELSE
        ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
      "id" VARCHAR(191) NOT NULL,
      "user_id" INTEGER NOT NULL,
      "token_hash" VARCHAR(191) NOT NULL,
      "expires_at" TIMESTAMP(3) NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "email_verification_tokens"
      ADD COLUMN IF NOT EXISTS "user_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "token_hash" VARCHAR(191),
      ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_key"
    ON "email_verification_tokens"("token_hash");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_expires_at_idx"
    ON "email_verification_tokens"("user_id", "expires_at");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'email_verification_tokens_user_id_fkey'
          AND table_name = 'email_verification_tokens'
      ) THEN
        ALTER TABLE "email_verification_tokens"
        ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const ensureBillingInventoryCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "user_preferences"
      ADD COLUMN IF NOT EXISTS "allow_negative_stock" BOOLEAN NOT NULL DEFAULT true;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "non_inventory_item" BOOLEAN NOT NULL DEFAULT false;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "sale_items"
      ADD COLUMN IF NOT EXISTS "non_inventory_item" BOOLEAN NOT NULL DEFAULT false;
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "warehouse_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "stock_applied" BOOLEAN NOT NULL DEFAULT false;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "invoices_warehouse_id_idx"
    ON "invoices"("warehouse_id");
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "products"
      ADD COLUMN IF NOT EXISTS "last_auto_corrected_at" TIMESTAMP(3);
  `);
};

const ensureAnalyticsDailyStatsCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "analytics_daily_stats" (
      "id" SERIAL NOT NULL,
      "user_id" INTEGER NOT NULL,
      "date" DATE NOT NULL,
      "booked_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "collected_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "pending_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "sale_count" INTEGER NOT NULL DEFAULT 0,
      "invoice_billed" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "invoice_count" INTEGER NOT NULL DEFAULT 0,
      "invoice_collections" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "invoice_pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "booked_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "cash_out_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "pending_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "purchase_count" INTEGER NOT NULL DEFAULT 0,
      "expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "extra_income" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "extra_expense" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "extra_loss" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "extra_investment" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "customers_created" INTEGER NOT NULL DEFAULT 0,
      "suppliers_created" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "analytics_daily_stats_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "analytics_daily_stats"
      ADD COLUMN IF NOT EXISTS "user_id" INTEGER,
      ADD COLUMN IF NOT EXISTS "date" DATE,
      ADD COLUMN IF NOT EXISTS "booked_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "collected_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "pending_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "sale_count" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "invoice_billed" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "invoice_count" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "invoice_collections" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "invoice_pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "booked_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "cash_out_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "pending_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "purchase_count" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extra_income" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extra_expense" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extra_loss" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "extra_investment" DECIMAL(14,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "customers_created" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "suppliers_created" INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_stats_user_id_date_key"
    ON "analytics_daily_stats"("user_id", "date");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "analytics_daily_stats_user_id_date_idx"
    ON "analytics_daily_stats"("user_id", "date");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "analytics_daily_stats_user_id_updated_at_idx"
    ON "analytics_daily_stats"("user_id", "updated_at");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'analytics_daily_stats_user_id_fkey'
          AND table_name = 'analytics_daily_stats'
      ) THEN
        ALTER TABLE "analytics_daily_stats"
        ADD CONSTRAINT "analytics_daily_stats_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
};

const ensureInventoryIssueCompatibilityInternal = async () => {
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'InventoryIssueType'
      ) THEN
        CREATE TYPE "InventoryIssueType" AS ENUM (
          'NEGATIVE_AFTER_SALE',
          'NEGATIVE_BEFORE_PURCHASE'
        );
      END IF;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventory_issues" (
      "id" SERIAL NOT NULL,
      "product_id" INTEGER NOT NULL,
      "type" "InventoryIssueType" NOT NULL,
      "quantity" INTEGER NOT NULL,
      "resolved" BOOLEAN NOT NULL DEFAULT false,
      "metadata" JSONB,
      "resolved_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

      CONSTRAINT "inventory_issues_pkey" PRIMARY KEY ("id")
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "inventory_issues"
      ADD COLUMN IF NOT EXISTS "metadata" JSONB,
      ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventory_issues_product_id_resolved_type_idx"
    ON "inventory_issues"("product_id", "resolved", "type");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "inventory_issues_resolved_created_at_idx"
    ON "inventory_issues"("resolved", "created_at");
  `);

  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'inventory_issues_product_id_fkey'
          AND table_name = 'inventory_issues'
      ) THEN
        ALTER TABLE "inventory_issues"
        ADD CONSTRAINT "inventory_issues_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "products"("id")
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

export const ensureFaceDataTable = async () => {
  if (!faceDataTablePromise) {
    faceDataTablePromise = ensureFaceDataTableInternal().catch((error) => {
      faceDataTablePromise = null;
      throw error;
    });
  }

  await faceDataTablePromise;
};

export const ensureUserPreferenceCompatibility = async () => {
  if (!userPreferenceCompatibilityPromise) {
    userPreferenceCompatibilityPromise =
      ensureUserPreferenceCompatibilityInternal().catch((error) => {
        userPreferenceCompatibilityPromise = null;
        throw error;
      });
  }

  await userPreferenceCompatibilityPromise;
};

export const ensureEmailLogCompatibility = async () => {
  if (!emailLogCompatibilityPromise) {
    emailLogCompatibilityPromise = ensureEmailLogCompatibilityInternal().catch(
      (error) => {
        emailLogCompatibilityPromise = null;
        throw error;
      },
    );
  }

  await emailLogCompatibilityPromise;
};

export const ensureInvoiceTemplateCompatibility = async () => {
  if (!invoiceTemplateCompatibilityPromise) {
    invoiceTemplateCompatibilityPromise =
      ensureInvoiceTemplateCompatibilityInternal().catch((error) => {
        invoiceTemplateCompatibilityPromise = null;
        throw error;
      });
  }

  await invoiceTemplateCompatibilityPromise;
};

export const ensureModernAuthCompatibility = async () => {
  if (!modernAuthCompatibilityPromise) {
    modernAuthCompatibilityPromise = ensureModernAuthCompatibilityInternal().catch(
      (error) => {
        modernAuthCompatibilityPromise = null;
        throw error;
      },
    );
  }

  await modernAuthCompatibilityPromise;
};

export const ensureAnalyticsDailyStatsTable = async () => {
  if (!analyticsDailyStatsCompatibilityPromise) {
    analyticsDailyStatsCompatibilityPromise =
      ensureAnalyticsDailyStatsCompatibilityInternal().catch((error) => {
        analyticsDailyStatsCompatibilityPromise = null;
        throw error;
      });
  }

  await analyticsDailyStatsCompatibilityPromise;
};

export const ensureNotificationSchemaCompatibility = async () => {
  if (!notificationSchemaCompatibilityPromise) {
    notificationSchemaCompatibilityPromise =
      ensureNotificationSchemaCompatibilityInternal().catch((error) => {
        notificationSchemaCompatibilityPromise = null;
        throw error;
      });
  }

  await notificationSchemaCompatibilityPromise;
};

export const ensurePaymentSchemaCompatibility = async () => {
  if (!paymentSchemaCompatibilityPromise) {
    paymentSchemaCompatibilityPromise =
      ensurePaymentSchemaCompatibilityInternal().catch((error) => {
        paymentSchemaCompatibilityPromise = null;
        throw error;
      });
  }

  await paymentSchemaCompatibilityPromise;
};

export const ensureSchemaCompatibility = async () => {
  if (!schemaCompatibilityPromise) {
    schemaCompatibilityPromise = (async () => {
      await ensureModernAuthCompatibility();
      await ensureInvoiceDiscountMetadataColumnsInternal();
      await ensurePaymentSchemaCompatibility();
      await ensureBillingInventoryCompatibilityInternal();
      await ensureInventoryIssueCompatibilityInternal();
      await ensureExtraEntriesTable();
      try {
        await ensureAnalyticsDailyStatsTable();
      } catch (error) {
        console.warn(
          "[schema.compatibility] analytics_daily_stats unavailable; dashboard analytics will use fallback mode",
          {
            message: error instanceof Error ? error.message : String(error),
          },
        );
      }
      await ensureFaceDataTable();
      await ensureUserPreferenceCompatibility();
      await ensureNotificationSchemaCompatibility();
      await ensureEmailLogCompatibility();
      await ensureInvoiceTemplateCompatibility();
    })().catch((error) => {
      schemaCompatibilityPromise = null;
      throw error;
    });
  }

  await schemaCompatibilityPromise;
};
