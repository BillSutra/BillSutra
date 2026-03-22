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
        <section className="rounded-[1.6rem] border border-white/75 bg-white/85 p-4 dark:border-white/10 dark:bg-gray-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56] dark:text-gray-300">
                Suggested
              </p>
              <p className="mt-1 text-sm text-[#7c5a3d] dark:text-gray-400">
                Helpful cross-sells based on this cart and past bills.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              <Sparkles size={14} />
              <span>Smart picks</span>
            </div>
          </div>

          <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-1">
            {suggestedProducts.map((entry) => (
              <div
                key={entry.product.id}
                className="min-w-[220px] snap-start rounded-[1.35rem] border border-[#eadfcf] bg-[linear-gradient(180deg,#fffdf8_0%,#fff5ea_100%)] p-4 shadow-[0_18px_35px_-28px_rgba(120,53,15,0.32)] dark:border-amber-900/30 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.14)_0%,rgba(17,24,39,0.92)_100%)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="rounded-full border border-amber-200 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:border-amber-900/40 dark:bg-gray-900/70 dark:text-amber-100">
                      {entry.reasonLabel}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-[#3b2411] dark:text-gray-50">
                      {entry.product.name}
                    </p>
                    <p className="mt-1 text-xs text-[#7c5a3d] dark:text-gray-400">
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
                  <p className="text-base font-semibold text-[#3b2411] dark:text-gray-100">
                    Rs. {Number(entry.product.price ?? 0).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#b45309] transition hover:text-[#92400e] dark:text-amber-200"
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
        <section className="rounded-[1.6rem] border border-white/75 bg-white/85 p-4 dark:border-white/10 dark:bg-gray-900/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56] dark:text-gray-300">
                Quick access
              </p>
              <p className="mt-1 text-sm text-[#7c5a3d] dark:text-gray-400">
                Recently billed products for faster repeat entry.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Clock3 size={14} />
              <span>Recent</span>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {recentProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-[#e4d6ca] bg-white px-3 py-2 text-sm font-medium text-[#3b2411] shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-amber-400/40 dark:hover:bg-amber-500/10"
                onClick={() => onAddProduct(product, "recent")}
              >
                <span className="max-w-[140px] truncate">{product.name}</span>
                <span className="text-xs text-[#8a6d56] dark:text-gray-400">
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
