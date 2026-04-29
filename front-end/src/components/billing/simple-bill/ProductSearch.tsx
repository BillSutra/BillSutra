"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Package2, Search, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import { useProductSearchQuery } from "@/hooks/useInventoryQueries";
import type { Product } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

const sanitizeDecimalInput = (value: string) => value.replace(/[^\d.]/g, "");
const MAX_ALLOWED_PRICE = 1_000_000;
const MAX_MANUAL_QUANTITY = 10_000;
const ALLOWED_GST_RATES = [0, 5, 12, 18, 28] as const;

const normalizeComparableText = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "";

const normalizeProductName = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

const hasMeaningfulProductName = (value: string) => /[\p{L}\p{N}]/u.test(value);

const isBarcodeLikeQuery = (value: string) => {
  const normalized = value.trim();
  return (
    normalized.length >= 4 &&
    !/\s/.test(normalized) &&
    /\d/.test(normalized) &&
    /^[a-z0-9._/-]+$/i.test(normalized)
  );
};

const canSearchProducts = (value: string) => {
  const normalized = value.trim();
  return normalized.length >= 2 || isBarcodeLikeQuery(normalized);
};

const resolveExactMatch = (products: Product[], query: string) => {
  const normalizedQuery = normalizeComparableText(query);
  if (!normalizedQuery) {
    return null;
  }

  return (
    products.find((product) =>
      [product.name, product.sku, product.barcode].some(
        (value) => normalizeComparableText(value) === normalizedQuery,
      ),
    ) ?? null
  );
};

type ManualItemInput = {
  name: string;
  quantity: number;
  price: number;
};

type QuickCreateProductInput = {
  name: string;
  price: number;
  gstRate: number;
};

type QuickCreateValidationResult = {
  valid: boolean;
  error: string;
  normalizedName: string;
  normalizedPrice: number;
  normalizedGstRate: number;
};

type ManualItemValidationResult = {
  valid: boolean;
  error: string;
  fallbackName: string;
  quantity: number;
  price: number;
};

type ProductSearchProps = {
  open: boolean;
  isHindi: boolean;
  products: Product[];
  productsLoading: boolean;
  productsError: boolean;
  allowNegativeStock: boolean;
  existingItems: Array<{
    productId?: number;
    name: string;
    quantity: string;
  }>;
  onOpenChange: (open: boolean) => void;
  onRetryProducts: () => void;
  onAddProduct: (product: Product) => void;
  onAddManualItem: (item: ManualItemInput) => void;
  onQuickCreateProduct: (item: QuickCreateProductInput) => Promise<void>;
  creatingProduct: boolean;
};

