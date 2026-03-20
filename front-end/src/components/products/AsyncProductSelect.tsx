"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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
  placeholder?: string;
  disabled?: boolean;
  excludeProductIds?: string[];
  variant?: "default" | "warm";
};

const AsyncProductSelect = ({
  value,
  selectedLabel = "",
  onSelect,
  placeholder,
  disabled = false,
  excludeProductIds = [],
  variant = "default",
}: AsyncProductSelectProps) => {
  const { t } = useI18n();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchPlaceholder = "Search products by name, SKU, or barcode";
  const typeToSearchMessage = "Type to search products";
  const noProductsFoundMessage = "No matching products found";
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selectedLabel);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setInputValue(selectedLabel);
    }
  }, [isOpen, selectedLabel]);

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
        value={inputValue}
        placeholder={placeholder ?? searchPlaceholder}
        autoComplete="off"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        onChange={(event) => {
          const nextValue = event.target.value;
          setInputValue(nextValue);
          setIsOpen(true);

          if (!nextValue.trim() && value) {
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
                  itemClassName,
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setInputValue(formatProductLabel(product));
                  setIsOpen(false);
                  onSelect(product);
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
};

export default AsyncProductSelect;
