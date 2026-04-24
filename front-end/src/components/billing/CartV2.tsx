"use client";

import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import { CopyPlus, Minus, Package2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Product } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type CartItem = {
  id: string;
  productId?: number;
  name: string;
  quantity: string;
  price: string;
  gstRate: string;
  gstType: "CGST_SGST" | "IGST";
};

type StockTone = "emerald" | "amber" | "rose" | "slate";

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const;

const stockToneClasses: Record<StockTone, string> = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200",
  slate:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
};

const stockDotClasses: Record<StockTone, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

const sanitizeDecimalInput = (value: string) => value.replace(/[^\d.]/g, "");

const toAmount = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const toQuantity = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(1, numberValue) : 1;
};

const toGstRate = (value: string) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0;
};

const normalizeGstType = (
  value: string | null | undefined,
): "CGST_SGST" | "IGST" => (value === "IGST" ? "IGST" : "CGST_SGST");

const getMatchedProduct = (item: CartItem, products: Product[]) => {
  if (item.productId) {
    return products.find((product) => product.id === item.productId) ?? null;
  }

  const normalizedName = item.name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return (
    products.find(
      (product) => product.name.trim().toLowerCase() === normalizedName,
    ) ?? null
  );
};

const getStockDescriptor = (
  product: Product | null,
  requestedQuantity: number,
  isHindi: boolean,
) => {
  if (!product) {
    return {
      label: isHindi ? "कस्टम" : "Custom",
      tone: "slate" as const,
      helper: null,
      stockText: isHindi ? "स्टॉक: --" : "Stock: --",
    };
  }

  const stock = Number(product.stock_on_hand) || 0;
  const reorderLevel = Number(product.reorder_level) || 0;

  if (stock <= 0) {
    return {
      label: isHindi ? "स्टॉक खत्म" : "Out of Stock",
      tone: "rose" as const,
      helper: isHindi ? "मांग स्टॉक से ऊपर है" : "Qty above stock",
      stockText: isHindi ? "स्टॉक: 0" : "Stock: 0",
    };
  }

  if (requestedQuantity > stock || stock <= reorderLevel) {
    return {
      label: isHindi ? "लो स्टॉक" : "Low Stock",
      tone: "amber" as const,
      helper:
        requestedQuantity > stock
          ? isHindi
            ? "मांग स्टॉक से ऊपर है"
            : "Qty above stock"
          : isHindi
            ? "रीऑर्डर के करीब"
            : "Near reorder",
      stockText: `${isHindi ? "स्टॉक" : "Stock"}: ${stock}`,
    };
  }

  return {
    label: isHindi ? "इन स्टॉक" : "In Stock",
    tone: "emerald" as const,
    helper: null,
    stockText: `${isHindi ? "स्टॉक" : "Stock"}: ${stock}`,
  };
};

const assignItemInputRef = (
  refs: MutableRefObject<Record<string, HTMLInputElement | null>>,
  id: string,
  node: HTMLInputElement | null,
) => {
  refs.current[id] = node;
};

export type CartV2Props = {
  isHindi: boolean;
  items: CartItem[];
  products: Product[];
  gstEnabled: boolean;
  focusedItemId: string | null;
  setFocusedItemId: Dispatch<SetStateAction<string | null>>;
  getProductSuggestions: (query: string) => Product[];
  itemNameRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  itemQuantityRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  itemPriceRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  handleItemNameChange: (itemId: string, value: string) => void;
  selectProductForItem: (itemId: string, product: Product) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  adjustItemQuantity: (id: string, delta: number) => void;
  addOneMoreItem: (id: string) => void;
  addItemAfter: (afterId?: string) => void;
  formatMoney: (amount: number) => string;
  onFocusPrimaryItem: () => void;
};

