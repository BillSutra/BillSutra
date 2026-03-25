"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardForecast,
  fetchInventoryDemandPredictions,
  type DashboardForecastResponse,
  type InventoryDemandPrediction,
  type InventoryDemandPredictionFilters,
  type InventoryDemandPredictionsMetadata,
} from "@/lib/apiClient";
import { dashboardRetryDelay } from "@/lib/dashboardRefresh";
import { usePurchasesQuery, useWarehousesQuery } from "@/hooks/useInventoryQueries";

const INVENTORY_PREDICTIONS_STALE_MS = 12 * 60 * 1000;
const FORECAST_STALE_MS = 20 * 60 * 1000;

const normalizePredictionFilters = (
  filters?: InventoryDemandPredictionFilters,
) => ({
  ...filters,
  productIds: filters?.productIds ? [...filters.productIds].sort((a, b) => a - b) : undefined,
});

export const inventoryDemandPredictionsQueryKey = (
  filters?: InventoryDemandPredictionFilters,
) => ["inventory-demand", "predictions", normalizePredictionFilters(filters)] as const;

export const forecastSalesQueryKey = ["dashboard", "forecast"] as const;

export const useInventoryDemandPredictions = (
  filters?: InventoryDemandPredictionFilters,
  options?: { enabled?: boolean },
) =>
  useQuery({
    queryKey: inventoryDemandPredictionsQueryKey(filters),
    queryFn: () => fetchInventoryDemandPredictions(filters),
    staleTime: INVENTORY_PREDICTIONS_STALE_MS,
    gcTime: INVENTORY_PREDICTIONS_STALE_MS * 2,
    refetchInterval: false,
    retry: 3,
    retryDelay: dashboardRetryDelay,
    enabled: options?.enabled ?? true,
  });

export const useForecastSales = () =>
  useQuery<DashboardForecastResponse>({
    queryKey: forecastSalesQueryKey,
    queryFn: fetchDashboardForecast,
    staleTime: FORECAST_STALE_MS,
    gcTime: FORECAST_STALE_MS * 2,
    refetchInterval: false,
    retry: 3,
    retryDelay: dashboardRetryDelay,
  });

export type PurchaseSuggestionItem = InventoryDemandPrediction & {
  supplierId: number | null;
  supplierName: string;
  warehouseId: number | null;
  warehouseName: string;
  expectedRunoutDate: string | null;
};

export type PurchaseSuggestionGroup = {
  id: string;
  supplierId: number | null;
  supplierName: string;
  warehouseId: number | null;
  warehouseName: string;
  items: PurchaseSuggestionItem[];
  totalReorderValue: number;
};

const buildExpectedRunoutDate = (daysUntilStockout: number) => {
  if (!Number.isFinite(daysUntilStockout) || daysUntilStockout >= 999) {
    return null;
  }

  const next = new Date();
  next.setDate(next.getDate() + Math.max(daysUntilStockout, 0));
  return next.toISOString();
};

export const usePurchaseSuggestions = (
  filters?: InventoryDemandPredictionFilters,
) => {
  const predictionsQuery = useInventoryDemandPredictions(
    { alertLevel: "critical", ...filters },
    { enabled: true },
  );
  const purchasesQuery = usePurchasesQuery();
  const warehousesQuery = useWarehousesQuery();

  const derived = useMemo(() => {
    const predictions = predictionsQuery.data?.predictions ?? [];
    const metadata: InventoryDemandPredictionsMetadata | null =
      predictionsQuery.data?.metadata ?? null;
    const warehouses = warehousesQuery.data ?? [];
    const warehouseNameById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name]));

    const sortedPurchases = [...(purchasesQuery.data ?? [])].sort(
      (left, right) =>
        new Date(right.purchase_date).getTime() - new Date(left.purchase_date).getTime(),
    );

    const latestPurchaseByProductId = new Map<
      number,
      {
        supplierId: number | null;
        supplierName: string;
        warehouseId: number | null;
        warehouseName: string;
      }
    >();

    sortedPurchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        if (!item.product_id || latestPurchaseByProductId.has(item.product_id)) {
          return;
        }

        latestPurchaseByProductId.set(item.product_id, {
          supplierId: purchase.supplier?.id ?? null,
          supplierName: purchase.supplier?.name ?? "Direct purchase",
          warehouseId: purchase.warehouse?.id ?? null,
          warehouseName: purchase.warehouse?.name ?? "Default stock",
        });
      });
    });

    const items: PurchaseSuggestionItem[] = predictions.map((prediction) => {
      const preferredPurchase = latestPurchaseByProductId.get(prediction.product_id);
      const resolvedWarehouseId =
        prediction.warehouse_id ?? preferredPurchase?.warehouseId ?? null;

      return {
        ...prediction,
        supplierId: preferredPurchase?.supplierId ?? null,
        supplierName: preferredPurchase?.supplierName ?? "Direct purchase",
        warehouseId: resolvedWarehouseId,
        warehouseName:
          (resolvedWarehouseId ? warehouseNameById.get(resolvedWarehouseId) : null) ??
          preferredPurchase?.warehouseName ??
          "Default stock",
        expectedRunoutDate: buildExpectedRunoutDate(prediction.days_until_stockout),
      };
    });

    const groupsMap = new Map<string, PurchaseSuggestionGroup>();

    items.forEach((item) => {
      const key = `${item.supplierId ?? "direct"}:${item.warehouseId ?? "default"}`;
      const existing =
        groupsMap.get(key) ??
        {
          id: key,
          supplierId: item.supplierId,
          supplierName: item.supplierName,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName,
          items: [],
          totalReorderValue: 0,
        };

      existing.items.push(item);
      existing.totalReorderValue += item.recommended_reorder_quantity * item.unit_cost;
      groupsMap.set(key, existing);
    });

    const groups = Array.from(groupsMap.values()).sort(
      (left, right) =>
        right.items.filter((item) => item.alert_level === "critical").length -
        left.items.filter((item) => item.alert_level === "critical").length,
    );

    const stockoutsSoonCount = items.filter(
      (item) => item.days_until_stockout <= 3 || item.stock_left <= 0,
    ).length;

    const totalReorderValue = items.reduce(
      (sum, item) => sum + item.recommended_reorder_quantity * item.unit_cost,
      0,
    );

    return {
      items,
      groups,
      metadata,
      summary: {
        criticalCount: items.filter((item) => item.alert_level === "critical").length,
        stockoutsSoonCount,
        totalReorderValue,
      },
    };
  }, [predictionsQuery.data, purchasesQuery.data, warehousesQuery.data]);

  return {
    ...predictionsQuery,
    suggestions: derived.items,
    groups: derived.groups,
    metadata: derived.metadata,
    summary: derived.summary,
    isLoading:
      predictionsQuery.isLoading || purchasesQuery.isLoading || warehousesQuery.isLoading,
    isFetching:
      predictionsQuery.isFetching || purchasesQuery.isFetching || warehousesQuery.isFetching,
    isError:
      predictionsQuery.isError || purchasesQuery.isError || warehousesQuery.isError,
  };
};
