"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Supplier } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type SupplierInsight = {
  supplier: Supplier;
  categories: string[];
  lastPurchaseDate?: string;
  usageCount: number;
  outstandingBalance: number;
  isFrequent: boolean;
};

type SmartSupplierSelectProps = {
  value: string;
  suppliers: SupplierInsight[];
  directLabel: string;
  searchPlaceholder: string;
  filterPlaceholder: string;
  allCategoriesLabel: string;
  frequentLabel: string;
  lastPurchaseLabel: string;
  outstandingLabel: string;
  noResultsLabel: string;
  selectedSummaryLabel: string;
  onChange: (value: string) => void;
  formatDate: (value: string) => string;
  formatCurrency: (value: number) => string;
};

const SmartSupplierSelect = ({
  value,
  suppliers,
  directLabel,
  searchPlaceholder,
  filterPlaceholder,
  allCategoriesLabel,
  frequentLabel,
  lastPurchaseLabel,
  outstandingLabel,
  noResultsLabel,
  selectedSummaryLabel,
  onChange,
  formatDate,
  formatCurrency,
}: SmartSupplierSelectProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");

  const categories = useMemo(() => {
    const unique = new Set<string>();

    suppliers.forEach((entry) => {
      entry.categories.forEach((category) => {
        const normalized = category.trim();
        if (normalized) {
          unique.add(normalized);
        }
      });
    });

    return Array.from(unique).sort((left, right) =>
      left.localeCompare(right, "en-IN", { sensitivity: "base" }),
    );
  }, [suppliers]);

  const resolvedCategory =
    activeCategory !== "ALL" && !categories.includes(activeCategory)
      ? "ALL"
      : activeCategory;

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return suppliers
      .filter((entry) => {
        const matchesCategory =
          resolvedCategory === "ALL" ||
          entry.categories.some(
            (category) =>
              category.toLowerCase() === resolvedCategory.toLowerCase(),
          );

        if (!matchesCategory) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const tokens = [
          entry.supplier.name,
          entry.supplier.phone ?? "",
          entry.supplier.email ?? "",
          entry.categories.join(" "),
        ];

        return tokens.join(" ").toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (left.isFrequent !== right.isFrequent) {
          return left.isFrequent ? -1 : 1;
        }

        if (left.usageCount !== right.usageCount) {
          return right.usageCount - left.usageCount;
        }

        return left.supplier.name.localeCompare(right.supplier.name, "en-IN", {
          sensitivity: "base",
        });
      });
  }, [resolvedCategory, searchQuery, suppliers]);

  const selectedSupplier = suppliers.find(
    (entry) => String(entry.supplier.id) === value,
  );

  return (
    <div className="grid gap-3 rounded-xl border border-[#f2e6dc] bg-[#fffaf6] p-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9"
        />
        <select
          value={resolvedCategory}
          onChange={(event) => setActiveCategory(event.target.value)}
          className="app-field h-9 rounded-xl px-3 text-sm"
          aria-label={filterPlaceholder}
        >
          <option value="ALL">{allCategoriesLabel}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className={cn(
            "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
            value === ""
              ? "border-[#d1b59d] bg-[#fff4e7]"
              : "border-[#ead8c7] bg-white hover:border-[#d9bca4]",
          )}
          onClick={() => onChange("")}
        >
          {directLabel}
        </button>

        {filteredSuppliers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#e6d6c8] px-3 py-2 text-sm text-[#8a6d56]">
            {noResultsLabel}
          </p>
        ) : (
          filteredSuppliers.map((entry) => {
            const supplierId = String(entry.supplier.id);
            return (
              <button
                key={supplierId}
                type="button"
                onClick={() => onChange(supplierId)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left transition",
                  value === supplierId
                    ? "border-[#d1b59d] bg-[#fff4e7]"
                    : "border-[#ead8c7] bg-white hover:border-[#d9bca4]",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#1f1b16]">
                    {entry.supplier.name}
                  </p>
                  {entry.isFrequent ? (
                    <Badge className="border-[#e4d2c2] bg-[#fff5ea] text-[#8a6d56]">
                      {frequentLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-[#8a6d56]">
                  {entry.categories.length ? entry.categories.join(", ") : "-"}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#7b6655]">
                  <span>
                    {lastPurchaseLabel}:{" "}
                    {entry.lastPurchaseDate
                      ? formatDate(entry.lastPurchaseDate)
                      : "-"}
                  </span>
                  <span>
                    {outstandingLabel}:{" "}
                    {formatCurrency(entry.outstandingBalance)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedSupplier ? (
        <p className="text-xs text-[#8a6d56]">
          {selectedSummaryLabel}: {selectedSupplier.supplier.name} |{" "}
          {outstandingLabel.toLowerCase()}{" "}
          {formatCurrency(selectedSupplier.outstandingBalance)}
        </p>
      ) : null}
    </div>
  );
};

export type { SupplierInsight };
export default SmartSupplierSelect;
