CREATE TABLE "export_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "actor_id" VARCHAR(191) NOT NULL,
    "resource" VARCHAR(64) NOT NULL,
    "format" VARCHAR(16) NOT NULL,
    "scope" VARCHAR(16) NOT NULL,
    "delivery" VARCHAR(16) NOT NULL DEFAULT 'download',
    "email" TEXT,
    "filters" JSONB,
    "selected_count" INTEGER NOT NULL DEFAULT 0,
    "exported_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "export_logs_user_id_created_at_idx" ON "export_logs"("user_id", "created_at");

ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
