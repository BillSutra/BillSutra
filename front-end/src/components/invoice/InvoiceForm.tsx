"use client";

import type { FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import FloatingInput from "@/components/ui/floating-input";
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
            Invoice details
          </p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Customer and dates
          </h2>
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900">
          Auto number
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.email ? `• ${customer.email}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="invoice_date"
          >
            Invoice date
          </Label>
          <Input
            id="invoice_date"
            type="date"
            value={form.date}
            onChange={(event) =>
              onFormChange({ ...form, date: event.target.value })
            }
            className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
          />
        </div>
        <div className="grid gap-2">
          <Label
            className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500"
            htmlFor="due_date"
          >
            Due date
          </Label>
          <Input
            id="due_date"
            type="date"
            value={form.due_date}
            onChange={(event) =>
              onFormChange({ ...form, due_date: event.target.value })
            }
            className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
          />
        </div>
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
        <FloatingInput
          id="discount"
          label="Discount (%)"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={form.discount}
          onChange={(value) => onFormChange({ ...form, discount: value })}
        />
        <div className="grid gap-2 sm:col-span-2">
          <FloatingInput
            id="notes"
            label="Notes"
            value={form.notes}
            onChange={(value) => onFormChange({ ...form, notes: value })}
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
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
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

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
          Invoice number is generated automatically.
        </div>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          Create invoice
        </Button>
      </div>
    </form>
  );
};

export default InvoiceForm;
