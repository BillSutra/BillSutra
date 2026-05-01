ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "title" VARCHAR(191),
  ADD COLUMN IF NOT EXISTS "action_url" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "priority" VARCHAR(16) NOT NULL DEFAULT 'info';

UPDATE "notifications"
SET "priority" = COALESCE(NULLIF("priority", ''), 'info');

CREATE INDEX IF NOT EXISTS "notifications_user_id_priority_created_at_idx"
ON "notifications"("user_id", "priority", "created_at");
