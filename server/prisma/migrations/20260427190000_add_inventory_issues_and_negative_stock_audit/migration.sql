ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "last_auto_corrected_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'InventoryIssueType'
  ) THEN
    CREATE TYPE "InventoryIssueType" AS ENUM (
      'NEGATIVE_AFTER_SALE',
      'NEGATIVE_BEFORE_PURCHASE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "inventory_issues" (
  "id" SERIAL NOT NULL,
  "product_id" INTEGER NOT NULL,
  "type" "InventoryIssueType" NOT NULL,
  "quantity" INTEGER NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "inventory_issues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_issues_product_id_resolved_type_idx"
ON "inventory_issues"("product_id", "resolved", "type");

CREATE INDEX IF NOT EXISTS "inventory_issues_resolved_created_at_idx"
ON "inventory_issues"("resolved", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'inventory_issues_product_id_fkey'
      AND table_name = 'inventory_issues'
  ) THEN
    ALTER TABLE "inventory_issues"
    ADD CONSTRAINT "inventory_issues_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
