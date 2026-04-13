-- Add structured business address fields while keeping legacy address column.
ALTER TABLE "business_profiles"
  ADD COLUMN IF NOT EXISTS "address_line1" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "city" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "state" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "pincode" VARCHAR(10);
