ALTER TABLE "invoices"
ADD COLUMN "warehouse_id" INTEGER,
ADD COLUMN "stock_applied" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "invoices_warehouse_id_idx" ON "invoices"("warehouse_id");
