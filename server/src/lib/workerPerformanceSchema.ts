import prisma from "../config/db.config.js";

let schemaEnsurePromise: Promise<void> | null = null;

const ensureWorkerPerformanceSchemaOnce = async () => {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "worker_profiles" (
      "worker_id" VARCHAR(191) PRIMARY KEY,
      "access_role" VARCHAR(32) NOT NULL DEFAULT 'STAFF',
      "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      "joining_date" TIMESTAMP(3),
      "incentive_type" VARCHAR(32) NOT NULL DEFAULT 'NONE',
      "incentive_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
      "last_active_at" TIMESTAMP(3),
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await prisma.$executeRaw`
    ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "worker_id" VARCHAR(191)
  `;

  await prisma.$executeRaw`
    ALTER TABLE "sales"
      ADD COLUMN IF NOT EXISTS "worker_id" VARCHAR(191)
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "worker_profiles_status_idx"
      ON "worker_profiles"("status")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "worker_profiles_access_role_idx"
      ON "worker_profiles"("access_role")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "invoices_worker_id_idx"
      ON "invoices"("worker_id")
  `;

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "sales_worker_id_idx"
      ON "sales"("worker_id")
  `;

  await prisma.$executeRaw`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'worker_profiles_worker_id_fkey'
      ) THEN
        ALTER TABLE "worker_profiles"
          ADD CONSTRAINT "worker_profiles_worker_id_fkey"
          FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'invoices_worker_id_fkey'
      ) THEN
        ALTER TABLE "invoices"
          ADD CONSTRAINT "invoices_worker_id_fkey"
          FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sales_worker_id_fkey'
      ) THEN
        ALTER TABLE "sales"
          ADD CONSTRAINT "sales_worker_id_fkey"
          FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$
  `;
};

export const ensureWorkerPerformanceSchema = async () => {
  schemaEnsurePromise ??= ensureWorkerPerformanceSchemaOnce().catch((error) => {
    schemaEnsurePromise = null;
    throw error;
  });

  return schemaEnsurePromise;
};
