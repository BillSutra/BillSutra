/*
  Warnings:

  - A unique constraint covering the columns `[user_id,invoice_number]` on the table `invoices` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `invoice_number` to the `invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "invoice_number" VARCHAR(32) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_user_id_invoice_number_key" ON "invoices"("user_id", "invoice_number");
