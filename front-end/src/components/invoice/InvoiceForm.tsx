"use client";

import type { FormEvent } from "react";
import { ValidationField } from "@/components/ui/ValidationField";
import { validateDate, validateNumber } from "@/lib/validation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FirstTimeHint from "@/components/ui/FirstTimeHint";
import type { InvoiceFormState, TaxMode } from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

export type InvoiceFormProps = {
  form: InvoiceFormState;
  customers: Array<{ id: number; name: string; email?: string | null }>;
  warehouses: Array<{ id: number; name: string }>;
  taxMode: TaxMode;
  onFormChange: (next: InvoiceFormState) => void;
  onTaxModeChange: (mode: TaxMode) => void;
  onSubmit: (event: FormEvent) => void;
  isSubmitting?: boolean;
  summaryErrors: string[];
  serverError?: string | null;
  hideSubmit?: boolean;
};

const InvoiceForm = ({
  form,
  customers,
  warehouses,
  taxMode,
  onFormChange,
  onTaxModeChange,
  onSubmit,
  isSubmitting,
  summaryErrors,
  serverError,
  hideSubmit = false,
}: InvoiceFormProps) => {
  const { t } = useI18n();
  const validateRequiredDate = (value: string) =>
    validateDate(value) ? t("validation.validDate") : "";
  const validateOptionalNumber = (value: string) =>
    value && validateNumber(value) ? t("validation.validNumber") : "";

  return (
    <form
      className="no-print rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_22px_50px_-36px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.96)_100%)]"
      onSubmit={onSubmit}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Step 1
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Choose customer and basic bill details
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Start with the customer first. You can keep the default settings and review the full bill in Step 3.
          </p>
        </div>
        <div className="rounded-[1.4rem] border border-slate-200 bg-white/80 px-4 py-3 text-right shadow-sm dark:border-gray-700 dark:bg-gray-900/70">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            What happens next
          </p>
          <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
            Add products in Step 2
          </p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <FirstTimeHint
          id="invoice-customer-field"
          message="Pick the customer here first. It makes the rest of the bill easier."
          className="grid gap-2"
        >
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="customer"
          >
            {t("invoiceForm.customer")}
          </Label>
          <select
            id="customer"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            value={form.customer_id}
            onChange={(event) =>
              onFormChange({ ...form, customer_id: event.target.value })
            }
            aria-invalid={!form.customer_id}
            aria-describedby={!form.customer_id ? "customer-error" : undefined}
            required
          >
            <option value="">{t("invoiceForm.selectCustomer")}</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.email ? ` - ${customer.email}` : ""}
              </option>
            ))}
          </select>
          {!form.customer_id && (
            <span
              id="customer-error"
              className="text-xs text-destructive block"
              role="alert"
            >
              {t("invoiceForm.selectOptionError")}
            </span>
          )}
        </FirstTimeHint>
        <ValidationField
          id="invoice_date"
          label={t("invoiceForm.invoiceDate")}
          type="date"
          value={form.date}
          onChange={(value) => onFormChange({ ...form, date: value })}
          validate={validateRequiredDate}
          required
          success
        />
        <ValidationField
          id="due_date"
          label={t("invoiceForm.dueDate")}
          type="date"
          value={form.due_date}
          onChange={(value) => onFormChange({ ...form, due_date: value })}
          validate={validateRequiredDate}
          required
          success
        />
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="tax_mode"
          >
            {t("invoiceForm.gstMode")}
          </Label>
          <select
            id="tax_mode"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            value={taxMode}
            onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}
          >
            <option value="CGST_SGST">{t("invoiceForm.gstModeCgstSgst")}</option>
            <option value="IGST">{t("invoiceForm.gstModeIgst")}</option>
            <option value="NONE">{t("invoiceForm.gstModeNone")}</option>
          </select>
        </div>
        <ValidationField
          id="discount"
          label={
            form.discount_type === "PERCENTAGE"
              ? t("invoiceForm.discountPercentage")
              : t("invoiceForm.discountAmount")
          }
          type="number"
          value={form.discount}
          onChange={(value) => onFormChange({ ...form, discount: value })}
          validate={validateOptionalNumber}
          placeholder={t("invoiceForm.discountPlaceholder")}
          success
        />
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="discount_type"
          >
            {t("invoiceForm.discountType")}
          </Label>
          <select
            id="discount_type"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            value={form.discount_type}
            onChange={(event) =>
              onFormChange({
                ...form,
                discount_type: event.target.value as InvoiceFormState["discount_type"],
              })
            }
          >
            <option value="PERCENTAGE">{t("invoiceForm.discountTypePercentage")}</option>
            <option value="FIXED">{t("invoiceForm.discountTypeFixed")}</option>
          </select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <ValidationField
            id="notes"
            label={t("invoiceForm.notes")}
            value={form.notes}
            onChange={(value) => onFormChange({ ...form, notes: value })}
            validate={() => ""}
            success
          />
        </div>
        <div className="sm:col-span-2">
          <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
            <input
              id="sync_sales"
              type="checkbox"
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={form.sync_sales}
              onChange={(event) =>
                onFormChange({ ...form, sync_sales: event.target.checked })
              }
            />
            <div>
              <Label
                className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
                htmlFor="sync_sales"
              >
                {t("invoiceForm.syncSales")}
              </Label>
              <p className="mt-1 text-xs text-gray-500">
                {t("invoiceForm.syncSalesDescription")}
              </p>
            </div>
          </div>
        </div>
        {form.sync_sales && (
          <div className="grid gap-2 sm:col-span-2">
            <Label
              className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
              htmlFor="warehouse"
            >
              {t("invoiceForm.warehouse")}
            </Label>
            <select
              id="warehouse"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
              value={form.warehouse_id ?? ""}
              onChange={(event) =>
                onFormChange({ ...form, warehouse_id: event.target.value })
              }
              aria-invalid={!form.warehouse_id}
              aria-describedby={
                !form.warehouse_id ? "warehouse-error" : undefined
              }
              required
            >
              <option value="">{t("invoiceForm.selectWarehouse")}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {!form.warehouse_id && (
              <span
                id="warehouse-error"
                className="text-xs text-destructive block"
                role="alert"
              >
                {t("invoiceForm.selectOptionError")}
              </span>
            )}
          </div>
        )}
      </div>

      {summaryErrors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {summaryErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}

      {serverError && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-300">
          {serverError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
          {t("invoice.invoiceGeneratedAutomatically")}
        </div>
        {!hideSubmit ? (
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="h-11 rounded-xl px-5"
          >
            {t("invoice.createButton")}
          </Button>
        ) : (
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            Review and generate the bill in Step 3
          </div>
        )}
      </div>
    </form>
  );
};

export default InvoiceForm;
