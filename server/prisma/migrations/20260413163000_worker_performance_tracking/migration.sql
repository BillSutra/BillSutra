-- Worker profile table for role, status, joining date, and incentive configuration.
CREATE TABLE IF NOT EXISTS "worker_profiles" (
  "worker_id" VARCHAR(191) PRIMARY KEY,
  "access_role" VARCHAR(32) NOT NULL DEFAULT 'STAFF',
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "joining_date" TIMESTAMP(3),
  "incentive_type" VARCHAR(32) NOT NULL DEFAULT 'NONE',
  "incentive_value" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "last_active_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_profiles_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "worker_id" VARCHAR(191);

ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "worker_id" VARCHAR(191);

CREATE INDEX IF NOT EXISTS "worker_profiles_status_idx" ON "worker_profiles"("status");
CREATE INDEX IF NOT EXISTS "worker_profiles_access_role_idx" ON "worker_profiles"("access_role");
CREATE INDEX IF NOT EXISTS "invoices_worker_id_idx" ON "invoices"("worker_id");
CREATE INDEX IF NOT EXISTS "sales_worker_id_idx" ON "sales"("worker_id");

DO $$
BEGIN
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
END $$;
