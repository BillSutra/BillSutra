CREATE TYPE "NotificationType" AS ENUM (
    'PAYMENT',
    'INVENTORY',
    'CUSTOMER',
    'SUBSCRIPTION',
    'WORKER'
);

CREATE TABLE "notifications" (
    "id" VARCHAR(191) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "business_id" VARCHAR(191) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "reference_key" VARCHAR(191),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_business_id_created_at_idx" ON "notifications"("business_id", "created_at");
CREATE UNIQUE INDEX "notifications_business_id_reference_key_key" ON "notifications"("business_id", "reference_key");

ALTER TABLE "notifications"
ADD CONSTRAINT "notifications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
