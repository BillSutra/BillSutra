"use client";

import React from "react";
import {
  ArrowRight,
  Minus,
  Plus,
  ScanLine,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import InvoiceSmartSuggestions from "@/components/invoice/InvoiceSmartSuggestions";
import AsyncProductSelect, {
  type AsyncProductSelectHandle,
} from "@/components/products/AsyncProductSelect";
import { Button } from "@/components/ui/button";
import FirstTimeHint from "@/components/ui/FirstTimeHint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/apiClient";
import type { SmartSuggestionProduct } from "@/lib/invoiceSuggestions";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";
import type { InvoiceItemError, InvoiceItemForm } from "@/types/invoice";

export type InvoiceTableProps = {
  items: InvoiceItemForm[];
  errors: InvoiceItemError[];
  productLookup?: Record<number, Product>;
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
  onFocusEntry?: () => void;
  onQuickEntrySelect: (product: Product | null) => void;
  onQuickEntrySubmit: (product: Product | null) => void;
  onSelectItem: (index: number) => void;
  onItemChange: (
    index: number,
    key: keyof InvoiceItemForm,
    value: string,
  ) => void;
  onRemoveItem: (index: number) => void;
  onAddSuggestedProduct: (
    product: Product,
    source: "suggested" | "recent",
  ) => void;
};

const shortcutBadgeClassName =
  "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300";

const quantityButtonClassName =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-primary/25 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-primary/30 dark:hover:bg-primary/10";

const priceInputClassName =
  "h-auto w-20 max-w-[80px] border-0 bg-transparent px-0 py-0 text-right text-sm font-medium shadow-none focus-visible:ring-0 dark:bg-transparent";

const quantityInputClassName =
  "h-8 w-12 max-w-[80px] flex-none border-0 bg-transparent px-1 text-center text-sm font-semibold shadow-none focus-visible:ring-0 dark:bg-transparent";

const InvoiceTable = ({
  items,
  errors,
  productLookup = {},
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
  onFocusEntry,
  onQuickEntrySelect,
  onQuickEntrySubmit,
  onSelectItem,
  onItemChange,
  onRemoveItem,
  onAddSuggestedProduct,
}: InvoiceTableProps) => {
  const { formatCurrency, formatNumber, t } = useI18n();
  const itemCount = items.reduce(
    (count, item) => count + Math.max(0, Number(item.quantity) || 0),
    0,
  );

  const getStockTone = (stockOnHand: number, reorderLevel: number) => {
    if (stockOnHand <= 0) {
      return {
        label: "Out of Stock",
        badgeClassName:
          "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200",
        dotClassName: "bg-rose-500",
      };
    }

    if (stockOnHand <= reorderLevel) {
      return {
        label: "Low Stock",
        badgeClassName:
          "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200",
        dotClassName: "bg-amber-500",
      };
    }

    return {
      label: "In Stock",
      badgeClassName:
        "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200",
      dotClassName: "bg-emerald-500",
    };
  };

  return (
    <section className="grid gap-4">
      <div
        className={cn(
          "self-start rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.18)] transition-[box-shadow,border-color,transform] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.9)_100%)] dark:shadow-[0_24px_52px_-36px_rgba(0,0,0,0.48)]",
          entryHighlighted &&
            "border-primary/45 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
              {t("invoiceComposer.productStation")}
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Search, scan, press Enter
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Keep the cursor here and move through billing without extra clicks.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ScanLine size={14} />
            {t("invoiceComposer.scannerReady")}
          </span>
        </div>

        <FirstTimeHint
          id="invoice-product-search"
          message="Search or scan the product here, then press Enter to put it into the bill."
          bubbleClassName="max-w-sm"
        >
          <div className="mt-4 rounded-[1.35rem] bg-slate-50/85 p-4 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
            <Label
              htmlFor="pos-product-search"
              className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
            >
              {t("invoiceComposer.searchOrScan")}
            </Label>
            <div className="mt-3">
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
                placeholder={t("invoiceComposer.searchPlaceholder")}
                className="min-w-0"
                inputClassName="h-12 rounded-[1rem] border-slate-200 bg-white pr-4 text-[15px] shadow-[0_14px_28px_-22px_rgba(15,23,42,0.18)] focus-visible:border-primary/40 focus-visible:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:focus-visible:border-primary/40 dark:focus-visible:ring-primary/20"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={shortcutBadgeClassName}>Enter adds item</span>
              <span className={shortcutBadgeClassName}>
                {t("invoiceComposer.refocusSearch", { key: shortcutMetaLabel })}
              </span>
              <span className={shortcutBadgeClassName}>Arrow keys update qty</span>
            </div>
            {quickEntryProduct ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[1rem] border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
                <span className="truncate font-medium">
                  Ready: {quickEntryProduct.name}
                </span>
                <span className="shrink-0 font-semibold">
                  {formatCurrency(Number(quickEntryProduct.price))}
                </span>
              </div>
            ) : null}
          </div>
        </FirstTimeHint>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-slate-700/80">
            {formatNumber(items.length)} row{items.length === 1 ? "" : "s"}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:text-slate-200 dark:ring-slate-700/80">
            {formatNumber(itemCount)} units
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
            <Sparkles size={14} />
            <span>{t("invoiceComposer.liveTotals")}</span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          "min-w-0 w-full self-start overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95 p-4 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.18)] transition-[box-shadow,border-color,transform] dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-[0_24px_55px_-36px_rgba(0,0,0,0.48)]",
          itemsHighlighted &&
            "border-primary/40 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {t("invoiceComposer.cart")}
            </p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
              <ShoppingCart size={20} />
              <span>{t("invoiceComposer.currentBill")}</span>
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t("invoiceComposer.lineItems", {
                count: formatNumber(items.length),
              })}
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-slate-700 dark:text-slate-300">
              {t("invoiceComposer.removeSelectedShortcut", {
                key: shortcutMetaLabel,
              })}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-[1.5rem] bg-slate-50/80 px-6 py-10 text-center ring-1 ring-dashed ring-slate-300 dark:bg-slate-900/50 dark:ring-slate-700">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white text-primary shadow-sm dark:border-slate-700 dark:bg-slate-950">
              <ShoppingCart size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">
              No items added
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
              Scan or search product to start.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button type="button" onClick={() => onFocusEntry?.()}>
                {t("invoiceComposer.focusProductSearch")}
                <ArrowRight size={16} />
              </Button>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {shortcutMetaLabel}+Q
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
            {items.map((item, index) => {
              const quantity = Math.max(1, Number(item.quantity) || 1);
              const unitPrice = Math.max(0, Number(item.price) || 0);
              const lineTotal = quantity * unitPrice;
              const isSelected = selectedItemIndex === index;
              const isRecent = recentProductId === item.product_id;
              const linkedProductId = Number(item.product_id || 0);
              const linkedProduct =
                Number.isInteger(linkedProductId) && linkedProductId > 0
                  ? productLookup[linkedProductId]
                  : undefined;
              const stockOnHand = linkedProduct?.stock_on_hand ?? null;
              const reorderLevel = linkedProduct?.reorder_level ?? 0;
              const stockTone =
                stockOnHand === null
                  ? null
                  : getStockTone(stockOnHand, reorderLevel);
              const stockWarning =
                stockOnHand !== null && quantity > stockOnHand;

              return (
                <div
                  key={`item-${index}`}
                  className={cn(
                    "group -mx-1 w-full overflow-hidden rounded-[1rem] px-3 py-2.5 transition-[box-shadow,background-color] duration-200",
                    isSelected
                      ? "bg-primary/5 shadow-[0_0_0_1px_rgba(37,99,235,0.2)] dark:bg-primary/10"
                      : "bg-transparent hover:bg-slate-50/80 dark:hover:bg-slate-950/50",
                    isRecent && "animate-in fade-in zoom-in-95",
                  )}
                  onClick={() => onSelectItem(index)}
                >
                  <div className="flex w-full min-w-0 flex-row flex-wrap items-center gap-2.5">
                    <div className="min-w-[140px] flex-1 basis-[11rem] overflow-hidden">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-slate-950 dark:text-slate-100">
                          {item.name || t("invoiceComposer.itemFallback")}
                        </p>
                        {isRecent ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                            {t("invoiceComposer.recentlyAdded")}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {item.tax_rate
                            ? `GST ${item.tax_rate}%`
                            : t("invoiceComposer.noGst")}
                        </span>
                        <span>&bull;</span>
                        <span>
                          {t("invoiceComposer.lineNumber", {
                            number: formatNumber(index + 1),
                          })}
                        </span>
                        {stockOnHand !== null ? (
                          <>
                            <span>&bull;</span>
                            <span>Stock: {formatNumber(stockOnHand)}</span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-[0.12em]",
                                stockTone?.badgeClassName,
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  stockTone?.dotClassName,
                                )}
                              />
                              {stockTone?.label}
                            </span>
                          </>
                        ) : null}
                        {stockWarning ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
                            Qty above stock
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
                      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/80 p-1 dark:border-slate-700 dark:bg-slate-900/70">
                        <button
                          type="button"
                          className={quantityButtonClassName}
                          onClick={(event) => {
                            event.stopPropagation();
                            onItemChange(
                              index,
                              "quantity",
                              String(Math.max(1, quantity - 1)),
                            );
                            onSelectItem(index);
                          }}
                          aria-label={t("invoiceComposer.decreaseQuantityAria", {
                            name: item.name || t("invoiceComposer.itemFallback"),
                          })}
                        >
                          <Minus size={16} className="mx-auto" />
                        </button>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onFocus={() => onSelectItem(index)}
                          onKeyDown={(event) => {
                            if (
                              (event.ctrlKey || event.metaKey) &&
                              event.key === "Delete"
                            ) {
                              event.preventDefault();
                              onRemoveItem(index);
                              return;
                            }

                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              onItemChange(
                                index,
                                "quantity",
                                String(quantity + 1),
                              );
                              return;
                            }

                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              onItemChange(
                                index,
                                "quantity",
                                String(Math.max(1, quantity - 1)),
                              );
                              return;
                            }

                            if (event.key === "Enter") {
                              event.preventDefault();
                              event.currentTarget.blur();
                            }
                          }}
                          onChange={(event) =>
                            onItemChange(index, "quantity", event.target.value)
                          }
                          className={quantityInputClassName}
                          aria-label={t("invoiceComposer.quantityLabel")}
                        />
                        <button
                          type="button"
                          className={quantityButtonClassName}
                          onClick={(event) => {
                            event.stopPropagation();
                            onItemChange(
                              index,
                              "quantity",
                              String(quantity + 1),
                            );
                            onSelectItem(index);
                          }}
                          aria-label={t("invoiceComposer.increaseQuantityAria", {
                            name: item.name || t("invoiceComposer.itemFallback"),
                          })}
                        >
                          <Plus size={16} className="mx-auto" />
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-white px-2.5 py-2 dark:border-slate-700 dark:bg-slate-950/70">
                        <div className="flex items-center gap-1 text-sm">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onFocus={() => onSelectItem(index)}
                            onKeyDown={(event) => {
                              if (
                                (event.ctrlKey || event.metaKey) &&
                                event.key === "Delete"
                              ) {
                                event.preventDefault();
                                onRemoveItem(index);
                                return;
                              }

                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            onChange={(event) =>
                              onItemChange(index, "price", event.target.value)
                            }
                            className={priceInputClassName}
                            aria-label={t("invoiceComposer.unitPriceLabel")}
                          />
                          <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                            x {formatNumber(quantity)}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-[88px] shrink-0 text-right">
                        <p className="text-base font-semibold text-slate-950 dark:text-slate-100">
                          {formatCurrency(lineTotal)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t("invoiceComposer.lineSubtotal")}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full text-slate-400 opacity-70 transition hover:text-red-600 group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveItem(index);
                        }}
                        aria-label={t("invoiceComposer.removeItemAria", {
                          name: item.name || t("invoiceComposer.itemFallback"),
                        })}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {errors[index]?.price || errors[index]?.quantity ? (
                    <div className="flex flex-wrap gap-3 pt-1 text-xs text-red-600 dark:text-red-300">
                      {errors[index]?.price ? <p>{errors[index]?.price}</p> : null}
                      {errors[index]?.quantity ? (
                        <p>{errors[index]?.quantity}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {(suggestedProducts.length > 0 || recentProducts.length > 0) && (
          <details className="mt-4 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Optional
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-100">
                  Quick picks and recent products
                </p>
              </div>
              <span className={shortcutBadgeClassName}>Open drawer</span>
            </summary>
            <div className="border-t border-slate-200/80 px-4 py-4 dark:border-slate-700/80">
              <InvoiceSmartSuggestions
                suggestedProducts={suggestedProducts}
                recentProducts={recentProducts}
                onAddProduct={onAddSuggestedProduct}
              />
            </div>
          </details>
        )}
      </div>
    </section>
  );
};

export default InvoiceTable;
