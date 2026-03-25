"use client";

import { ArrowRight, Clock3, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/apiClient";
import type { SmartSuggestionProduct } from "@/lib/invoiceSuggestions";

type InvoiceSmartSuggestionsProps = {
  suggestedProducts: SmartSuggestionProduct[];
  recentProducts: Product[];
  onAddProduct: (product: Product, source: "suggested" | "recent") => void;
};

const InvoiceSmartSuggestions = ({
  suggestedProducts,
  recentProducts,
  onAddProduct,
}: InvoiceSmartSuggestionsProps) => {
  if (suggestedProducts.length === 0 && recentProducts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-4">
      {suggestedProducts.length > 0 ? (
        <section className="rounded-[1.5rem] bg-white/90 p-4 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:ring-slate-700/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Suggested
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Helpful cross-sells based on this cart and past bills.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700 dark:bg-sky-950/30 dark:text-sky-200">
              <Sparkles size={14} />
              <span>Smart picks</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {suggestedProducts.map((entry) => (
              <div
                key={entry.product.id}
                className="min-w-0 rounded-[1.25rem] bg-slate-50/80 p-4 ring-1 ring-slate-200/80 dark:bg-slate-900/70 dark:ring-slate-700/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                      {entry.reasonLabel}
                    </p>
                    <p className="mt-3 truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                      {entry.product.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                      {entry.reasonNote}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    className="rounded-full"
                    onClick={() => onAddProduct(entry.product, "suggested")}
                    aria-label={`Add ${entry.product.name}`}
                  >
                    <Plus size={15} />
                  </Button>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-base font-semibold text-slate-950 dark:text-slate-100">
                    Rs. {Number(entry.product.price ?? 0).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:text-primary/80"
                    onClick={() => onAddProduct(entry.product, "suggested")}
                  >
                    <span>Add</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {recentProducts.length > 0 ? (
        <section className="rounded-[1.5rem] bg-white/90 p-4 ring-1 ring-slate-200/80 dark:bg-slate-950/70 dark:ring-slate-700/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Quick access
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Recently billed products for faster repeat entry.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Clock3 size={14} />
              <span>Recent</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {recentProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:ring-primary/25 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:ring-primary/30"
                onClick={() => onAddProduct(product, "recent")}
              >
                <span className="max-w-[140px] truncate">{product.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Rs. {Number(product.price ?? 0).toFixed(0)}
                </span>
                <Plus size={14} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default InvoiceSmartSuggestions;
