ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "discount_type" VARCHAR(32) NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS "discount_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discount_calculated" NUMERIC(12,2) NOT NULL DEFAULT 0;

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
  END;
