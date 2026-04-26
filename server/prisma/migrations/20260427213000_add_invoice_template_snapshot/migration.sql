ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "template_snapshot" JSONB;
