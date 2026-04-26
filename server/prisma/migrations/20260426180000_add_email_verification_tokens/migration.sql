CREATE TABLE "email_verification_tokens" (
    "id" VARCHAR(191) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "token_hash" VARCHAR(191) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key"
ON "email_verification_tokens"("token_hash");

CREATE INDEX "email_verification_tokens_user_id_expires_at_idx"
ON "email_verification_tokens"("user_id", "expires_at");

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
