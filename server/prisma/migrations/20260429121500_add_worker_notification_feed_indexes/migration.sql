CREATE INDEX IF NOT EXISTS "workers_business_id_created_at_idx"
ON "workers"("business_id", "created_at");

CREATE INDEX IF NOT EXISTS "notifications_user_id_type_created_at_idx"
ON "notifications"("user_id", "type", "created_at");
