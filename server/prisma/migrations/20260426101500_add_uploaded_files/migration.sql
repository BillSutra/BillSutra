CREATE TABLE "uploaded_files" (
    "id" VARCHAR(191) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "file_name" VARCHAR(191) NOT NULL,
    "original_name" VARCHAR(191),
    "file_path" TEXT NOT NULL,
    "legacy_public_url" TEXT,
    "type" VARCHAR(64) NOT NULL,
    "mime_type" VARCHAR(191),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uploaded_files_file_path_key" ON "uploaded_files"("file_path");
CREATE INDEX "uploaded_files_user_id_created_at_idx" ON "uploaded_files"("user_id", "created_at");

ALTER TABLE "uploaded_files"
ADD CONSTRAINT "uploaded_files_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
