-- Add structured customer profile fields with GST and credit metadata.
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "customer_type" VARCHAR(32) DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS "business_name" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "gstin" VARCHAR(15),
  ADD COLUMN IF NOT EXISTS "address_line1" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "state" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "pincode" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "notes" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(12, 2),
  ADD COLUMN IF NOT EXISTS "payment_terms" VARCHAR(32),
  ADD COLUMN IF NOT EXISTS "opening_balance" DECIMAL(12, 2) DEFAULT 0;

UPDATE "customers"
SET "customer_type" = 'individual'
WHERE "customer_type" IS NULL;

UPDATE "customers"
SET "opening_balance" = 0
WHERE "opening_balance" IS NULL;
