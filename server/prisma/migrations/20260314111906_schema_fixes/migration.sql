/*
  Warnings:

  - A unique constraint covering the columns `[user_id,barcode]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `templates` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."products_barcode_key";

-- CreateIndex
CREATE UNIQUE INDEX "products_user_id_barcode_key" ON "products"("user_id", "barcode");

-- CreateIndex
CREATE INDEX "recurring_invoice_templates_is_active_next_run_date_idx" ON "recurring_invoice_templates"("is_active", "next_run_date");

-- CreateIndex
CREATE INDEX "sales_user_id_sale_date_idx" ON "sales"("user_id", "sale_date");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "templates"("name");
