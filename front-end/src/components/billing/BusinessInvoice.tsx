"use client";

import Link from "next/link";
import { memo, type RefObject } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Customer } from "@/lib/apiClient";
import type {
  DiscountMode,
  PaymentChoice,
} from "@/components/billing/simpleBillUtils";

type BusinessInvoiceProps = {
  customerSearch: string;
  customerSuggestions: Customer[];
  hasExactCustomerMatch: boolean;
  addingCustomer: boolean;
  newCustomerName: string;
  newCustomerPhone: string;
  invoiceDate: string;
  customerType: "B2C" | "B2B";
  customerGstin: string;
  placeOfSupplyStateCode: string;
  payment: PaymentChoice;
  discount: string;
  discountMode: DiscountMode;
  gstEnabled: boolean;
  notes: string;
  customerSuggestionsOpen: boolean;
  createCustomerPending: boolean;
  newCustomerPhoneRef: RefObject<HTMLInputElement | null>;
  onInvoiceDateChange: (value: string) => void;
  onCustomerSearch: (value: string) => void;
  onCustomerFocusChange: (open: boolean) => void;
  onSelectCustomer: (customer: Customer) => void;
  onStartAddCustomer: (value?: string) => void;
  onNewCustomerNameChange: (value: string) => void;
  onNewCustomerPhoneChange: (value: string) => void;
  onUseCustomer: () => void;
  onCustomerTypeChange: (value: "B2C" | "B2B") => void;
  onCustomerGstinChange: (value: string) => void;
  onPlaceOfSupplyStateCodeChange: (value: string) => void;
  onPaymentChange: (value: PaymentChoice) => void;
  onDiscountChange: (value: string) => void;
  onDiscountModeChange: (value: DiscountMode) => void;
  onGstEnabledChange: (value: boolean) => void;
  onNotesChange: (value: string) => void;
};

