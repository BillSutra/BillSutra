-- AlterTable
ALTER TABLE "workers"
ADD COLUMN IF NOT EXISTS "phone" VARCHAR(191);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workers_phone_key" ON "workers"("phone");
