ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'OtpPurpose'
  ) THEN
    ALTER TYPE "OtpPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';
  END IF;
END $$;
