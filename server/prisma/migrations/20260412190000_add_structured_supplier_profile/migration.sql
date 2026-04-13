-- Add structured supplier profile fields for GST-ready supplier management.
ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "business_name" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "gstin" VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "pan" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "address_line1" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "state" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "pincode" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "opening_balance" DECIMAL(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "notes" VARCHAR(500);

UPDATE "suppliers"
SET "opening_balance" = 0
WHERE "opening_balance" IS NULL;
