CREATE TABLE IF NOT EXISTS "financial_goals" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "title" VARCHAR(191) NOT NULL,
  "emoji" VARCHAR(32),
  "target_amount" DECIMAL(12,2) NOT NULL,
  "current_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "monthly_contribution_target" DECIMAL(12,2),
  "target_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "financial_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_goals_user_id_idx"
ON "financial_goals"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_goals_user_id_fkey'
      AND table_name = 'financial_goals'
  ) THEN
    ALTER TABLE "financial_goals"
    ADD CONSTRAINT "financial_goals_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