const BusinessInvoice = ({
  customerSearch,
  customerSuggestions,
  hasExactCustomerMatch,
  addingCustomer,
  newCustomerName,
  newCustomerPhone,
  invoiceDate,
  customerType,
  customerGstin,
  placeOfSupplyStateCode,
  payment,
  discount,
  discountMode,
  gstEnabled,
  notes,
  customerSuggestionsOpen,
  createCustomerPending,
  newCustomerPhoneRef,
  onInvoiceDateChange,
  onCustomerSearch,
  onCustomerFocusChange,
  onSelectCustomer,
  onStartAddCustomer,
  onNewCustomerNameChange,
  onNewCustomerPhoneChange,
  onUseCustomer,
  onCustomerTypeChange,
  onCustomerGstinChange,
  onPlaceOfSupplyStateCodeChange,
  onPaymentChange,
  onDiscountChange,
  onDiscountModeChange,
  onGstEnabledChange,
  onNotesChange,
}: BusinessInvoiceProps) => {
  return (
    <section className="no-print grid gap-4 rounded-[1.6rem] border border-border/70 bg-card/90 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Business Mode
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use customer, GST, discount, and notes when you need a fuller
            invoice.
          </p>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            GSTIN, PAN, and business identity come from Business Profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/business-profile">Business Profile</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/invoices">
              Open Full Invoice Workspace
              <ArrowRight size={16} />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4">
          <div className="relative min-w-0">
            <Label
              htmlFor="simple-customer"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Customer
            </Label>
            <Input
              id="simple-customer"
              value={customerSearch}
              onFocus={() => onCustomerFocusChange(true)}
              onBlur={() =>
                window.setTimeout(() => onCustomerFocusChange(false), 120)
              }
              onChange={(event) => onCustomerSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;

                event.preventDefault();
                if (customerSuggestions[0]) {
                  onSelectCustomer(customerSuggestions[0]);
                  return;
                }

                if (customerSearch.trim() && !hasExactCustomerMatch) {
                  onStartAddCustomer(customerSearch);
                }
              }}
              className="mt-2 h-12 text-base"
              placeholder="Type customer name or phone"
              autoComplete="off"
            />
            {customerSuggestionsOpen ? (
              <div className="absolute left-0 right-0 top-[5.2rem] z-20 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                {customerSuggestions.length ? (
                  customerSuggestions.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-accent/70"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onSelectCustomer(customer)}
                    >
                      <span className="font-semibold text-foreground">
                        {customer.name}
                      </span>
                      {customer.phone ? (
                        <span className="text-muted-foreground">
                          {customer.phone}
                        </span>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <p className="px-4 py-3 text-sm text-muted-foreground">
                    No saved customer found.
                  </p>
                )}
                {customerSearch.trim() && !hasExactCustomerMatch ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-sm font-semibold text-primary transition hover:bg-primary/5"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onStartAddCustomer(customerSearch)}
                  >
                    <Plus size={16} />
                    Add "{customerSearch.trim()}" as customer
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {addingCustomer ? (
            <div className="grid gap-3 rounded-2xl border border-border/70 bg-background p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <Label
                  htmlFor="simple-new-customer-name"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Name
                </Label>
                <Input
                  id="simple-new-customer-name"
                  value={newCustomerName}
                  onChange={(event) =>
                    onNewCustomerNameChange(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      newCustomerPhoneRef.current?.focus();
                    }
                  }}
                  className="mt-2 h-12 text-base"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <Label
                  htmlFor="simple-new-customer-phone"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Phone
                </Label>
                <Input
                  id="simple-new-customer-phone"
                  ref={newCustomerPhoneRef}
                  value={newCustomerPhone}
                  onChange={(event) =>
                    onNewCustomerPhoneChange(
                      event.target.value.replace(/[^\d]/g, ""),
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onUseCustomer();
                    }
                  }}
                  className="mt-2 h-12 text-base"
                  placeholder="Phone number"
                  inputMode="tel"
                />
              </div>
              <Button
                type="button"
                className="h-12"
                disabled={createCustomerPending}
                onClick={onUseCustomer}
              >
                Use Customer
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div>
            <Label
              htmlFor="simple-invoice-date"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Bill Date
            </Label>
            <Input
              id="simple-invoice-date"
              type="date"
              value={invoiceDate}
              onChange={(event) => onInvoiceDateChange(event.target.value)}
              className="mt-2 h-12 text-base"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label
                htmlFor="simple-discount"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Discount
              </Label>
              <Input
                id="simple-discount"
                value={discount}
                onChange={(event) =>
                  onDiscountChange(event.target.value.replace(/[^\d.]/g, ""))
                }
                className="mt-2 h-12 text-base"
                placeholder="0"
                inputMode="decimal"
              />
            </div>
            <div className="flex rounded-lg border border-border bg-background p-1">
              {(["AMOUNT", "PERCENT"] as DiscountMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-10 min-w-10 rounded-md px-3 text-sm font-semibold transition ${
                    discountMode === mode
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => onDiscountModeChange(mode)}
                >
                  {mode === "AMOUNT" ? "Rs" : "%"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label
              htmlFor="simple-payment"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Payment Method
            </Label>
            <select
              id="simple-payment"
              value={payment}
              onChange={(event) =>
                onPaymentChange(event.target.value as PaymentChoice)
              }
              className="app-field mt-2 h-12 w-full rounded-lg px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="ONLINE">Online</option>
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label
                htmlFor="simple-customer-type"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Customer Type
              </Label>
              <select
                id="simple-customer-type"
                value={customerType}
                onChange={(event) =>
                  onCustomerTypeChange(event.target.value as "B2C" | "B2B")
                }
                className="app-field mt-2 h-12 w-full rounded-lg px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="B2C">Regular (B2C)</option>
                <option value="B2B">Business (B2B)</option>
              </select>
            </div>

            <div>
              <Label
                htmlFor="simple-customer-gstin"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Customer GST Number (Optional)
              </Label>
              <Input
                id="simple-customer-gstin"
                value={customerGstin}
                onChange={(event) =>
                  onCustomerGstinChange(event.target.value.toUpperCase())
                }
                className="mt-2 h-12 text-base uppercase"
                placeholder="27ABCDE1234F1Z5"
                maxLength={15}
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor="simple-place-of-supply"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Place of Supply State Code (Optional)
            </Label>
            <Input
              id="simple-place-of-supply"
              value={placeOfSupplyStateCode}
              onChange={(event) =>
                onPlaceOfSupplyStateCodeChange(
                  event.target.value.replace(/[^0-9]/g, "").slice(0, 2),
                )
              }
              className="mt-2 h-12 text-base"
              placeholder="e.g. 27"
              inputMode="numeric"
            />
          </div>

          <label className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-3">
            <div>
              <p className="font-semibold text-foreground">GST on bill</p>
              <p className="text-sm text-muted-foreground">
                Show tax calculation on the invoice.
              </p>
            </div>
            <input
              type="checkbox"
              checked={gstEnabled}
              onChange={(event) => onGstEnabledChange(event.target.checked)}
              className="h-5 w-5"
            />
          </label>
        </div>
      </div>

      <div>
        <Label
          htmlFor="simple-notes"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Notes / Terms
        </Label>
        <Input
          id="simple-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          className="mt-2 h-12 text-base"
          placeholder="Optional notes, payment reminder, or store terms"
        />
      </div>
    </section>
  );
};

export default memo(BusinessInvoice);
