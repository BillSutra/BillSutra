CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx"
ON "notifications"("user_id", "is_read", "created_at");