export default function ProductSearch({
  open,
  isHindi,
  products,
  productsLoading,
  productsError,
  allowNegativeStock,
  existingItems,
  onOpenChange,
  onRetryProducts,
  onAddProduct,
  onAddManualItem,
  onQuickCreateProduct,
  creatingProduct,
}: ProductSearchProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const debounceTimeoutRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("1");
  const [manualPrice, setManualPrice] = useState("");
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateName, setQuickCreateName] = useState("");
  const [quickCreatePrice, setQuickCreatePrice] = useState("");
  const [quickCreateGstRate, setQuickCreateGstRate] = useState("0");
  const [quickCreateError, setQuickCreateError] = useState("");
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  const validateManualItem = (
    currentName: string,
    currentQuantity: string,
    currentPrice: string,
    fallbackQuery: string,
  ): ManualItemValidationResult => {
    const fallbackName = normalizeProductName(currentName || fallbackQuery);
    const quantityValue = Number(currentQuantity);
    const priceValue = Number(currentPrice);

    if (!fallbackName) {
      return {
        valid: false,
        error: "Enter an item name.",
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    if (fallbackName.length < 2 || !hasMeaningfulProductName(fallbackName)) {
      return {
        valid: false,
        error: "Enter at least 2 valid characters for the item name.",
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      return {
        valid: false,
        error: "Quantity must be greater than 0.",
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    if (quantityValue > MAX_MANUAL_QUANTITY) {
      return {
        valid: false,
        error: `Quantity cannot exceed ${MAX_MANUAL_QUANTITY}.`,
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      return {
        valid: false,
        error: "Price must be greater than 0.",
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    if (priceValue > MAX_ALLOWED_PRICE) {
      return {
        valid: false,
        error: `Price cannot exceed Rs ${MAX_ALLOWED_PRICE.toLocaleString("en-IN")}.`,
        fallbackName,
        quantity: quantityValue,
        price: priceValue,
      };
    }

    return {
      valid: true,
      error: "",
      fallbackName,
      quantity: quantityValue,
      price: priceValue,
    };
  };

  const validateQuickCreateProduct = (
    currentName: string,
    currentPrice: string,
    currentGstRate: string,
    fallbackQuery: string,
  ): QuickCreateValidationResult => {
    const normalizedName = normalizeProductName(currentName || fallbackQuery);
    const normalizedPrice = Number(currentPrice);
    const normalizedGstRate = Number(currentGstRate || "0");

    if (!normalizedName) {
      return {
        valid: false,
        error: "Enter a product name.",
        normalizedName,
        normalizedPrice,
        normalizedGstRate,
      };
    }

    if (
      normalizedName.length < 2 ||
      !hasMeaningfulProductName(normalizedName)
    ) {
      return {
        valid: false,
        error: "Enter at least 2 valid characters for the product name.",
        normalizedName,
        normalizedPrice,
        normalizedGstRate,
      };
    }

    if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
      return {
        valid: false,
        error: "Enter a valid selling price greater than 0.",
        normalizedName,
        normalizedPrice,
        normalizedGstRate,
      };
    }

    if (normalizedPrice > MAX_ALLOWED_PRICE) {
      return {
        valid: false,
        error: `Selling price cannot exceed Rs ${MAX_ALLOWED_PRICE.toLocaleString("en-IN")}.`,
        normalizedName,
        normalizedPrice,
        normalizedGstRate,
      };
    }

    if (
      !Number.isFinite(normalizedGstRate) ||
      !ALLOWED_GST_RATES.includes(
        normalizedGstRate as (typeof ALLOWED_GST_RATES)[number],
      )
    ) {
      return {
        valid: false,
        error: `GST must be one of ${ALLOWED_GST_RATES.join(", ")}%.`,
        normalizedName,
        normalizedPrice,
        normalizedGstRate,
      };
    }

    return {
      valid: true,
      error: "",
      normalizedName,
      normalizedPrice,
      normalizedGstRate,
    };
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setHighlightedIndex(0);
    setManualError("");
    setQuickCreateError("");

    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = window.setTimeout(() => {
      setDebouncedQuery(value.trim());
    }, 300);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    onOpenChange(nextOpen);
  };

  const resetAndClose = () => {
    if (debounceTimeoutRef.current) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    setQuery("");
    setDebouncedQuery("");
    setHighlightedIndex(0);
    setManualName("");
    setManualQuantity("1");
    setManualPrice("");
    setQuickCreateOpen(false);
    setQuickCreateName("");
    setQuickCreatePrice("");
    setQuickCreateGstRate("0");
    setQuickCreateError("");
    setManualError("");
    onOpenChange(false);
  };

  const addProductAndClose = (product: Product) => {
    onAddProduct(product);
    resetAndClose();
  };

  const handleAddManualItem = () => {
    const validation = validateManualItem(
      manualName,
      manualQuantity,
      manualPrice,
      query,
    );

    if (!validation.valid) {
      setManualError(validation.error);
      return;
    }

    setManualError("");
    onAddManualItem({
      name: validation.fallbackName,
      quantity: validation.quantity,
      price: validation.price,
    });
    resetAndClose();
  };

  const remoteSearchTerm = useMemo(
    () => (canSearchProducts(debouncedQuery) ? debouncedQuery : ""),
    [debouncedQuery],
  );

  const {
    data: searchResults = [],
    isFetching: isSearchingProducts,
    isError: searchError,
  } = useProductSearchQuery(remoteSearchTerm, { limit: 12 });

  const featuredProducts = useMemo(() => products.slice(0, 8), [products]);
  const localFilteredProducts = useMemo(() => {
    const normalizedQuery = normalizeComparableText(debouncedQuery);
    if (!normalizedQuery) {
      return [] as Product[];
    }

    return products
      .filter((product) =>
        [product.name, product.sku, product.barcode].some((value) =>
          normalizeComparableText(value).includes(normalizedQuery),
        ),
      )
      .slice(0, 12);
  }, [debouncedQuery, products]);

  const listedProducts = useMemo(() => {
    if (debouncedQuery) {
      return remoteSearchTerm ? searchResults : localFilteredProducts;
    }

    return featuredProducts;
  }, [debouncedQuery, featuredProducts, localFilteredProducts, remoteSearchTerm, searchResults]);

  const exactMatch = useMemo(
    () => resolveExactMatch([...listedProducts, ...products], query),
    [listedProducts, products, query],
  );
  const normalizedQuery = normalizeComparableText(query);
  const duplicateNamedProduct = useMemo(() => {
    if (!normalizedQuery) {
      return null;
    }

    return (
      [...listedProducts, ...products].find(
        (product) => normalizeComparableText(product.name) === normalizedQuery,
      ) ?? null
    );
  }, [listedProducts, normalizedQuery, products]);
  const canQuickCreateProduct =
    query.trim().length >= 2 &&
    !duplicateNamedProduct &&
    hasMeaningfulProductName(query.trim());
  const selectedProduct =
    exactMatch ??
    listedProducts[
      Math.min(highlightedIndex, Math.max(listedProducts.length - 1, 0))
    ] ??
    null;
  const existingProductQuantity = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }

    return existingItems
      .filter((item) => item.productId === selectedProduct.id)
      .reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
  }, [existingItems, selectedProduct]);
  const selectedProductStock = Number(selectedProduct?.stock_on_hand) || 0;
  const selectedProductWouldExceedStock =
    !!selectedProduct &&
    !allowNegativeStock &&
    selectedProductStock > 0 &&
    existingProductQuantity >= selectedProductStock;
  const selectedProductOutOfStock =
    !!selectedProduct && !allowNegativeStock && selectedProductStock <= 0;
  const blockSelectedProductAdd =
    selectedProductOutOfStock || selectedProductWouldExceedStock;
  const quickCreateValidation = validateQuickCreateProduct(
    quickCreateName,
    quickCreatePrice,
    quickCreateGstRate,
    query,
  );
  const manualValidation = validateManualItem(
    manualName,
    manualQuantity,
    manualPrice,
    query,
  );
  const canAddSelectedProduct =
    Boolean(query.trim()) && Boolean(selectedProduct) && !blockSelectedProductAdd;
  const queryTooShortForRemoteSearch = Boolean(debouncedQuery) && !remoteSearchTerm;

  const openQuickCreatePanel = (nameToUse = query.trim()) => {
    setQuickCreateName(nameToUse);
    setQuickCreatePrice("");
    setQuickCreateGstRate("0");
    setQuickCreateError("");
    setQuickCreateOpen(true);
  };

  const handleSubmitSearch = () => {
    if (!query.trim()) {
      return;
    }

    const candidate = selectedProduct;

    if (candidate) {
      if (blockSelectedProductAdd) {
        toast.error(
          selectedProductOutOfStock
            ? `${candidate.name} is out of stock.`
            : `Only ${selectedProductStock} in stock for ${candidate.name}.`,
        );
        return;
      }
      addProductAndClose(candidate);
      return;
    }

    if (listedProducts.length === 1) {
      addProductAndClose(listedProducts[0]);
      return;
    }

    if (canQuickCreateProduct) {
      openQuickCreatePanel(query.trim());
    }
  };

  const handleQuickCreateProduct = async () => {
    if (!quickCreateValidation.valid) {
      setQuickCreateError(quickCreateValidation.error);
      return;
    }

    if (duplicateNamedProduct) {
      setQuickCreateError("Product already exists. Use the existing item instead.");
      return;
    }

    try {
      setQuickCreateError("");
      await onQuickCreateProduct({
        name: quickCreateValidation.normalizedName,
        price: quickCreateValidation.normalizedPrice,
        gstRate: quickCreateValidation.normalizedGstRate,
      });
      resetAndClose();
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Could not create product.";
      setQuickCreateError(message);
    }
  };

  const showBaseError = !debouncedQuery && productsError;
  const showSearchError = Boolean(debouncedQuery) && searchError;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={isHindi ? "Product add karein" : "Add product"}
      description={
        isHindi
          ? "Naam, SKU, ya barcode se search karein. Scanner bhi isi field me kaam karega."
          : "Search by name, SKU, or barcode. Barcode scanners can type directly into this field."
      }
      contentClassName="max-w-3xl"
    >
      <div className="grid gap-4">
        <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isHindi ? "Product search" : "Product search"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHindi
                  ? "Enter dabakar highlighted product seedha bill me add karein."
                  : "Press Enter to add the highlighted product instantly."}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ScanLine size={14} />
              {isHindi ? "Barcode-ready" : "Barcode-ready"}
            </span>
          </div>

          <div className="relative mt-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchInputRef}
              autoFocus={open}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlightedIndex((current) =>
                    Math.min(current + 1, Math.max(listedProducts.length - 1, 0)),
                  );
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlightedIndex((current) => Math.max(current - 1, 0));
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmitSearch();
                }
              }}
              placeholder={
                isHindi
                  ? "Name, SKU, ya barcode se search karein"
                  : "Search by name, SKU, or barcode"
              }
              className="h-12 rounded-xl border-border/70 bg-background pl-10 text-sm"
            />
          </div>

          <div className="mt-3 rounded-2xl border border-border/60 bg-card/80">
            {showBaseError || showSearchError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <p className="text-destructive">
                  {isHindi
                    ? "Products load nahin ho paaye. Dobara try karein."
                    : "Products could not be loaded. Please try again."}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={onRetryProducts}>
                  {isHindi ? "Retry" : "Retry"}
                </Button>
              </div>
            ) : queryTooShortForRemoteSearch ? (
              <div className="px-4 py-4 text-sm text-muted-foreground">
                {isHindi
                  ? "Kam se kam 2 characters type karein ya barcode scan karein."
                  : "Type at least 2 characters to search, or scan a barcode."}
              </div>
            ) : isSearchingProducts || (!debouncedQuery && productsLoading) ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                {isHindi ? "Products load ho rahe hain..." : "Loading products..."}
              </div>
            ) : listedProducts.length === 0 ? (
              <div className="grid gap-3 px-4 py-6 text-center">
                <div className="grid gap-1">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-border/70 bg-muted/30 text-muted-foreground">
                    <Package2 size={18} />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {isHindi ? "Koi matching product nahin mila" : "No matching products"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isHindi
                      ? "Naya product save karke turant bill me jodiye ya niche custom item add kijiye."
                      : "Save it as a product right now or add it as a custom item below."}
                  </p>
                </div>
                {canQuickCreateProduct ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => openQuickCreatePanel(query.trim())}
                    >
                      {`+ Add "${query.trim()}"`}
                    </Button>
                  </div>
                ) : duplicateNamedProduct ? (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => addProductAndClose(duplicateNamedProduct)}
                    >
                      {isHindi ? "Existing product use karein" : "Use existing product"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto py-2">
                {canQuickCreateProduct ? (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-accent/45"
                    onClick={() => openQuickCreatePanel(query.trim())}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {`+ Add "${query.trim()}"`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {isHindi
                          ? "Saved product banega aur seedha bill me add ho jayega."
                          : "Create a saved product and drop it straight into this bill."}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      {isHindi ? "Quick add" : "Quick add"}
                    </span>
                  </button>
                ) : null}
                {listedProducts.map((product, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const stockOnHand = Number(product.stock_on_hand) || 0;
                  const isOutOfStock = stockOnHand <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition",
                        isHighlighted ? "bg-accent/70" : "hover:bg-accent/45",
                      )}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onClick={() => addProductAndClose(product)}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {product.name}
                          </span>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium",
                              isOutOfStock
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700",
                            )}
                          >
                            {isOutOfStock
                              ? isHindi
                                ? "Out of stock"
                                : "Out of stock"
                              : isHindi
                                ? `Stock ${stockOnHand}`
                                : `Stock ${stockOnHand}`}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[product.sku, product.barcode].filter(Boolean).join(" | ") ||
                            (isHindi ? "SKU not available" : "SKU not available")}
                        </p>
                      </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        Rs {Number(product.price || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                          GST {Number(product.gst_rate || 0)}%
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
            <div className="min-w-0">
              {selectedProduct ? (
                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {`Rs ${Number(selectedProduct.price || 0).toFixed(2)} • GST ${Number(
                      selectedProduct.gst_rate || 0,
                    )}%`}
                  </p>
                  {existingProductQuantity > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {isHindi
                        ? `Bill me pehle se qty ${existingProductQuantity}. Dobara add karne par quantity badhegi.`
                        : `Already in this bill with qty ${existingProductQuantity}. Adding again will increase quantity.`}
                    </p>
                  ) : null}
                  {selectedProductOutOfStock ? (
                    <p className="text-xs font-medium text-rose-600">
                      {isHindi
                        ? "Product out of stock hai."
                        : "This product is out of stock."}
                    </p>
                  ) : selectedProductWouldExceedStock ? (
                    <p className="text-xs font-medium text-amber-600">
                      {isHindi
                        ? `Sirf ${selectedProductStock} stock available hai.`
                        : `Only ${selectedProductStock} units are available in stock.`}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isHindi
                    ? "Product select kijiye ya naya product create kijiye."
                    : "Select a product or create a new one to continue."}
                </p>
              )}
            </div>
            <Button
              type="button"
              className="rounded-xl font-semibold"
              onClick={handleSubmitSearch}
              disabled={!canAddSelectedProduct}
            >
              {isHindi ? "Add selected product" : "Add selected product"}
            </Button>
          </div>
        </div>

        {quickCreateOpen ? (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isHindi ? "Naya product create karein" : "Create product"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHindi
                    ? "Product save hote hi bill me select ho jayega."
                    : "The new product will be saved and selected in the bill immediately."}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuickCreateOpen(false);
                  setQuickCreateError("");
                }}
              >
                {isHindi ? "Cancel" : "Cancel"}
              </Button>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_10rem_8rem_auto] md:items-end">
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isHindi ? "Product name" : "Product name"}
                </label>
                <Input
                  value={quickCreateName}
                  onChange={(event) => {
                    setQuickCreateName(event.target.value);
                    setQuickCreateError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !creatingProduct) {
                      event.preventDefault();
                      void handleQuickCreateProduct();
                    }
                  }}
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {isHindi ? "Selling price" : "Selling price"}
                </label>
                <Input
                  value={quickCreatePrice}
                  onChange={(event) => {
                    setQuickCreatePrice(sanitizeDecimalInput(event.target.value));
                    setQuickCreateError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !creatingProduct) {
                      event.preventDefault();
                      void handleQuickCreateProduct();
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  GST %
                </label>
                <Input
                  value={quickCreateGstRate}
                  onChange={(event) => {
                    setQuickCreateGstRate(
                      sanitizeDecimalInput(event.target.value),
                    );
                    setQuickCreateError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !creatingProduct) {
                      event.preventDefault();
                      void handleQuickCreateProduct();
                    }
                  }}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-11"
                />
              </div>
              <Button
                type="button"
                className="h-11 font-semibold"
                onClick={() => void handleQuickCreateProduct()}
                disabled={
                  creatingProduct ||
                  !quickCreateValidation.valid ||
                  Boolean(duplicateNamedProduct)
                }
              >
                {creatingProduct ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isHindi ? "Saving..." : "Saving..."}
                  </>
                ) : isHindi ? (
                  "Save product"
                ) : (
                  "Save product"
                )}
              </Button>
            </div>

            {duplicateNamedProduct ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <span>
                  {isHindi
                    ? "Yeh product pehle se maujood hai. Existing item use kijiye."
                    : "This product already exists. Use the existing item instead."}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => addProductAndClose(duplicateNamedProduct)}
                >
                  {isHindi ? "Use existing" : "Use existing"}
                </Button>
              </div>
            ) : null}
            {quickCreateError ? (
              <p className="mt-3 text-sm text-destructive">{quickCreateError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isHindi ? "Manual entry" : "Manual entry"}
              </p>
              <p className="text-xs text-muted-foreground">
                {isHindi
                  ? "Agar product save nahin hai to custom item add karein."
                  : "Add a custom item if the product is not saved yet."}
              </p>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              {isHindi ? "Fallback" : "Fallback"}
            </span>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] md:items-end">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {isHindi ? "Item name" : "Item name"}
              </label>
              <Input
                value={manualName}
                onChange={(event) => {
                  setManualName(event.target.value);
                  setManualError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddManualItem();
                  }
                }}
                placeholder={query.trim() ? query.trim() : "Custom item name"}
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {isHindi ? "Quantity" : "Quantity"}
              </label>
              <Input
                value={manualQuantity}
                onChange={(event) => {
                  setManualQuantity(sanitizeDecimalInput(event.target.value));
                  setManualError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddManualItem();
                  }
                }}
                inputMode="decimal"
                className="h-11"
              />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {isHindi ? "Price" : "Price"}
              </label>
              <Input
                value={manualPrice}
                onChange={(event) => {
                  setManualPrice(sanitizeDecimalInput(event.target.value));
                  setManualError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddManualItem();
                  }
                }}
                inputMode="decimal"
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <Button
              type="button"
              className="h-11 font-semibold"
              onClick={handleAddManualItem}
              disabled={!manualValidation.valid}
            >
              {isHindi ? "Add custom item" : "Add custom item"}
            </Button>
          </div>

          {manualError ? (
            <p className="mt-3 text-sm text-destructive">{manualError}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
