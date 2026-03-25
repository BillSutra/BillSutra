"use client";

import { Button } from "@/components/ui/button";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import {
  type PurchaseSuggestionItem,
  usePurchaseSuggestions,
} from "@/hooks/usePredictionQueries";
import { captureAnalyticsEvent } from "@/lib/observability/client";

type SuggestedPurchasesPanelProps = {
  warehouseId?: number;
  onLoadItems: (items: PurchaseSuggestionItem[]) => void;
};

const SuggestedPurchasesPanel = ({
  warehouseId,
  onLoadItems,
}: SuggestedPurchasesPanelProps) => {
  const { currency, dateWithYear, number } = useDashboardFormatters();
  const { groups, metadata, isLoading, isError, suggestions } =
    usePurchaseSuggestions(warehouseId ? { warehouseId } : undefined);

  const criticalSuggestions = suggestions.filter(
    (item) => item.alert_level === "critical",
  );

  return (
    <section className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56]">
            Suggested purchases
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1f1b16]">
            Prediction-driven restocks
          </h2>
          <p className="mt-1 text-sm text-[#8a6d56]">
            Load critical items directly into the purchase form without creating a separate planning page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={criticalSuggestions.length === 0}
          onClick={() => {
            captureAnalyticsEvent("purchase_suggestions_loaded", {
              source: "load_critical_restocks",
              itemCount: criticalSuggestions.length,
              warehouseId: warehouseId ?? null,
            });
            onLoadItems(criticalSuggestions);
          }}
        >
          Load Critical Restocks
        </Button>
      </div>

      <div className="mt-2 text-xs text-[#8a6d56]">
        {metadata
          ? `Generated ${dateWithYear(metadata.generatedAt)} | ${metadata.basisWindowDays}-day basis | ${metadata.dataCoverageDays} days of coverage`
          : "Predictions refresh from the batched inventory-demand endpoint."}
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-2xl bg-[#fff9f2]"
              />
            ))}
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-[#b45309]">
            Unable to load purchase suggestions right now.
          </p>
        ) : null}

        {!isLoading && !isError && groups.length === 0 ? (
          <div className="rounded-2xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-6 text-sm text-[#8a6d56]">
            No critical restocks are currently suggested.
          </div>
        ) : null}

        {!isLoading && !isError && groups.length > 0 ? (
          <div className="grid gap-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="rounded-2xl border border-[#f2e6dc] bg-[#fff9f2] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1f1b16]">
                      {group.supplierName}
                    </p>
                    <p className="mt-1 text-xs text-[#8a6d56]">
                      {group.warehouseName} | {number(group.items.length)} suggested line
                      {group.items.length === 1 ? "" : "s"} | {currency(group.totalReorderValue)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      captureAnalyticsEvent("purchase_suggestions_loaded", {
                        source: "group_load",
                        itemCount: group.items.length,
                        warehouseName: group.warehouseName,
                        supplierName: group.supplierName,
                      });
                      onLoadItems(group.items);
                    }}
                  >
                    Load group
                  </Button>
                </div>

                <div className="mt-3 grid gap-2">
                  {group.items.map((item) => (
                    <div
                      key={`${group.id}-${item.product_id}`}
                      className="rounded-xl border border-white/80 bg-white/80 px-3 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1f1b16]">
                            {item.product_name}
                          </p>
                          <p className="mt-1 text-xs text-[#8a6d56]">
                            {item.stock_left} left | {item.predicted_daily_sales.toFixed(1)} / day | confidence{" "}
                            {number(item.confidence * 100, {
                              maximumFractionDigits: 0,
                            })}
                            %
                          </p>
                        </div>
                        <span className="rounded-full border border-[#e8d2bf] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a6d56]">
                          {item.alert_level}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                            Days left
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                            {item.days_until_stockout >= 999
                              ? "Not projected"
                              : number(item.days_until_stockout)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                            Suggested qty
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                            {number(item.recommended_reorder_quantity)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                            Runout date
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                            {item.expectedRunoutDate
                              ? dateWithYear(item.expectedRunoutDate)
                              : "Not projected"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-[#8a6d56]">
                            Reorder value
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#1f1b16]">
                            {currency(
                              item.recommended_reorder_quantity * item.unit_cost,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default SuggestedPurchasesPanel;
