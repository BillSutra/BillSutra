-- Create enums for subscription lifecycle
CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO', 'PRO_PLUS');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- Create subscription state table (one row per user)
CREATE TABLE "subscriptions" (
  "id" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "plan_id" "SubscriptionPlan" NOT NULL DEFAULT 'FREE',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "billing_cycle" "SubscriptionBillingCycle",
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trial_starts_at" TIMESTAMP(3),
  "trial_ends_at" TIMESTAMP(3),
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "latest_payment_id" VARCHAR(191),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE INDEX "subscriptions_plan_id_status_idx" ON "subscriptions"("plan_id", "status");

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Create monthly usage counters keyed by billing period
CREATE TABLE "subscription_usage" (
  "id" SERIAL NOT NULL,
  "subscription_id" VARCHAR(191) NOT NULL,
  "user_id" INTEGER NOT NULL,
  "period_key" VARCHAR(16) NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "invoices_created" INTEGER NOT NULL DEFAULT 0,
  "products_created" INTEGER NOT NULL DEFAULT 0,
  "customers_created" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_usage_subscription_id_period_key_key"
  ON "subscription_usage"("subscription_id", "period_key");
CREATE INDEX "subscription_usage_user_id_period_start_idx"
  ON "subscription_usage"("user_id", "period_start");

ALTER TABLE "subscription_usage"
  ADD CONSTRAINT "subscription_usage_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subscription_usage"
  ADD CONSTRAINT "subscription_usage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill an active FREE subscription for existing users
INSERT INTO "subscriptions" (
  "id",
  "user_id",
  "plan_id",
  "status",
  "started_at",
  "current_period_start",
  "created_at",
  "updated_at"
)
SELECT
  md5(random()::text || clock_timestamp()::text || u."id"::text),
  u."id",
  'FREE'::"SubscriptionPlan",
  'ACTIVE'::"SubscriptionStatus",
  CURRENT_TIMESTAMP,
  date_trunc('month', CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1
  FROM "subscriptions" s
  WHERE s."user_id" = u."id"
);
