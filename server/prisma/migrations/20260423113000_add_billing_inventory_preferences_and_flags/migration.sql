ALTER TABLE "user_preferences"
ADD COLUMN "allow_negative_stock" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "invoice_items"
ADD COLUMN "non_inventory_item" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sale_items"
ADD COLUMN "non_inventory_item" BOOLEAN NOT NULL DEFAULT false;
