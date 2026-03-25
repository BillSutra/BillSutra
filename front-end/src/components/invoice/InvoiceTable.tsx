"use client";

import React from "react";
import { ArrowRight, Minus, Plus, ScanLine, ShoppingCart, Sparkles, Trash2 } from "lucide-react";
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
  onAddSuggestedProduct: (product: Product, source: "suggested" | "recent") => void;
};

const shortcutBadgeClassName =
  "inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300";

const quantityButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-primary/25 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-primary/30 dark:hover:bg-primary/10";

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

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)] 2xl:grid-cols-[minmax(420px,0.84fr)_minmax(0,1.16fr)]">
      <div
        className={cn(
          "rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_22px_52px_-36px_rgba(15,23,42,0.2)] transition-[box-shadow,border-color,transform] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.9)_100%)] dark:shadow-[0_24px_52px_-36px_rgba(0,0,0,0.48)]",
          entryHighlighted && "border-primary/45 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
              {t("invoiceComposer.productStation")}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {t("invoiceComposer.smartBillingLane")}
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t("invoiceComposer.laneDescription")}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
            <ScanLine size={14} />
            {t("invoiceComposer.scannerReady")}
          </span>
        </div>

        <div className="mt-5 rounded-[1.7rem] bg-slate-50/80 p-5 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70">
          <Label
            htmlFor="pos-product-search"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"
          >
            {t("invoiceComposer.searchOrScan")}
          </Label>
          <div className="mt-3 grid gap-3 2xl:grid-cols-[minmax(0,1fr)_minmax(188px,auto)]">
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
              inputClassName="h-13 rounded-[1.15rem] border-slate-200 bg-white pr-4 text-[15px] shadow-[0_14px_28px_-22px_rgba(15,23,42,0.22)] focus-visible:border-primary/40 focus-visible:ring-primary/10 dark:border-slate-700 dark:bg-slate-950 dark:focus-visible:border-primary/40 dark:focus-visible:ring-primary/20"
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
              className="h-13 w-full rounded-[1.15rem] px-6 text-sm font-semibold"
            >
              {t("invoiceComposer.addToCart")}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={shortcutBadgeClassName}>
              {t("invoiceComposer.enterAddsSelection")}
            </span>
            <span className={shortcutBadgeClassName}>
              {t("invoiceComposer.refocusSearch", { key: shortcutMetaLabel })}
            </span>
            <span className={shortcutBadgeClassName}>
              {t("invoiceComposer.quickProductShortcut", {
                key: shortcutMetaLabel,
              })}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 2xl:grid-cols-2">
          <div className="rounded-[1.45rem] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:ring-slate-700/70">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("invoiceComposer.readyState")}
            </p>
            <div className="mt-3">
              <p className="text-base font-semibold text-slate-950 dark:text-slate-100">
                {quickEntryProduct?.name ?? t("invoiceComposer.waitingForScan")}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {quickEntryProduct
                  ? t("invoiceComposer.unitPrice", {
                      price: formatCurrency(Number(quickEntryProduct.price)),
                    })
                  : t("invoiceComposer.keepCursorReady")}
              </p>
            </div>
          </div>

          <div className="rounded-[1.45rem] bg-white p-4 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:ring-slate-700/70">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("invoiceComposer.cartVolume")}
            </p>
            <div className="mt-3 flex flex-col gap-3">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
                  {itemCount}
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {t("invoiceComposer.totalUnits")}
                </p>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                <Sparkles size={14} />
                <span>{t("invoiceComposer.liveTotals")}</span>
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
          "rounded-[2.05rem] border border-slate-200 bg-white/95 p-5 shadow-[0_26px_58px_-38px_rgba(15,23,42,0.22)] transition-[box-shadow,border-color,transform] dark:border-slate-700 dark:bg-slate-900/90 dark:shadow-[0_24px_55px_-36px_rgba(0,0,0,0.48)]",
          itemsHighlighted && "border-primary/40 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]",
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
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t("invoiceComposer.cartDescription")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {t("invoiceComposer.lineItems", {
                count: formatNumber(items.length),
              })}
            </span>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">
              {t("invoiceComposer.removeSelectedShortcut", {
                key: shortcutMetaLabel,
              })}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-5 rounded-[1.75rem] bg-slate-50/80 px-6 py-10 text-center ring-1 ring-dashed ring-slate-300 dark:bg-slate-900/50 dark:ring-slate-700">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-primary shadow-sm dark:bg-slate-950">
              <ShoppingCart size={24} />
            </div>
            <p className="mt-4 text-lg font-semibold text-slate-950 dark:text-slate-100">
              {t("invoiceComposer.emptyCartTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
              {t("invoiceComposer.emptyCartDescription")}
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
                    "rounded-[1.55rem] border p-4 transition-[box-shadow,border-color,transform] duration-200",
                    isSelected
                      ? "border-primary/45 bg-primary/5 shadow-[0_0_0_4px_rgba(37,99,235,0.08)] dark:border-primary/40 dark:bg-primary/10"
                      : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_16px_32px_-28px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-950/60",
                    isRecent && "animate-in fade-in zoom-in-95",
                  )}
                  onClick={() => onSelectItem(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-base font-semibold text-slate-950 dark:text-slate-100">
                          {item.name || t("invoiceComposer.itemFallback")}
                        </p>
                        {isRecent ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-100">
                            {t("invoiceComposer.recentlyAdded")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {item.tax_rate
                          ? `GST ${item.tax_rate}%`
                          : t("invoiceComposer.noGst")}{" "}
                        |{" "}
                        {t("invoiceComposer.lineNumber", {
                          number: formatNumber(index + 1),
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-full text-slate-500 hover:text-red-600"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveItem(index);
                      }}
                      aria-label={t("invoiceComposer.removeItemAria", {
                        name: item.name || t("invoiceComposer.itemFallback"),
                      })}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(170px,auto)] lg:items-end">
                    <div className="grid gap-3 md:grid-cols-[minmax(150px,0.7fr)_minmax(220px,1fr)]">
                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {t("invoiceComposer.unitPriceLabel")}
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
                          className="h-11 rounded-[1rem] border-slate-200 bg-white shadow-sm focus-visible:ring-primary/15 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:ring-primary/20"
                        />
                        {errors[index]?.price ? (
                          <p className="text-xs text-red-600 dark:text-red-300">
                            {errors[index]?.price}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {t("invoiceComposer.quantityLabel")}
                        </Label>
                        <div className="flex min-w-0 items-center gap-2">
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
                            className="h-9 w-20 flex-none rounded-xl border-slate-200 bg-white px-2 text-center text-base font-semibold shadow-sm focus-visible:ring-primary/15 dark:border-slate-700 dark:bg-slate-900 dark:focus-visible:ring-primary/20"
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

                    <div className="rounded-[1.35rem] bg-slate-50/80 px-4 py-3 text-left ring-1 ring-slate-200/80 lg:text-right dark:bg-slate-900/70 dark:ring-slate-700/70">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {t("invoiceComposer.lineSubtotal")}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">
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
