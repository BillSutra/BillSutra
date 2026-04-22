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

CREATE INDEX IF NOT EXISTS "extra_entries_user_id_idx"
ON "extra_entries"("user_id");

CREATE INDEX IF NOT EXISTS "extra_entries_user_id_date_idx"
ON "extra_entries"("user_id", "date");

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