export default function CartV2({
  isHindi,
  items,
  products,
  gstEnabled,
  focusedItemId,
  setFocusedItemId,
  getProductSuggestions,
  itemNameRefs,
  itemQuantityRefs,
  itemPriceRefs,
  handleItemNameChange,
  selectProductForItem,
  updateItem,
  removeItem,
  adjustItemQuantity,
  addOneMoreItem,
  addItemAfter,
  formatMoney,
  onFocusPrimaryItem,
}: CartV2Props) {
  const activeItemCount = items.filter(
    (item) => item.name.trim() || item.price.trim() || item.productId,
  ).length;
  const hasCartItems = activeItemCount > 0;
  const itemCountLabel = `${activeItemCount} ${activeItemCount === 1 ? "item" : "items"}`;

  return (
    <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-border/65 bg-background/95 shadow-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {isHindi ? "वर्तमान बिल" : "Current Bill"}
            </p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isHindi ? `${activeItemCount} आइटम` : itemCountLabel}
            </span>
            <span className="rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Ctrl + Delete
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isHindi
              ? "मात्रा बदलें, लाइन हटाएँ, और बिल जल्दी पूरा करें।"
              : "Adjust lines inline and keep billing fast."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs font-medium"
          onClick={onFocusPrimaryItem}
        >
          {isHindi ? "प्रोडक्ट जोड़ें" : "Add product"}
        </Button>
      </div>

      {!hasCartItems ? (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/30 text-muted-foreground">
            <Package2 size={20} />
          </div>
          <div className="grid gap-1">
            <p className="text-sm font-semibold text-foreground">
              {isHindi ? "अभी कोई आइटम नहीं है" : "No items added"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isHindi
                ? "शुरू करने के लिए स्कैन करें या प्रोडक्ट खोजें"
                : "Scan or search product to start"}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onFocusPrimaryItem}>
            {isHindi ? "प्रोडक्ट सर्च खोलें" : "Focus product search"}
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {items.map((item, index) => {
            const matchedProduct = getMatchedProduct(item, products);
            const safeQuantity =
              item.quantity.trim() === ""
                ? 0
                : Number.isFinite(Number(item.quantity))
                  ? Number(item.quantity)
                  : toQuantity(item.quantity);
            const requestedQuantity = Math.max(0, safeQuantity);
            const unitPrice = Math.max(0, toAmount(item.price));
            const gstRate = gstEnabled ? toGstRate(item.gstRate) : 0;
            const lineBaseAmount = requestedQuantity * unitPrice;
            const lineGstAmount =
              gstEnabled ? (lineBaseAmount * gstRate) / 100 : 0;
            const lineTotal = lineBaseAmount + lineGstAmount;
            const stock = getStockDescriptor(
              matchedProduct,
              requestedQuantity,
              isHindi,
            );
            const suggestions = getProductSuggestions(item.name);
            const hasExactProductMatch = products.some(
              (product) =>
                product.name.toLowerCase() === item.name.trim().toLowerCase(),
            );

            return (
              <div
                key={item.id}
                className="group px-3 py-2.5 transition-colors hover:bg-muted/10 focus-within:bg-muted/15"
              >
                <div className="grid gap-2.5 md:grid-cols-[minmax(0,1.6fr)_8.25rem_12rem_8rem_auto] md:items-center">
                  <div className="relative min-w-0">
                    <div className="rounded-lg border border-border/60 bg-background/75 px-3 py-2 shadow-sm shadow-black/[0.02]">
                      <Input
                        id={`simple-item-${item.id}`}
                        ref={(node) =>
                          assignItemInputRef(itemNameRefs, item.id, node)
                        }
                        value={item.name}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => {
                          window.setTimeout(() => {
                            setFocusedItemId((current) =>
                              current === item.id ? null : current,
                            );
                          }, 120);
                        }}
                        onChange={(event) =>
                          handleItemNameChange(item.id, event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (
                            (event.ctrlKey || event.metaKey) &&
                            event.key === "Delete"
                          ) {
                            event.preventDefault();
                            removeItem(item.id);
                            return;
                          }

                          if (event.key === "Enter") {
                            event.preventDefault();
                            itemQuantityRefs.current[item.id]?.focus();
                          }
                        }}
                        className="h-auto border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0"
                        placeholder={
                          index === 0
                            ? isHindi
                              ? "प्रोडक्ट खोजें या नाम लिखें"
                              : "Search or type product"
                            : isHindi
                              ? "प्रोडक्ट नाम"
                              : "Product name"
                        }
                      />

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>GST {gstRate}%</span>
                        <span>&bull;</span>
                        <span>{stock.stockText}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold",
                            stockToneClasses[stock.tone],
                          )}
                        >
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              stockDotClasses[stock.tone],
                            )}
                          />
                          {stock.label}
                        </span>
                        {stock.helper ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                            {stock.helper}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {focusedItemId === item.id ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 overflow-hidden rounded-xl bg-popover shadow-[0_22px_50px_-30px_rgba(15,23,42,0.65)] ring-1 ring-border/70">
                        {suggestions.length > 0 ? (
                          suggestions.map((product) => (
                            <button
                              key={product.id}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-accent/70"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                selectProductForItem(item.id, product);
                                window.setTimeout(
                                  () =>
                                    itemQuantityRefs.current[item.id]?.focus(),
                                  0,
                                );
                              }}
                            >
                              <span className="font-semibold text-foreground">
                                {product.name}
                              </span>
                              <span className="text-muted-foreground">
                                {formatMoney(Number(product.price) || 0)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <p className="px-3 py-2.5 text-sm text-muted-foreground">
                            {isHindi
                              ? "कोई सेव प्रोडक्ट नहीं मिला"
                              : "No saved product found"}
                          </p>
                        )}
                        {item.name.trim() && !hasExactProductMatch ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 border-t border-border/60 px-3 py-2.5 text-left text-sm font-semibold text-primary transition hover:bg-primary/5"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              updateItem(item.id, {
                                name: item.name.trim(),
                                productId: undefined,
                              });
                              itemQuantityRefs.current[item.id]?.focus();
                            }}
                          >
                            <Plus size={16} />
                            {isHindi
                              ? `"${item.name.trim()}" जोड़ें`
                              : `Add "${item.name.trim()}"`}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-1">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
                      onClick={() => adjustItemQuantity(item.id, -1)}
                      aria-label={isHindi ? "मात्रा कम करें" : "Decrease quantity"}
                    >
                      <Minus size={14} />
                    </button>
                    <Input
                      id={`simple-qty-${item.id}`}
                      ref={(node) =>
                        assignItemInputRef(itemQuantityRefs, item.id, node)
                      }
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(item.id, {
                          quantity: sanitizeDecimalInput(event.target.value),
                        })
                      }
                      onFocus={(event) => event.target.select()}
                      onBlur={() => {
                        const nextQuantity = Number(item.quantity);
                        if (!Number.isFinite(nextQuantity)) {
                          updateItem(item.id, { quantity: "1" });
                          return;
                        }

                        if (nextQuantity <= 0) {
                          removeItem(item.id);
                          return;
                        }

                        updateItem(item.id, { quantity: String(nextQuantity) });
                      }}
                      onKeyDown={(event) => {
                        if (
                          (event.ctrlKey || event.metaKey) &&
                          event.key === "Delete"
                        ) {
                          event.preventDefault();
                          removeItem(item.id);
                          return;
                        }

                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          adjustItemQuantity(item.id, 1);
                          return;
                        }

                        if (event.key === "ArrowDown") {
                          event.preventDefault();
                          adjustItemQuantity(item.id, -1);
                          return;
                        }

                        if (event.key === "Enter") {
                          event.preventDefault();
                          const nextQuantity = Number(item.quantity);
                          if (Number.isFinite(nextQuantity) && nextQuantity <= 0) {
                            removeItem(item.id);
                            return;
                          }

                          itemPriceRefs.current[item.id]?.focus();
                        }
                      }}
                      className="h-7 w-12 border-0 bg-transparent px-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
                      onClick={() => adjustItemQuantity(item.id, 1)}
                      aria-label={isHindi ? "मात्रा बढ़ाएँ" : "Increase quantity"}
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-background/75 px-2.5 py-2">
                    <div className="flex items-center justify-end gap-1 text-sm">
                      <span className="text-muted-foreground">₹</span>
                      <Input
                        id={`simple-price-${item.id}`}
                        ref={(node) =>
                          assignItemInputRef(itemPriceRefs, item.id, node)
                        }
                        value={item.price}
                        onChange={(event) =>
                          updateItem(item.id, {
                            price: sanitizeDecimalInput(event.target.value),
                          })
                        }
                        onFocus={(event) => event.target.select()}
                        onKeyDown={(event) => {
                          if (
                            (event.ctrlKey || event.metaKey) &&
                            event.key === "Delete"
                          ) {
                            event.preventDefault();
                            removeItem(item.id);
                            return;
                          }

                          if (event.key === "Enter") {
                            event.preventDefault();
                            addItemAfter(item.id);
                          }
                        }}
                        className="h-auto w-24 border-0 bg-transparent px-0 py-0 text-right text-sm font-medium shadow-none focus-visible:ring-0"
                        inputMode="decimal"
                        placeholder={isHindi ? "यूनिट प्राइस" : "Unit price"}
                        aria-label={isHindi ? "यूनिट प्राइस" : "Unit price"}
                      />
                      <span className="whitespace-nowrap text-muted-foreground">
                        × {requestedQuantity > 0 ? requestedQuantity : 0}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-base font-semibold text-foreground">
                      {formatMoney(lineTotal)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {gstEnabled
                        ? `${formatMoney(lineGstAmount)} GST`
                        : isHindi
                          ? "GST बंद"
                          : "GST off"}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label={isHindi ? "एक और जोड़ें" : "Add one more"}
                      onClick={() => addOneMoreItem(item.id)}
                    >
                      <CopyPlus size={15} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full text-muted-foreground hover:text-rose-600"
                      aria-label={isHindi ? "आइटम हटाएँ" : "Remove item"}
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
                  <select
                    id={`simple-gst-type-${item.id}`}
                    value={item.gstType}
                    disabled={!gstEnabled}
                    onChange={(event) =>
                      updateItem(item.id, {
                        gstType: normalizeGstType(event.target.value),
                      })
                    }
                    className="h-7 rounded-md border border-input bg-background px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="GST type"
                  >
                    <option value="CGST_SGST">CGST + SGST</option>
                    <option value="IGST">IGST</option>
                  </select>

                  <select
                    id={`simple-gst-rate-${item.id}`}
                    value={item.gstRate}
                    disabled={!gstEnabled}
                    onChange={(event) =>
                      updateItem(item.id, { gstRate: event.target.value })
                    }
                    className="h-7 rounded-md border border-input bg-background px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="GST rate"
                  >
                    {GST_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>
                        GST {rate}%
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="ml-auto text-[11px] font-semibold text-primary transition hover:opacity-80"
                    onClick={() => addItemAfter(item.id)}
                  >
                    {isHindi ? "नीचे नया आइटम जोड़ें" : "Add next line"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
