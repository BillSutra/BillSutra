-- Add token revocation versioning on users
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "session_version" INTEGER NOT NULL DEFAULT 0;

-- Persist control-center settings per user
CREATE TABLE IF NOT EXISTS "user_preferences" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL UNIQUE,
  "language" VARCHAR(10) NOT NULL DEFAULT 'en',
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "date_format" VARCHAR(32) NOT NULL DEFAULT 'DD/MM/YYYY',
  "notification_payment_reminders" BOOLEAN NOT NULL DEFAULT true,
  "notification_low_stock_alerts" BOOLEAN NOT NULL DEFAULT true,
  "notification_due_invoice_alerts" BOOLEAN NOT NULL DEFAULT true,
  "backup_auto_enabled" BOOLEAN NOT NULL DEFAULT false,
  "branding_template_id" INTEGER,
  "branding_theme_color" VARCHAR(16),
  "branding_terms" TEXT,
  "branding_signature" VARCHAR(191),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_preferences_language_idx"
  ON "user_preferences"("language");
