CREATE INDEX IF NOT EXISTS "suppliers_user_id_created_at_idx"
ON "suppliers" ("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "purchases_user_id_purchase_date_supplier_id_idx"
ON "purchases" ("user_id", "purchase_date", "supplier_id");

CREATE INDEX IF NOT EXISTS "sales_user_id_sale_date_customer_id_idx"
ON "sales" ("user_id", "sale_date", "customer_id");
