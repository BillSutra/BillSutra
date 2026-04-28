ALTER TABLE "refresh_tokens"
ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(64),
ADD COLUMN IF NOT EXISTS "user_agent" VARCHAR(512),
ADD COLUMN IF NOT EXISTS "device_name" VARCHAR(191),
ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "revoked_reason" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_revoked_at_expires_at_idx"
ON "refresh_tokens"("user_id", "revoked_at", "expires_at");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" VARCHAR(191) NOT NULL,
  "user_id" INTEGER,
  "actor_id" VARCHAR(191) NOT NULL,
  "actor_type" VARCHAR(32) NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "resource_type" VARCHAR(64) NOT NULL,
  "resource_id" VARCHAR(191),
  "status" VARCHAR(32) NOT NULL DEFAULT 'success',
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "audit_logs_user_id_created_at_idx"
ON "audit_logs"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_resource_type_resource_id_created_at_idx"
ON "audit_logs"("resource_type", "resource_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_logs_action_created_at_idx"
ON "audit_logs"("action", "created_at");
