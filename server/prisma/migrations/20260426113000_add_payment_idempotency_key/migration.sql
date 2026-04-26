ALTER TABLE "payments"
ADD COLUMN "payment_idempotency_key" VARCHAR(191);

CREATE UNIQUE INDEX "payments_user_id_payment_idempotency_key_key"
ON "payments"("user_id", "payment_idempotency_key");
