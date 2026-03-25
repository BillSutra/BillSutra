"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDashboardFormatters } from "@/components/dashboard/use-dashboard-formatters";
import type {
  Inventory,
  InventoryDemandPrediction,
  InventoryDemandPredictionsMetadata,
} from "@/lib/apiClient";

type InventoryPredictionDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inventoryItem: Inventory | null;
  prediction: InventoryDemandPrediction | null;
  metadata: InventoryDemandPredictionsMetadata | null;
};

const InventoryPredictionDrawer = ({
  open,
  onOpenChange,
  inventoryItem,
  prediction,
  metadata,
}: InventoryPredictionDrawerProps) => {
  const { dateWithYear, number } = useDashboardFormatters();

  const purchaseHref =
    inventoryItem && prediction
      ? `/purchases?productId=${inventoryItem.product.id}&warehouseId=${inventoryItem.warehouse.id}&quantity=${prediction.recommended_reorder_quantity}&unitCost=${prediction.unit_cost}&productLabel=${encodeURIComponent(`${inventoryItem.product.name} - ${inventoryItem.product.sku}`)}`
      : "/purchases";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 h-full max-w-[560px] translate-x-0 translate-y-0 rounded-none border-l border-border/80 sm:max-w-[560px]"
        showCloseButton
      >
        <DialogHeader className="text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Inventory insight
          </p>
          <DialogTitle>
            {inventoryItem?.product.name ?? "Inventory prediction"}
          </DialogTitle>
          <DialogDescription>
            {inventoryItem
              ? `${inventoryItem.warehouse.name} | ${inventoryItem.product.sku}`
              : "Prediction details"}
          </DialogDescription>
        </DialogHeader>

        {!inventoryItem || !prediction ? (
          <div className="rounded-2xl border border-border bg-card/80 px-4 py-6 text-sm text-muted-foreground">
            Select an inventory row to review demand signals and restock guidance.
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  30-day sales basis
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {prediction.predicted_daily_sales.toFixed(1)} units / day
                </p>
              </div>
              <div className="dashboard-chart-metric rounded-2xl px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Confidence
                </p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {number(prediction.confidence * 100, {
                    maximumFractionDigits: 0,
                  })}
                  %
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Stockout estimate</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Stock left
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {number(prediction.stock_left)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Days until stockout
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {prediction.days_until_stockout >= 999
                      ? "Not projected"
                      : number(prediction.days_until_stockout)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Reorder suggestion
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {number(prediction.recommended_reorder_quantity)} units
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">Prediction metadata</p>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground">
                <p>
                  Generated at:{" "}
                  <span className="font-medium text-foreground">
                    {metadata?.generatedAt
                      ? dateWithYear(metadata.generatedAt)
                      : "Unavailable"}
                  </span>
                </p>
                <p>
                  Basis window:{" "}
                  <span className="font-medium text-foreground">
                    {number(metadata?.basisWindowDays ?? prediction.basis_window_days)} days
                  </span>
                </p>
                <p>
                  Data coverage:{" "}
                  <span className="font-medium text-foreground">
                    {number(metadata?.dataCoverageDays ?? prediction.basis_window_days)} days
                  </span>
                </p>
                <p>
                  Warehouse scope:{" "}
                  <span className="font-medium text-foreground">
                    {metadata?.warehouseScope.mode === "warehouse"
                      ? inventoryItem.warehouse.name
                      : "All inventory"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={purchaseHref}>Create Purchase from Suggestion</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default InventoryPredictionDrawer;
