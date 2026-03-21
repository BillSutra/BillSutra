"use client";

import React from "react";
import AsyncProductSelect, {
  type AsyncProductSelectHandle,
} from "@/components/products/AsyncProductSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/apiClient";
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
  onProductSelect: (index: number, product: Product | null) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
};

const shortcutBadgeClassName =
  "rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

const InvoiceTable = ({
  items,
  errors,
  quickEntryProduct,
  quickEntryRef,
  autoFocusProductSearch = false,
  selectedItemIndex = null,
  shortcutMetaLabel,
  entryHighlighted = false,
  itemsHighlighted = false,
  onQuickEntrySelect,
  onQuickEntrySubmit,
  onSelectItem,
  onItemChange,
  onProductSelect,
  onAddItem,
  onRemoveItem,
}: InvoiceTableProps) => {
  const { t } = useI18n();

  return (
    <div className="mt-6 grid gap-4">
      <section
        className={cn(
          "rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm transition-[box-shadow,border-color,transform] dark:border-amber-900/40 dark:bg-amber-950/20",
          entryHighlighted &&
            "border-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]",
        )}
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700 dark:text-amber-200">
              Scan lane
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Scan or search to add
            </h2>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
              Barcode input stays ready here. Press Enter to add the product
              instantly, and duplicate scans increase quantity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={shortcutBadgeClassName}>Enter add item</span>
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+Q focus scan
            </span>
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+P new product
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <AsyncProductSelect
            ref={quickEntryRef}
            value={quickEntryProduct ? String(quickEntryProduct.id) : ""}
            selectedLabel={quickEntryProduct?.name ?? ""}
            autoFocus={autoFocusProductSearch}
            onSelect={onQuickEntrySelect}
            onSubmitSelection={(candidate) =>
              onQuickEntrySubmit(candidate ?? quickEntryProduct)
            }
            placeholder="Scan barcode or search products"
          />
          <Button
            type="button"
            onClick={() => onQuickEntrySubmit(quickEntryProduct)}
            className="h-10 rounded-xl px-5"
          >
            Add to bill
          </Button>
        </div>
      </section>

      <section
        className={cn(
          "rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color,transform] dark:border-gray-700 dark:bg-gray-800",
          itemsHighlighted &&
            "border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.14)]",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-gray-500">
              {t("invoiceTable.lineItems")}
            </p>
            <h2 className="mt-2 text-lg font-semibold">
              {t("invoiceTable.invoiceItems")}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={shortcutBadgeClassName}>
              {shortcutMetaLabel}+Delete remove selected
            </span>
            <Button type="button" variant="outline" onClick={onAddItem}>
              {t("invoiceTable.addItem")}
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/70 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            No items in this bill yet. Use the scan lane above or add a manual
            line item.
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((item, index) => {
              const excludedProductIds = items
                .filter(
                  (selectedItem, selectedIndex) =>
                    selectedIndex !== index && Boolean(selectedItem.product_id),
                )
                .map((selectedItem) => selectedItem.product_id);

              return (
                <div
                  key={`item-${index}`}
                  className={cn(
                    "grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-[box-shadow,border-color,transform] dark:border-gray-700 dark:bg-gray-800",
                    selectedItemIndex === index &&
                      "border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.12)]",
                  )}
                  onClick={() => onSelectItem(index)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {t("invoiceTable.product")}
                      </Label>
                      <AsyncProductSelect
                        value={item.product_id}
                        selectedLabel={item.name}
                        onSelect={(product) => onProductSelect(index, product)}
                        excludeProductIds={excludedProductIds}
                      />
                      {errors[index]?.product_id ? (
                        <p className="text-xs text-red-600 dark:text-red-300">
                          {errors[index]?.product_id}
                        </p>
                      ) : null}
                    </div>
                    <span className={shortcutBadgeClassName}>
                      {selectedItemIndex === index ? "Selected" : `Line ${index + 1}`}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {t("invoiceTable.quantity")}
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onFocus={() => onSelectItem(index)}
                        onChange={(event) =>
                          onItemChange(index, "quantity", event.target.value)
                        }
                        className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                      />
                      {errors[index]?.quantity ? (
                        <p className="text-xs text-red-600 dark:text-red-300">
                          {errors[index]?.quantity}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {t("invoiceTable.price")}
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
                        className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                      />
                      {errors[index]?.price ? (
                        <p className="text-xs text-red-600 dark:text-red-300">
                          {errors[index]?.price}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                        {t("invoiceTable.gstRate")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.tax_rate}
                        onFocus={() => onSelectItem(index)}
                        onChange={(event) =>
                          onItemChange(index, "tax_rate", event.target.value)
                        }
                        className="h-10 rounded-xl border-gray-200 bg-white shadow-sm focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus-visible:ring-indigo-500/20"
                      />
                      {errors[index]?.tax_rate ? (
                        <p className="text-xs text-red-600 dark:text-red-300">
                          {errors[index]?.tax_rate}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveItem(index);
                      }}
                      className="h-10 w-full sm:w-auto"
                    >
                      {t("invoiceTable.remove")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default InvoiceTable;
