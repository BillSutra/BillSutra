"use client";

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Input } from "@/components/ui/input";
import { useProductSearchQuery } from "@/hooks/useInventoryQueries";
import type { Product } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";

const formatProductLabel = (product: Product) => {
  if (product.sku) {
    return `${product.name} - ${product.sku}`;
  }

  return product.name;
};

type AsyncProductSelectProps = {
  value: string;
  selectedLabel?: string;
  onSelect: (product: Product | null) => void;
  onSubmitSelection?: (
    product: Product | null,
    context: { query: string; matches: Product[] },
  ) => void;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  excludeProductIds?: string[];
  variant?: "default" | "warm";
};

export type AsyncProductSelectHandle = {
  focus: (options?: { select?: boolean }) => void;
  clear: () => void;
};

const AsyncProductSelect = forwardRef<
  AsyncProductSelectHandle,
  AsyncProductSelectProps
>(function AsyncProductSelect(
  {
    value,
    selectedLabel = "",
    onSelect,
    onSubmitSelection,
    placeholder,
    autoFocus = false,
    disabled = false,
    excludeProductIds = [],
    variant = "default",
  },
  ref,
) {
  const { t } = useI18n();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const searchPlaceholder = "Search products by name, SKU, or barcode";
  const typeToSearchMessage = "Type to search products";
  const noProductsFoundMessage = "No matching products found";
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selectedLabel);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setInputValue(selectedLabel);
    }
  }, [isOpen, selectedLabel]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedSearch, isOpen]);

  useImperativeHandle(
    ref,
    () => ({
      focus: (options) => {
        inputRef.current?.focus();
        if (options?.select) {
          inputRef.current?.select();
        }
        setIsOpen(true);
      },
      clear: () => {
        setInputValue("");
        setDebouncedSearch("");
        setHighlightedIndex(0);
        setIsOpen(true);
        onSelect(null);
      },
    }),
    [onSelect],
  );

  useEffect(() => {
    if (!autoFocus || disabled) return;

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setIsOpen(true);
    }, 160);

    return () => window.clearTimeout(timeoutId);
  }, [autoFocus, disabled]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(inputValue.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [inputValue]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const { data: searchResults, isFetching } = useProductSearchQuery(
    debouncedSearch,
    {
      limit: 20,
    },
  );

  const filteredResults = useMemo(() => {
    const excludedIds = new Set(excludeProductIds);

    return (searchResults ?? []).filter((product) => {
      const productId = String(product.id);
      return productId === value || !excludedIds.has(productId);
    });
  }, [excludeProductIds, searchResults, value]);

  const selectProduct = (product: Product | null) => {
    if (product) {
      setInputValue(formatProductLabel(product));
      setIsOpen(false);
    }
    onSelect(product);
  };

  const resolveEnterCandidate = () => {
    const normalizedQuery = inputValue.trim().toLowerCase();
    if (!normalizedQuery) return null;

    const highlightedProduct = filteredResults[highlightedIndex] ?? null;
    if (highlightedProduct) return highlightedProduct;

    const exactMatch =
      filteredResults.find((product) => {
        const barcode = product.barcode?.trim().toLowerCase();
        const sku = product.sku?.trim().toLowerCase();
        const name = product.name.trim().toLowerCase();

        return (
          barcode === normalizedQuery ||
          sku === normalizedQuery ||
          name === normalizedQuery
        );
      }) ?? null;

    if (exactMatch) return exactMatch;
    if (filteredResults.length === 1) return filteredResults[0];
    return null;
  };

  const inputClassName =
    variant === "warm"
      ? "h-9 rounded-md border border-[#e4d6ca] bg-white px-3 text-sm focus-visible:border-[#d8b89c] focus-visible:ring-[#f2e6dc]"
      : "h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm focus-visible:border-indigo-300 focus-visible:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus-visible:border-indigo-400 dark:focus-visible:ring-indigo-500/20";

  const panelClassName =
    variant === "warm"
      ? "border border-[#f2e6dc] bg-white shadow-lg"
      : "border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800";

  const itemClassName =
    variant === "warm"
      ? "hover:bg-[#fff9f2] focus:bg-[#fff9f2] text-[#3d3128]"
      : "text-gray-900 hover:bg-gray-50 focus:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-700/70 dark:focus:bg-gray-700/70";

  const metaClassName =
    variant === "warm"
      ? "text-[#8a6d56]"
      : "text-gray-500 dark:text-gray-400";

  const statusClassName =
    variant === "warm"
      ? "text-[#8a6d56]"
      : "text-gray-500 dark:text-gray-400";

  return (
    <div className="relative" ref={containerRef}>
      <Input
        ref={inputRef}
        value={inputValue}
        placeholder={placeholder ?? searchPlaceholder}
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((currentIndex) =>
              Math.min(currentIndex + 1, Math.max(filteredResults.length - 1, 0)),
            );
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
            return;
          }

          if (event.key === "Enter") {
            const candidate = resolveEnterCandidate();

            if (candidate) {
              event.preventDefault();
              selectProduct(candidate);
            }

            if (onSubmitSelection) {
              event.preventDefault();
              onSubmitSelection(candidate, {
                query: inputValue.trim(),
                matches: filteredResults,
              });
            }
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          setIsOpen(true);

          if (value && nextValue.trim() !== selectedLabel.trim()) {
            onSelect(null);
          }
        }}
        className={inputClassName}
      />

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl",
            panelClassName,
          )}
        >
          {!debouncedSearch ? (
            <div className={cn("px-3 py-2 text-sm", statusClassName)}>
              {typeToSearchMessage}
            </div>
          ) : isFetching ? (
            <div className={cn("px-3 py-2 text-sm", statusClassName)}>
              {t("common.loading")}
            </div>
          ) : filteredResults.length === 0 ? (
            <div className={cn("px-3 py-2 text-sm", statusClassName)}>
              {noProductsFoundMessage}
            </div>
          ) : (
            filteredResults.map((product) => (
              <button
                key={product.id}
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm",
                  highlightedIndex === filteredResults.findIndex(
                    (item) => item.id === product.id,
                  ) && "bg-gray-50 dark:bg-gray-700/70",
                  itemClassName,
                )}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() =>
                  setHighlightedIndex(
                    filteredResults.findIndex((item) => item.id === product.id),
                  )
                }
                onClick={() => {
                  selectProduct(product);
                }}
              >
                <span className="font-medium">{product.name}</span>
                <span className={cn("text-xs", metaClassName)}>
                  {product.sku || product.name}
                  {product.barcode ? ` | ${product.barcode}` : ""}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
});

export default AsyncProductSelect;
