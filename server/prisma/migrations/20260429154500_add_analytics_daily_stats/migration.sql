CREATE TABLE "analytics_daily_stats" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "booked_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "collected_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pending_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sale_count" INTEGER NOT NULL DEFAULT 0,
    "invoice_billed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "invoice_count" INTEGER NOT NULL DEFAULT 0,
    "invoice_collections" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "invoice_pending" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "booked_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cash_out_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pending_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "purchase_count" INTEGER NOT NULL DEFAULT 0,
    "expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extra_income" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extra_expense" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extra_loss" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "extra_investment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "customers_created" INTEGER NOT NULL DEFAULT 0,
    "suppliers_created" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_daily_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_daily_stats_user_id_date_key"
    ON "analytics_daily_stats"("user_id", "date");

CREATE INDEX "analytics_daily_stats_user_id_date_idx"
    ON "analytics_daily_stats"("user_id", "date");

CREATE INDEX "analytics_daily_stats_user_id_updated_at_idx"
    ON "analytics_daily_stats"("user_id", "updated_at");

ALTER TABLE "analytics_daily_stats"
    ADD CONSTRAINT "analytics_daily_stats_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
