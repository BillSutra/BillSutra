CREATE INDEX "products_user_id_name_idx" ON "products"("user_id", "name");

CREATE INDEX "products_user_id_category_id_idx" ON "products"("user_id", "category_id");
