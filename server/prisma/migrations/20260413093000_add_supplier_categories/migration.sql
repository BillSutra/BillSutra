-- Add optional supplier category tags for smarter supplier grouping.
ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "suppliers"
SET "categories" = ARRAY[]::TEXT[]
WHERE "categories" IS NULL;
