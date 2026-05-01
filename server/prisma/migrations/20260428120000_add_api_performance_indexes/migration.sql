CREATE INDEX IF NOT EXISTS "customers_user_id_created_at_idx"
ON "customers"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "categories_user_id_created_at_idx"
ON "categories"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "purchases_user_id_purchase_date_idx"
ON "purchases"("user_id", "purchase_date");

CREATE INDEX IF NOT EXISTS "sales_user_id_payment_date_idx"
ON "sales"("user_id", "payment_date");

CREATE INDEX IF NOT EXISTS "invoices_user_id_created_at_idx"
ON "invoices"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "invoices_user_id_issue_date_idx"
ON "invoices"("user_id", "issue_date");

CREATE INDEX IF NOT EXISTS "invoices_user_id_status_created_at_idx"
ON "invoices"("user_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "payments_user_id_paid_at_idx"
ON "payments"("user_id", "paid_at");
