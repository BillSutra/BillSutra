-- Add warehouse reference on purchases
ALTER TABLE "purchases" ADD COLUMN "warehouse_id" INTEGER;

ALTER TABLE "purchases"
ADD CONSTRAINT "purchases_warehouse_id_fkey"
FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "purchases_warehouse_id_idx" ON "purchases"("warehouse_id");
