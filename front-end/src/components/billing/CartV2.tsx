"use client";

import type { MutableRefObject } from "react";
import { Package2 } from "lucide-react";
import ProductRow from "@/components/billing/simple-bill/ProductRow";
import ProductSearch from "@/components/billing/simple-bill/ProductSearch";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/apiClient";

type CartItem = {
  id: string;
  productId?: number;
  name: string;
  quantity: string;
  price: string;
  gstRate: string;
  gstType: "CGST_SGST" | "IGST";
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
  productsLoading: boolean;
  productsError: boolean;
  allowNegativeStock: boolean;
  productSearchOpen: boolean;
  productSearchFocusToken: number;
  shortcutActiveItemId: string | null;
  itemQuantityRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  itemPriceRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onProductSearchOpenChange: (open: boolean) => void;
  onRetryProducts: () => void;
  onAddProduct: (product: Product) => void;
  onAddManualItem: (item: { name: string; quantity: number; price: number }) => void;
  updateItem: (id: string, patch: Partial<CartItem>) => void;
  removeItem: (id: string) => void;
  adjustItemQuantity: (id: string, delta: number) => void;
  commitItemQuantity: (id: string) => void;
  formatMoney: (amount: number) => string;
  onFocusPrimaryItem: () => void;
  onShortcutActiveItemChange: (itemId: string) => void;
};

export default function CartV2({
  isHindi,
  items,
  products,
  productsLoading,
  productsError,
  allowNegativeStock,
  productSearchOpen,
  productSearchFocusToken,
  shortcutActiveItemId,
  itemQuantityRefs,
  itemPriceRefs,
  onProductSearchOpenChange,
  onRetryProducts,
  onAddProduct,
  onAddManualItem,
  updateItem,
  removeItem,
  adjustItemQuantity,
  commitItemQuantity,
  formatMoney,
  onFocusPrimaryItem,
  onShortcutActiveItemChange,
}: CartV2Props) {
  const activeItems = items.filter(
    (item) => item.name.trim() || item.price.trim() || item.productId,
  );
  const activeItemCount = activeItems.length;
  const hasCartItems = activeItems.length > 0;
  const subtotal = activeItems.reduce((sum, item) => {
    const quantity = Number(item.quantity);
    const price = Number(item.price);

    return (
      sum +
      Math.max(0, Number.isFinite(quantity) ? quantity : 0) *
        Math.max(0, Number.isFinite(price) ? price : 0)
    );
  }, 0);

  return (
    <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-border/65 bg-background/95 shadow-sm">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-3 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {isHindi ? "वर्तमान बिल" : "Current Bill"}
            </p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isHindi
                ? `${activeItemCount} आइटम`
                : `${activeItemCount} ${activeItemCount === 1 ? "item" : "items"}`}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isHindi
              ? "प्रोडक्ट जोड़ें, मात्रा बदलें, और कुल राशि तुरंत देखें."
              : "Add products, edit quantity and price, and keep totals in sync."}
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
              {isHindi ? "अभी तक कोई प्रोडक्ट नहीं जोड़ा गया" : "No products added yet"}
            </p>
            <p className="text-sm text-muted-foreground">
              {isHindi
                ? "प्रोडक्ट खोजें, बारकोड स्कैन करें, या मैनुअल आइटम जोड़कर बिल बनाना शुरू करें."
                : "Search products, scan a barcode, or add a manual item to start billing."}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={onFocusPrimaryItem}>
            {isHindi ? "प्रोडक्ट खोज खोलें" : "Focus product search"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isHindi ? "लाइव बिल सारांश" : "Live bill summary"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHindi
                  ? "मात्रा और कीमत बदलते ही कुल राशि तुरंत अपडेट होती है."
                  : "Totals update instantly as quantity and price change."}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {isHindi ? "सबटोटल" : "Subtotal"}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {formatMoney(subtotal)}
              </p>
            </div>
          </div>

          {activeItems.map((item) => {
            const matchedProduct =
              item.productId
                ? products.find((product) => product.id === item.productId) ?? null
                : null;

            return (
              <ProductRow
                key={item.id}
                isHindi={isHindi}
                item={item}
                matchedProduct={matchedProduct}
                allowNegativeStock={allowNegativeStock}
                isShortcutActive={shortcutActiveItemId === item.id}
                quantityInputRef={(node) =>
                  assignItemInputRef(itemQuantityRefs, item.id, node)
                }
                priceInputRef={(node) =>
                  assignItemInputRef(itemPriceRefs, item.id, node)
                }
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onAdjustQuantity={adjustItemQuantity}
                onCommitQuantity={commitItemQuantity}
                formatMoney={formatMoney}
                onActivate={onShortcutActiveItemChange}
              />
            );
          })}
        </div>
      )}

      <ProductSearch
        key={productSearchFocusToken}
        open={productSearchOpen}
        isHindi={isHindi}
        products={products}
        productsLoading={productsLoading}
        productsError={productsError}
        onOpenChange={onProductSearchOpenChange}
        onRetryProducts={onRetryProducts}
        onAddProduct={onAddProduct}
        onAddManualItem={onAddManualItem}
      />
    </div>
  );
}
