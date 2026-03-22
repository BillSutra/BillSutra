"use client";

import React from "react";
import { Minus, Plus, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
import InvoiceSmartSuggestions from "@/components/invoice/InvoiceSmartSuggestions";
import AsyncProductSelect, {
  type AsyncProductSelectHandle,
} from "@/components/products/AsyncProductSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/apiClient";
import type { SmartSuggestionProduct } from "@/lib/invoiceSuggestions";
import { cn } from "@/lib/utils";
import type { InvoiceItemError, InvoiceItemForm } from "@/types/invoice";
import { useI18n } from "@/providers/LanguageProvider";

export type InvoiceTableProps = {
  items: InvoiceItemForm[];
  errors: InvoiceItemError[];
  quickEntryProduct: Product | null;
  quickEntryRef?: React.Ref<AsyncProductSelectHandle>;
  autoFocusProductSearch?: boolean;
  selectedItemIndex?: number | null;
  recentProductId?: string | null;
  suggestedProducts: SmartSuggestionProduct[];
  recentProducts: Product[];
  shortcutMetaLabel: string;
  entryHighlighted?: boolean;
  itemsHighlighted?: boolean;
  onQuickEntrySelect: (product: Product | null) => void;
  onQuickEntrySubmit: (product: Product | null) => void;
  onSelectItem: (index: number) => void;
  onItemChange: (
    index: number,
    key: keyof InvoiceItemForm,
    value: string,
  ) => void;
  onRemoveItem: (index: number) => void;
  onAddSuggestedProduct: (product: Product, source: "suggested" | "recent") => void;
};

const shortcutBadgeClassName =
  "rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

const quantityButtonClassName =
  "h-11 w-11 rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10";

const InvoiceTable = ({
  items,
  errors,
  quickEntryProduct,
  quickEntryRef,
  autoFocusProductSearch = false,
  selectedItemIndex = null,
  recentProductId = null,
  suggestedProducts,
  recentProducts,
  shortcutMetaLabel,
  entryHighlighted = false,
  itemsHighlighted = false,
  onQuickEntrySelect,
  onQuickEntrySubmit,
  onSelectItem,
  onItemChange,
  onRemoveItem,
  onAddSuggestedProduct,
}: InvoiceTableProps) => {
  const { formatCurrency, t } = useI18n();
  const itemCount = items.reduce(
    (count, item) => count + Math.max(0, Number(item.quantity) || 0),
    0,
  );

  return (
    <section className="grid gap-5 2xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)]">
      <div
        className={cn(
          "rounded-[2rem] border border-[#eadfcf] bg-[linear-gradient(180deg,#fffaf5_0%,#fff4e8_100%)] p-5 shadow-[0_24px_50px_-34px_rgba(120,53,15,0.35)] transition-[box-shadow,border-color,transform] dark:border-amber-900/30 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.18)_0%,rgba(17,24,39,0.92)_100%)] dark:shadow-[0_24px_50px_-34px_rgba(0,0,0,0.48)]",
          entryHighlighted &&
            "border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#b45309] dark:text-amber-200">
              Product station
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#3b2411] dark:text-gray-50">
              Smart billing lane
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#7c5a3d] dark:text-amber-100/75">
              Scan a barcode or search products, then press Enter to drop the
              item into the cart. Duplicate scans increase quantity instantly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={shortcutBadgeClassName}>Enter add item</span>
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+Q focus lane
            </span>
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+P quick product
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-[1.7rem] border border-white/80 bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-white/10 dark:bg-gray-900/70">
          <Label
            htmlFor="pos-product-search"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56] dark:text-gray-300"
          >
            Search or scan
          </Label>
          <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(180px,auto)]">
            <AsyncProductSelect
              ref={quickEntryRef}
              value={quickEntryProduct ? String(quickEntryProduct.id) : ""}
              selectedLabel={quickEntryProduct?.name ?? ""}
              selectedProduct={quickEntryProduct}
              autoFocus={autoFocusProductSearch}
              onSelect={onQuickEntrySelect}
              onSubmitSelection={(candidate) =>
                onQuickEntrySubmit(candidate ?? quickEntryProduct)
              }
              placeholder="Search name, SKU, or scan barcode"
              className="min-w-0"
              inputClassName="h-12 rounded-2xl border-[#e7d9cc] bg-white/95 pr-4 text-[15px] shadow-[0_12px_25px_-20px_rgba(120,53,15,0.35)] focus-visible:border-amber-300 focus-visible:ring-amber-100 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:border-amber-300 dark:focus-visible:ring-amber-500/20"
            />
            <Button
              type="button"
              onClick={() => {
                if (quickEntryRef && "current" in quickEntryRef) {
                  quickEntryRef.current?.submit();
                  return;
                }
                onQuickEntrySubmit(quickEntryProduct);
              }}
              className="h-12 w-full rounded-2xl px-6 text-sm font-semibold"
            >
              Add to cart
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/75 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56] dark:text-gray-300">
              Ready state
            </p>
            <div className="mt-3">
              <p className="text-base font-semibold text-[#3b2411] dark:text-gray-100">
                {quickEntryProduct?.name ?? "Waiting for scan"}
              </p>
              <p className="mt-1 text-sm text-[#7c5a3d] dark:text-gray-400">
                {quickEntryProduct
                  ? `Unit price ${formatCurrency(Number(quickEntryProduct.price))}`
                  : "Keep the cursor here and start typing or scanning."}
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/75 bg-white/80 p-4 dark:border-white/10 dark:bg-gray-900/60">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56] dark:text-gray-300">
              Throughput
            </p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-[#3b2411] dark:text-gray-100">
                  {itemCount}
                </p>
                <p className="mt-1 text-sm text-[#7c5a3d] dark:text-gray-400">
                  total units in the live cart
                </p>
              </div>
              <div className="inline-flex shrink-0 self-start items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                <Sparkles size={14} />
                <span>Live totals</span>
              </div>
            </div>
          </div>
        </div>

        <InvoiceSmartSuggestions
          suggestedProducts={suggestedProducts}
          recentProducts={recentProducts}
          onAddProduct={onAddSuggestedProduct}
        />
      </div>

      <div
        className={cn(
          "rounded-[2rem] border border-gray-200 bg-white/95 p-5 shadow-[0_24px_55px_-36px_rgba(15,23,42,0.28)] transition-[box-shadow,border-color,transform] dark:border-gray-700 dark:bg-gray-900/90 dark:shadow-[0_24px_55px_-36px_rgba(0,0,0,0.48)]",
          itemsHighlighted &&
            "border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500">
              Cart
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              <ShoppingCart size={20} />
              <span>Current bill</span>
            </h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Adjust quantities inline and the totals update immediately.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+Delete remove selected
            </span>
            <span className={shortcutBadgeClassName}>Tap item to select</span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-gray-300 bg-gray-50/70 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            No items yet. Start scanning or searching from the product station to
            build the cart.
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {items.map((item, index) => {
              const quantity = Math.max(1, Number(item.quantity) || 1);
              const unitPrice = Math.max(0, Number(item.price) || 0);
              const lineTotal = quantity * unitPrice;
              const isSelected = selectedItemIndex === index;
              const isRecent = recentProductId === item.product_id;

              return (
                <div
                  key={`item-${index}`}
                  className={cn(
                    "rounded-[1.6rem] border p-4 transition-[box-shadow,border-color,transform] duration-200",
                    isSelected
                      ? "border-indigo-400 bg-indigo-50/60 shadow-[0_0_0_4px_rgba(99,102,241,0.1)] dark:border-indigo-500/50 dark:bg-indigo-500/10"
                      : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_16px_32px_-28px_rgba(15,23,42,0.32)] dark:border-gray-700 dark:bg-gray-900/70",
                    isRecent && "animate-in fade-in zoom-in-95",
                  )}
                  onClick={() => onSelectItem(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                          {item.name || "Item"}
                        </p>
                        {isRecent ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                            Recently added
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">
                          {item.tax_rate ? `GST ${item.tax_rate}%` : "No GST"}
                        </span>
                        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 dark:border-gray-700 dark:bg-gray-900">
                          Line {index + 1}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-gray-500 hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveItem(index);
                      }}
                      aria-label={`Remove ${item.name || "item"}`}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(170px,auto)] 2xl:items-end">
                    <div className="grid gap-3 md:grid-cols-[minmax(130px,0.68fr)_minmax(220px,1fr)]">
                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Unit price
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onFocus={() => onSelectItem(index)}
                          onChange={(event) =>
                            onItemChange(index, "price", event.target.value)
                          }
                          className="h-11 rounded-2xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                        />
                        {errors[index]?.price ? (
                          <p className="text-xs text-red-600 dark:text-red-300">
                            {errors[index]?.price}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Quantity
                        </Label>
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            type="button"
                            className={cn(quantityButtonClassName, "h-10 w-10 rounded-xl")}
                            onClick={(event) => {
                              event.stopPropagation();
                              onItemChange(
                                index,
                                "quantity",
                                String(Math.max(1, quantity - 1)),
                              );
                              onSelectItem(index);
                            }}
                            aria-label={`Decrease quantity for ${item.name || "item"}`}
                          >
                            <Minus size={18} className="mx-auto" />
                          </button>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={item.quantity}
                            onFocus={() => onSelectItem(index)}
                            onChange={(event) =>
                              onItemChange(index, "quantity", event.target.value)
                            }
                            className="h-10 w-20 flex-none rounded-xl border-gray-200 bg-white px-2 text-center text-base font-semibold shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                          />
                          <button
                            type="button"
                            className={cn(quantityButtonClassName, "h-10 w-10 rounded-xl")}
                            onClick={(event) => {
                              event.stopPropagation();
                              onItemChange(
                                index,
                                "quantity",
                                String(quantity + 1),
                              );
                              onSelectItem(index);
                            }}
                            aria-label={`Increase quantity for ${item.name || "item"}`}
                          >
                            <Plus size={18} className="mx-auto" />
                          </button>
                        </div>
                        {errors[index]?.quantity ? (
                          <p className="text-xs text-red-600 dark:text-red-300">
                            {errors[index]?.quantity}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-[1.4rem] border border-gray-200 bg-gray-50/80 px-4 py-3 text-left xl:text-right dark:border-gray-700 dark:bg-gray-900/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        Line subtotal
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                        {formatCurrency(lineTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default InvoiceTable;
