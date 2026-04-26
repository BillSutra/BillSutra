ALTER TABLE "user_preferences"
ADD COLUMN "email_payment_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_payment_reminder_offsets" VARCHAR(64) NOT NULL DEFAULT '1,3,7',
ADD COLUMN "email_weekly_reports_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "email_low_stock_alerts_enabled" BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailDeliveryStatus') THEN
    CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;
END
$$;

CREATE TABLE "email_logs" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "email_logs_user_id_created_at_idx"
ON "email_logs"("user_id", "created_at");

CREATE INDEX "email_logs_invoice_id_type_created_at_idx"
ON "email_logs"("invoice_id", "type", "created_at");

CREATE INDEX "email_logs_customer_id_created_at_idx"
ON "email_logs"("customer_id", "created_at");

CREATE INDEX "email_logs_type_status_created_at_idx"
ON "email_logs"("type", "status", "created_at");

CREATE INDEX "email_logs_recipient_email_created_at_idx"
ON "email_logs"("recipient_email", "created_at");

ALTER TABLE "email_logs"
ADD CONSTRAINT "email_logs_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_logs"
ADD CONSTRAINT "email_logs_invoice_id_fkey"
FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "email_logs"
ADD CONSTRAINT "email_logs_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
