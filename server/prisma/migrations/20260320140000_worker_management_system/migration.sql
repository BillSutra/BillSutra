-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "WorkerRole" AS ENUM ('ADMIN', 'WORKER');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "businesses" (
    "id" VARCHAR(191) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "owner_id" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "workers" (
    "id" VARCHAR(191) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "password" VARCHAR(191) NOT NULL,
    "role" "WorkerRole" NOT NULL DEFAULT 'WORKER',
    "business_id" VARCHAR(191) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "businesses_owner_id_key" ON "businesses"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "workers_email_key" ON "workers"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "workers_business_id_idx" ON "workers"("business_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'workers_business_id_fkey'
    ) THEN
        ALTER TABLE "workers"
        ADD CONSTRAINT "workers_business_id_fkey"
        FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;
