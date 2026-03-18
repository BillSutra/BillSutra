"use client";

import type { FormEvent } from "react";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  validateDate,
  validateNumber,
} from "@/lib/validation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { InvoiceFormState, TaxMode } from "@/types/invoice";

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
}: InvoiceFormProps) => {
  return (
    <form
      className="no-print rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      onSubmit={onSubmit}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="customer"
          >
            Customer
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
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.email ? `• ${customer.email}` : ""}
              </option>
            ))}
          </select>
          {!form.customer_id && (
            <span
              id="customer-error"
              className="text-xs text-destructive block"
              role="alert"
            >
              Please select an option
            </span>
          )}
        </div>
        <ValidationField
          id="invoice_date"
          label="Invoice date"
          type="date"
          value={form.date}
          onChange={(value) => onFormChange({ ...form, date: value })}
          validate={validateDate}
          required
          success
        />
        <ValidationField
          id="due_date"
          label="Due date"
          type="date"
          value={form.due_date}
          onChange={(value) => onFormChange({ ...form, due_date: value })}
          validate={validateDate}
          required
          success
        />
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="tax_mode"
          >
            GST mode
          </Label>
          <select
            id="tax_mode"
            className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            value={taxMode}
            onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}
          >
            <option value="CGST_SGST">CGST + SGST</option>
            <option value="IGST">IGST</option>
            <option value="NONE">No GST</option>
          </select>
        </div>
        <ValidationField
          id="discount"
          label={
            form.discount_type === "PERCENTAGE"
              ? "Discount (%)"
              : "Discount amount"
          }
          type="number"
          value={form.discount}
          onChange={(value) => onFormChange({ ...form, discount: value })}
          validate={(value) => (value ? validateNumber(value) : "")}
          placeholder="0"
          success
        />
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="discount_type"
          >
            Discount type
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
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED">Fixed amount</option>
          </select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <ValidationField
            id="notes"
            label="Notes"
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
                Sync with sales and inventory
              </Label>
              <p className="mt-1 text-xs text-gray-500">
                Creates a sales record and deducts stock from inventory.
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
              Warehouse for stock sync
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
              <option value="">Select warehouse</option>
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
                Please select an option
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
          Invoice number is generated automatically.
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting}
          className="h-11 rounded-xl px-5"
        >
          Create invoice
        </Button>
      </div>
    </form>
  );
};

export default InvoiceForm;
