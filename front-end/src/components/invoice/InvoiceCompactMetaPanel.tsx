"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Plus, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InvoiceFormState, TaxMode } from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

type InvoiceCompactMetaPanelProps = {
  form: InvoiceFormState;
  customers: Array<{ id: number; name: string; email?: string | null }>;
  warehouses: Array<{ id: number; name: string }>;
  businessSummary?: {
    businessName: string;
    taxId?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  invoiceNumberPreview: string;
  subtotalAmount: number;
  totalAmount: number;
  taxMode: TaxMode;
  discountAppliedAmount: number;
  discountError?: string | null;
  summaryErrors: string[];
  serverError?: string | null;
  onFormChange: (next: InvoiceFormState) => void;
  onTaxModeChange: (mode: TaxMode) => void;
  onQuickAddCustomer?: () => void;
};

const inputClassName =
  "h-10 rounded-xl border-slate-200 bg-white text-sm shadow-sm focus-visible:border-primary/35 focus-visible:ring-primary/10 dark:border-slate-700 dark:bg-slate-950";

const selectClassName =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary/35 dark:focus:ring-primary/20";

const textareaClassName =
  "min-h-[92px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-primary/35 dark:focus:ring-primary/20";

const InvoiceCompactMetaPanel = ({
  form,
  customers,
  warehouses,
  businessSummary,
  invoiceNumberPreview,
  subtotalAmount,
  totalAmount,
  taxMode,
  discountAppliedAmount,
  discountError,
  summaryErrors,
  serverError,
  onFormChange,
  onTaxModeChange,
  onQuickAddCustomer,
}: InvoiceCompactMetaPanelProps) => {
  const { formatCurrency, t } = useI18n();
  const [customerQuery, setCustomerQuery] = useState("");

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) {
      return customers;
    }

    return customers.filter((customer) => {
      const haystack = [customer.name, customer.email ?? ""].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [customerQuery, customers]);

  const showAdvancedDefaults =
    Boolean(form.discount && Number(form.discount) > 0) ||
    form.discount_type === "FIXED" ||
    taxMode !== "CGST_SGST" ||
    Boolean(form.notes) ||
    Boolean(form.warehouse_id) ||
    form.payment_status !== "UNPAID";
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (showAdvancedDefaults) {
      setAdvancedOpen(true);
    }
  }, [showAdvancedDefaults]);

  const paidAmount =
    form.payment_status === "PAID"
      ? totalAmount
      : form.payment_status === "PARTIALLY_PAID"
        ? Math.min(Math.max(Number(form.amount_paid || 0), 0), totalAmount)
        : 0;
  const balanceAmount = Math.max(totalAmount - paidAmount, 0);
  const isDiscountDisabled = subtotalAmount <= 0;

  return (
    <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.92)_100%)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Billing setup
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
            Customer and bill meta
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Keep the left side minimal. Open Advanced only when needed.
          </p>
        </div>
        <div className="rounded-[1rem] border border-slate-200 bg-white/90 px-3 py-2 text-right shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Invoice no.
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
            {invoiceNumberPreview}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label
              className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
              htmlFor="invoice-customer-search"
            >
              {t("invoiceForm.customer")}
            </Label>
            {onQuickAddCustomer ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3"
                onClick={onQuickAddCustomer}
              >
                <Plus size={14} />
                Quick add
              </Button>
            ) : null}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="invoice-customer-search"
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
              placeholder="Search customer"
              className={`pl-9 ${inputClassName}`}
            />
          </div>
          <select
            id="customer"
            className={selectClassName}
            value={form.customer_id}
            onChange={(event) =>
              onFormChange({ ...form, customer_id: event.target.value })
            }
            aria-invalid={!form.customer_id}
            required
          >
            <option value="">{t("invoiceForm.selectCustomer")}</option>
            {filteredCustomers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.email ? ` - ${customer.email}` : ""}
              </option>
            ))}
          </select>
          {!form.customer_id ? (
            <p className="text-xs text-destructive">{t("invoiceForm.selectOptionError")}</p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label
              className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
              htmlFor="invoice_date"
            >
              {t("invoiceForm.invoiceDate")}
            </Label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="invoice_date"
                type="date"
                value={form.date}
                onChange={(event) =>
                  onFormChange({ ...form, date: event.target.value })
                }
                className={`pl-9 ${inputClassName}`}
              />
            </div>
          </div>

          <div className="rounded-[1rem] border border-slate-200 bg-white/85 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Live summary
            </p>
            <div className="mt-2 grid gap-1 text-sm">
              <p className="font-semibold text-slate-950 dark:text-slate-100">
                {formatCurrency(totalAmount)}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                Balance {formatCurrency(balanceAmount)}
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                Paid {formatCurrency(paidAmount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <details
        className="mt-4 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60"
        open={advancedOpen}
        onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                Advanced
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                GST, discount, notes, warehouse, and payment details
              </p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </summary>

        <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="due_date">
                {t("invoiceForm.dueDate")}
              </Label>
              <Input
                id="due_date"
                type="date"
                value={form.due_date}
                onChange={(event) =>
                  onFormChange({ ...form, due_date: event.target.value })
                }
                className={inputClassName}
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="tax_mode">
                {t("invoiceForm.gstMode")}
              </Label>
              <select
                id="tax_mode"
                className={selectClassName}
                value={taxMode}
                onChange={(event) => onTaxModeChange(event.target.value as TaxMode)}
              >
                <option value="CGST_SGST">{t("invoiceForm.gstModeCgstSgst")}</option>
                <option value="IGST">{t("invoiceForm.gstModeIgst")}</option>
                <option value="NONE">{t("invoiceForm.gstModeNone")}</option>
              </select>
            </div>

            <div className="sm:col-span-2 rounded-[1rem] border border-slate-200 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Discount
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Apply offer rules without leaving the billing screen.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isDiscountDisabled}
                  className="h-8 rounded-full px-3"
                  onClick={() =>
                    onFormChange({
                      ...form,
                      discount: "10",
                      discount_type: "PERCENTAGE",
                    })
                  }
                >
                  Flat 10%
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  disabled={isDiscountDisabled}
                  onChange={(event) =>
                    onFormChange({ ...form, discount: event.target.value })
                  }
                  placeholder={t("invoiceForm.discountPlaceholder")}
                  className={inputClassName}
                />
                <select
                  id="discount_type"
                  className={selectClassName}
                  value={form.discount_type}
                  disabled={isDiscountDisabled}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      discount_type: event.target
                        .value as InvoiceFormState["discount_type"],
                    })
                  }
                >
                  <option value="FIXED">{t("invoiceForm.discountTypeFixed")}</option>
                  <option value="PERCENTAGE">
                    {t("invoiceForm.discountTypePercentage")}
                  </option>
                </select>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">Applied discount</span>
                <span className="font-semibold text-slate-950 dark:text-slate-100">
                  -{formatCurrency(discountAppliedAmount)}
                </span>
              </div>
              {discountError ? (
                <p className="mt-2 text-sm text-destructive">{discountError}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="warehouse">
                {t("invoiceForm.warehouse")}
              </Label>
              <select
                id="warehouse"
                className={selectClassName}
                value={form.warehouse_id ?? ""}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    warehouse_id: event.target.value,
                    sync_sales: true,
                  })
                }
              >
                <option value="">Use default warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment_status">
                {t("purchasesPage.fields.paymentStatus")}
              </Label>
              <select
                id="payment_status"
                className={selectClassName}
                value={form.payment_status}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    payment_status: event.target
                      .value as InvoiceFormState["payment_status"],
                  })
                }
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">
                  {t("invoiceHistory.status.PARTIALLY_PAID")}
                </option>
                <option value="PAID">{t("invoiceHistory.status.PAID")}</option>
              </select>
            </div>

            {(form.payment_status === "PAID" ||
              form.payment_status === "PARTIALLY_PAID") && (
              <>
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment_method">
                    {t("purchasesPage.fields.paymentMethod")}
                  </Label>
                  <select
                    id="payment_method"
                    className={selectClassName}
                    value={form.payment_method}
                    onChange={(event) =>
                      onFormChange({
                        ...form,
                        payment_method: event.target
                          .value as InvoiceFormState["payment_method"],
                      })
                    }
                  >
                    <option value="">{t("invoiceForm.selectOptionError")}</option>
                    <option value="CASH">{t("invoiceDetail.paymentMethods.CASH")}</option>
                    <option value="UPI">{t("invoiceDetail.paymentMethods.UPI")}</option>
                    <option value="BANK_TRANSFER">
                      {t("invoiceDetail.paymentMethods.BANK_TRANSFER")}
                    </option>
                    <option value="CARD">{t("invoiceDetail.paymentMethods.CARD")}</option>
                    <option value="CHEQUE">{t("invoiceDetail.paymentMethods.CHEQUE")}</option>
                    <option value="OTHER">{t("invoiceDetail.paymentMethods.OTHER")}</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="payment_date">
                    {t("purchasesPage.fields.paymentDate")}
                  </Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={form.payment_date}
                    onChange={(event) =>
                      onFormChange({
                        ...form,
                        payment_date: event.target.value,
                      })
                    }
                    className={inputClassName}
                  />
                </div>
              </>
            )}

            {form.payment_status === "PARTIALLY_PAID" ? (
              <div className="grid gap-2 sm:col-span-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="amount_paid">
                  {t("purchasesPage.fields.amountPaid")}
                </Label>
                <Input
                  id="amount_paid"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount_paid}
                  onChange={(event) =>
                    onFormChange({
                      ...form,
                      amount_paid: event.target.value,
                    })
                  }
                  placeholder={t("purchasesPage.placeholders.amountPaid")}
                  className={inputClassName}
                />
              </div>
            ) : null}

            <div className="sm:col-span-2 grid gap-2">
              <Label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400" htmlFor="notes">
                {t("invoiceForm.notes")}
              </Label>
              <textarea
                id="notes"
                value={form.notes}
                onChange={(event) =>
                  onFormChange({
                    ...form,
                    notes: event.target.value,
                  })
                }
                className={textareaClassName}
                placeholder="Add optional notes for this bill"
              />
            </div>
          </div>

          {businessSummary ? (
            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-950/50">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Business details
              </p>
              <div className="mt-2 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
                <p className="font-semibold text-slate-950 dark:text-slate-100">
                  {businessSummary.businessName}
                </p>
                {businessSummary.taxId ? <p>GST: {businessSummary.taxId}</p> : null}
                {businessSummary.phone ? <p>Phone: {businessSummary.phone}</p> : null}
                {businessSummary.email ? <p>Email: {businessSummary.email}</p> : null}
              </div>
            </div>
          ) : null}

          {summaryErrors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {summaryErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {serverError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-300">{serverError}</p>
          ) : null}
        </div>
      </details>
    </section>
  );
};

export default InvoiceCompactMetaPanel;
