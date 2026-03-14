-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PARTIALLY_PAID', 'UNPAID');

-- AlterTable purchases
ALTER TABLE "purchases"
ADD COLUMN "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "pending_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "payment_date" TIMESTAMP(3),
ADD COLUMN "payment_method" "PaymentMethod";

-- AlterTable sales
ALTER TABLE "sales"
ADD COLUMN "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "pending_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "payment_date" TIMESTAMP(3),
ADD COLUMN "payment_method" "PaymentMethod";

-- Backfill purchases from existing totals
UPDATE "purchases"
SET "total_amount" = COALESCE("total", 0),
    "paid_amount" = 0,
    "pending_amount" = COALESCE("total", 0),
    "payment_status" = CASE
      WHEN COALESCE("total", 0) = 0 THEN 'PAID'::"PaymentStatus"
      ELSE 'UNPAID'::"PaymentStatus"
    END;

-- Backfill sales from existing totals
UPDATE "sales"
SET "total_amount" = COALESCE("total", 0),
    "paid_amount" = 0,
    "pending_amount" = COALESCE("total", 0),
    "payment_status" = CASE
      WHEN COALESCE("total", 0) = 0 THEN 'PAID'::"PaymentStatus"
      ELSE 'UNPAID'::"PaymentStatus"
    END;

-- Helpful indexes for dashboard aggregations
CREATE INDEX "purchases_payment_status_idx" ON "purchases"("payment_status");
CREATE INDEX "sales_payment_status_idx" ON "sales"("payment_status");
