"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type {
  InventoryInsight,
  InventoryInsightSeverity,
  InventoryInsightsResponse,
} from "@/lib/apiClient";

type SmartInventoryInsightsProps = {
  data: InventoryInsightsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
};

const severityMeta: Record<
  InventoryInsightSeverity,
  { title: string; badge: string; panel: string }
> = {
  critical: {
    title: "Critical Alerts",
    badge: "bg-red-100 text-red-700",
    panel: "border-red-200 bg-red-50/60",
  },
  warning: {
    title: "Warnings",
    badge: "bg-amber-100 text-amber-700",
    panel: "border-amber-200 bg-amber-50/60",
  },
  info: {
    title: "Suggestions",
    badge: "bg-emerald-100 text-emerald-700",
    panel: "border-emerald-200 bg-emerald-50/60",
  },
};

const buildPrefillHref = (insight: InventoryInsight) => {
  const params = new URLSearchParams();
  params.set("productId", insight.productId);
  params.set("productLabel", insight.productName);

  if (insight.warehouseId) {
    params.set("warehouseId", String(insight.warehouseId));
  }
  if (insight.suggestedQuantity) {
    params.set("quantity", String(insight.suggestedQuantity));
  }
  if (insight.unitCost !== undefined) {
    params.set("unitCost", String(insight.unitCost));
  }
  if (insight.suggestedSupplierId) {
    params.set("supplierId", String(insight.suggestedSupplierId));
  }
  if (insight.suggestedSupplierName) {
    params.set("supplierName", insight.suggestedSupplierName);
  }
  params.set("source", "smart_inventory_insights");

  return `/purchases/new?${params.toString()}`;
};

const renderActionLabel = (insight: InventoryInsight) => {
  if (insight.type === "supplier_suggestion") {
    return "Create purchase";
  }

  return insight.severity === "critical" ? "Restock now" : "Create purchase";
};

const InsightCard = ({ insight }: { insight: InventoryInsight }) => (
  <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1f1b16]">
          {insight.productName}
        </p>
        <p className="mt-1 text-sm text-[#5c4b3b]">{insight.message}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#8a6d56]">
          <span>Stock: {insight.stockLeft}</span>
          {typeof insight.avgDailySales === "number" && insight.avgDailySales > 0 ? (
            <span>Avg daily sales: {insight.avgDailySales.toFixed(1)}</span>
          ) : null}
          {typeof insight.daysToStockout === "number" ? (
            <span>Days to stockout: {insight.daysToStockout}</span>
          ) : null}
          {insight.suggestedSupplierName ? (
            <span>Supplier: {insight.suggestedSupplierName}</span>
          ) : null}
        </div>
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${severityMeta[insight.severity].badge}`}
      >
        {insight.severity}
      </span>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild type="button" variant="outline">
        <Link href={buildPrefillHref(insight)}>{renderActionLabel(insight)}</Link>
      </Button>
      <Button asChild type="button" variant="ghost">
        <Link href={`/purchases/new?${new URLSearchParams({ source: "smart_inventory_insights" }).toString()}`}>
          Open purchases
        </Link>
      </Button>
    </div>
  </div>
);

const SmartInventoryInsights = ({
  data,
  isLoading,
  isError,
}: SmartInventoryInsightsProps) => {
  const grouped: Record<InventoryInsightSeverity, InventoryInsight[]> = {
    critical: [],
    warning: [],
    info: [],
  };

  (data?.insights ?? []).forEach((insight) => {
    grouped[insight.severity].push(insight);
  });

  return (
    <section className="mt-6 rounded-2xl border border-[#ecdccf] bg-white/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a6d56]">
            Smart Inventory Insights
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#1f1b16]">
            Proactive reminders, alerts, and supplier guidance
          </h2>
          <p className="mt-1 text-sm text-[#8a6d56]">
            Prioritized inventory actions based on stock levels, sales velocity, and past purchasing behavior.
          </p>
        </div>
        {data ? (
          <div className="rounded-2xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3 text-sm text-[#5c4b3b]">
            {new Date(data.generatedAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 text-sm text-[#8a6d56]">Loading smart inventory insights...</div>
      ) : null}
      {isError ? (
        <div className="mt-4 text-sm text-[#b45309]">
          Unable to load smart inventory insights right now.
        </div>
      ) : null}
      {!isLoading && !isError && (data?.insights.length ?? 0) === 0 ? (
        <div className="mt-4 rounded-2xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-5 text-sm text-[#8a6d56]">
          No urgent inventory actions right now. Stock looks healthy.
        </div>
      ) : null}

      {!isLoading && !isError && (data?.insights.length ?? 0) > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {(["critical", "warning", "info"] as const).map((severity) => (
            <div
              key={severity}
              className={`rounded-2xl border p-4 ${severityMeta[severity].panel}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#5c4b3b]">
                  {severityMeta[severity].title}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${severityMeta[severity].badge}`}
                >
                  {grouped[severity].length}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {grouped[severity].length === 0 ? (
                  <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-5 text-sm text-[#8a6d56]">
                    No items in this bucket.
                  </div>
                ) : (
                  grouped[severity].map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default SmartInventoryInsights;
