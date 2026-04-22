ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "total_base" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_cgst" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_sgst" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "total_igst" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "grand_total" NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE "invoice_items"
  ADD COLUMN IF NOT EXISTS "gst_type" VARCHAR(32) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "base_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "gst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cgst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "sgst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "igst_amount" NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE "invoices"
SET
  "total_base" = COALESCE("subtotal", 0),
  "total_cgst" = CASE
    WHEN COALESCE("tax_mode", 'CGST_SGST') = 'CGST_SGST' THEN ROUND(COALESCE("tax", 0) / 2, 2)
    ELSE COALESCE("total_cgst", 0)
  END,
  "total_sgst" = CASE
    WHEN COALESCE("tax_mode", 'CGST_SGST') = 'CGST_SGST' THEN ROUND(COALESCE("tax", 0) - ROUND(COALESCE("tax", 0) / 2, 2), 2)
    ELSE COALESCE("total_sgst", 0)
  END,
  "total_igst" = CASE
    WHEN COALESCE("tax_mode", '') = 'IGST' THEN COALESCE("tax", 0)
    ELSE COALESCE("total_igst", 0)
  END,
  "grand_total" = COALESCE("total", 0);

UPDATE "invoice_items"
SET
  "base_amount" = COALESCE(quantity, 0) * COALESCE("unit_price", 0),
  "gst_amount" = GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0),
  "cgst_amount" = CASE
    WHEN COALESCE("gst_type", 'NONE') = 'CGST_SGST' THEN ROUND(GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0) / 2, 2)
    ELSE COALESCE("cgst_amount", 0)
  END,
  "sgst_amount" = CASE
    WHEN COALESCE("gst_type", 'NONE') = 'CGST_SGST' THEN ROUND(GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0) / 2, 2)
    ELSE COALESCE("sgst_amount", 0)
  END,
  "igst_amount" = CASE
    WHEN COALESCE("gst_type", 'NONE') = 'IGST' THEN GREATEST(COALESCE("line_total", 0) - (COALESCE(quantity, 0) * COALESCE("unit_price", 0)), 0)
    ELSE COALESCE("igst_amount", 0)
  END;
