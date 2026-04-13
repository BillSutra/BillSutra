CREATE TYPE "AccessPaymentMethod" AS ENUM ('RAZORPAY', 'UPI');

CREATE TYPE "AccessPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUCCESS');

CREATE TABLE "access_payments" (
    "id" VARCHAR(191) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "plan_id" VARCHAR(32) NOT NULL DEFAULT 'pro',
    "billing_cycle" VARCHAR(16) NOT NULL DEFAULT 'monthly',
    "method" "AccessPaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "AccessPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "name" VARCHAR(191),
    "utr" VARCHAR(64),
    "screenshot_url" TEXT,
    "screenshot_path" TEXT,
    "provider" VARCHAR(120),
    "provider_payment_id" VARCHAR(191),
    "provider_order_id" VARCHAR(191),
    "provider_signature" VARCHAR(191),
    "provider_reference" VARCHAR(191),
    "metadata" JSONB,
    "reviewed_by_admin_id" VARCHAR(191),
    "reviewed_by_admin_email" VARCHAR(191),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_payments_utr_key" ON "access_payments"("utr");
CREATE UNIQUE INDEX "access_payments_provider_payment_id_key" ON "access_payments"("provider_payment_id");
CREATE UNIQUE INDEX "access_payments_provider_order_id_key" ON "access_payments"("provider_order_id");
CREATE INDEX "access_payments_user_id_created_at_idx" ON "access_payments"("user_id", "created_at");
CREATE INDEX "access_payments_status_method_created_at_idx" ON "access_payments"("status", "method", "created_at");
CREATE INDEX "access_payments_plan_id_billing_cycle_idx" ON "access_payments"("plan_id", "billing_cycle");

ALTER TABLE "access_payments"
ADD CONSTRAINT "access_payments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
