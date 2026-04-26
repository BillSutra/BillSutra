"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const sanitizeDecimalInput = (value: string) => value.replace(/[^\d.]/g, "");

const toAmount = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const toQuantity = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

type CartItem = {
  id: string;
  productId?: number;
  name: string;
  quantity: string;
  price: string;
  gstRate: string;
  gstType: "CGST_SGST" | "IGST";
};

type ProductRowProps = {
  isHindi: boolean;
  item: CartItem;
  matchedProduct: Product | null;
  allowNegativeStock: boolean;
  gstEnabled: boolean;
  isShortcutActive: boolean;
  quantityInputRef: (node: HTMLInputElement | null) => void;
  priceInputRef: (node: HTMLInputElement | null) => void;
  onUpdateItem: (id: string, patch: Partial<CartItem>) => void;
  onRemoveItem: (id: string) => void;
  onAdjustQuantity: (id: string, delta: number) => void;
  onCommitQuantity: (id: string) => void;
  formatMoney: (amount: number) => string;
  onActivate: (id: string) => void;
};

export default function ProductRow({
  isHindi,
  item,
  matchedProduct,
  allowNegativeStock,
  gstEnabled,
  isShortcutActive,
  quantityInputRef,
  priceInputRef,
  onUpdateItem,
  onRemoveItem,
  onAdjustQuantity,
  onCommitQuantity,
  formatMoney,
  onActivate,
}: ProductRowProps) {
  const quantityValue = toQuantity(item.quantity);
  const priceValue = toAmount(item.price);
  const gstRateValue = gstEnabled ? toAmount(item.gstRate) : 0;
  const lineSubtotal = quantityValue * priceValue;
  const lineTax = gstEnabled ? (lineSubtotal * gstRateValue) / 100 : 0;
  const lineTotal = lineSubtotal + lineTax;
  const stockOnHand =
    matchedProduct && Number.isFinite(Number(matchedProduct.stock_on_hand))
      ? Number(matchedProduct.stock_on_hand)
      : null;
  const stockExceeded =
    Boolean(matchedProduct) &&
    !allowNegativeStock &&
    stockOnHand !== null &&
    quantityValue > stockOnHand;

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm shadow-black/[0.02] transition-colors",
        isShortcutActive &&
          "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_rgba(59,130,246,0.16)]",
      )}
      onMouseDownCapture={() => onActivate(item.id)}
      onFocusCapture={() => onActivate(item.id)}
    >
      <div
        className={cn(
          "hidden items-center gap-3 px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground md:grid",
          gstEnabled
            ? "md:grid-cols-[minmax(0,1.7fr)_9rem_10rem_7rem_9rem_auto]"
            : "md:grid-cols-[minmax(0,1.8fr)_9rem_10rem_9rem_auto]",
        )}
      >
        <span>{isHindi ? "Product" : "Product"}</span>
        <span className="text-center">{isHindi ? "Qty" : "Qty"}</span>
        <span className="text-right">{isHindi ? "Price" : "Price"}</span>
        {gstEnabled ? <span className="text-right">GST %</span> : null}
        <span className="text-right">{isHindi ? "Line total" : "Line total"}</span>
        <span className="text-right">{isHindi ? "Remove" : "Remove"}</span>
      </div>

      <div
        className={cn(
          "grid gap-3 md:items-center",
          gstEnabled
            ? "md:grid-cols-[minmax(0,1.7fr)_9rem_10rem_7rem_9rem_auto]"
            : "md:grid-cols-[minmax(0,1.8fr)_9rem_10rem_9rem_auto]",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {item.name}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                item.productId
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.productId
                ? isHindi
                  ? "Saved product"
                  : "Saved product"
                : isHindi
                  ? "Custom item"
                  : "Custom item"}
            </span>
            {matchedProduct && stockOnHand !== null ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  stockOnHand <= 0
                    ? "bg-rose-100 text-rose-700"
                    : stockExceeded
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700",
                )}
              >
                {stockOnHand <= 0
                  ? isHindi
                    ? "Out of stock"
                    : "Out of stock"
                  : isHindi
                    ? `Stock ${stockOnHand}`
                    : `Stock ${stockOnHand}`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {matchedProduct
              ? [matchedProduct.sku, matchedProduct.barcode].filter(Boolean).join(" | ") ||
                (isHindi ? "SKU not available" : "SKU not available")
              : isHindi
                ? "Manual entry"
                : "Manual entry"}
          </p>
          {stockExceeded ? (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {isHindi
                ? `Only ${stockOnHand} in stock. Reduce quantity before generating the bill.`
                : `Only ${stockOnHand} in stock. Reduce quantity before generating the bill.`}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
            onClick={() => onAdjustQuantity(item.id, -1)}
            aria-label={isHindi ? "Decrease quantity" : "Decrease quantity"}
          >
            <Minus size={14} />
          </button>
          <Input
            ref={quantityInputRef}
            value={item.quantity}
            onChange={(event) =>
              onUpdateItem(item.id, {
                quantity: sanitizeDecimalInput(event.target.value),
              })
            }
            onBlur={() => onCommitQuantity(item.id)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                onAdjustQuantity(item.id, 1);
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                onAdjustQuantity(item.id, -1);
              }
            }}
            className="h-8 w-14 border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
            inputMode="decimal"
            aria-label={isHindi ? "Quantity" : "Quantity"}
          />
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
            onClick={() => onAdjustQuantity(item.id, 1)}
            aria-label={isHindi ? "Increase quantity" : "Increase quantity"}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
          <div className="flex items-center justify-end gap-1">
            <span className="text-sm text-muted-foreground">Rs</span>
            <Input
              ref={priceInputRef}
              value={item.price}
              onChange={(event) =>
                onUpdateItem(item.id, {
                  price: sanitizeDecimalInput(event.target.value),
                })
              }
              onBlur={() => {
                if (!item.price.trim()) {
                  onUpdateItem(item.id, { price: "0" });
                }
              }}
              onFocus={(event) => event.target.select()}
              className="h-auto w-24 border-0 bg-transparent px-0 py-0 text-right text-sm font-medium shadow-none focus-visible:ring-0"
              inputMode="decimal"
              placeholder="0.00"
              aria-label={isHindi ? "Price" : "Price"}
            />
          </div>
        </div>

        {gstEnabled ? (
          <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
            <div className="flex items-center justify-end gap-1">
              <Input
                value={item.gstRate}
                onChange={(event) =>
                  onUpdateItem(item.id, {
                    gstRate: sanitizeDecimalInput(event.target.value),
                  })
                }
                onBlur={() => {
                  if (!item.gstRate.trim()) {
                    onUpdateItem(item.id, { gstRate: "0" });
                  }
                }}
                onFocus={(event) => event.target.select()}
                className="h-auto w-16 border-0 bg-transparent px-0 py-0 text-right text-sm font-medium shadow-none focus-visible:ring-0"
                inputMode="decimal"
                placeholder="0"
                aria-label="GST percentage"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>
        ) : null}

        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{formatMoney(lineTotal)}</p>
          <p className="text-[11px] text-muted-foreground">
            {gstEnabled
              ? `${formatMoney(lineSubtotal)} + ${formatMoney(lineTax)} GST`
              : isHindi
                ? "Quantity x price"
                : "Quantity x price"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-rose-600"
            aria-label={isHindi ? "Remove item" : "Remove item"}
            onClick={() => onRemoveItem(item.id)}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
