"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import { validateNumber } from "@/lib/validation";
import {
  useAdjustInventoryMutation,
  useCategoriesQuery,
  useInventoriesQuery,
  useProductsQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import { useInventoryDemandPredictions } from "@/hooks/usePredictionQueries";
import { useI18n } from "@/providers/LanguageProvider";
import type { Inventory, InventoryDemandPrediction } from "@/lib/apiClient";

type InventoryClientProps = {
  name: string;
  image?: string;
};

type StockStatus = "out" | "low" | "in";
type SortOption = "stock_asc" | "stock_desc" | "name_asc";
type PageSizeOption = 10 | 25 | 50;

type InventoryTableRow = Inventory & {
  prediction: InventoryDemandPrediction | null;
  stockStatus: StockStatus;
  effectiveStock: number;
  dailySalesText: string;
  searchText: string;
};

const STOCK_STATUS_META: Record<
  StockStatus,
  {
    badgeClass: string;
    emphasisClass: string;
  }
> = {
  out: {
    badgeClass: "border border-red-200 bg-red-50 text-red-700",
    emphasisClass: "text-red-700",
  },
  low: {
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-700",
    emphasisClass: "text-amber-700",
  },
  in: {
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    emphasisClass: "text-emerald-700",
  },
};

const formatNumber = (value: number, locale: string, digits = 0) =>
  new Intl.NumberFormat(locale || "en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const getPredictionKey = (productId: number, warehouseId?: number | null) =>
  `${productId}:${warehouseId ?? "all"}`;

const getStockStatus = (
  item: Inventory,
  prediction: InventoryDemandPrediction | null,
): StockStatus => {
  const stock = prediction?.stock_left ?? item.quantity;
  const reorderLevel = item.product.reorder_level ?? 0;

  if (stock <= 0 || prediction?.alert_level === "critical") {
    return "out";
  }

  if (stock <= reorderLevel || prediction?.alert_level === "warning") {
    return "low";
  }

  return "in";
};

const buildPurchaseHref = (row: InventoryTableRow) => {
  const params = new URLSearchParams();
  params.set("productId", String(row.product.id));
  params.set("warehouseId", String(row.warehouse.id));
  params.set(
    "productLabel",
    row.product.sku ? `${row.product.name} - ${row.product.sku}` : row.product.name,
  );
  params.set(
    "quantity",
    String(row.prediction?.recommended_reorder_quantity ?? row.product.reorder_level ?? 1),
  );

  if (row.prediction?.unit_cost !== undefined) {
    params.set("unitCost", String(row.prediction.unit_cost));
  }

  params.set("source", "inventory_page");
  return `/purchases/new?${params.toString()}`;
};

const buildBulkPurchaseHref = (rows: InventoryTableRow[]) => {
  const params = new URLSearchParams();
  const uniqueWarehouseIds = Array.from(
    new Set(rows.map((row) => String(row.warehouse.id))),
  );

  if (uniqueWarehouseIds.length === 1) {
    params.set("warehouseId", uniqueWarehouseIds[0] ?? "");
  }

  params.set("source", "inventory_bulk_restock");
  params.set(
    "restockItems",
    JSON.stringify(
      rows.map((row) => ({
        productId: String(row.product.id),
        productLabel: row.product.sku
          ? `${row.product.name} - ${row.product.sku}`
          : row.product.name,
        quantity: String(
          row.prediction?.recommended_reorder_quantity ?? row.product.reorder_level ?? 1,
        ),
        unitCost:
          row.prediction?.unit_cost !== undefined
            ? String(row.prediction.unit_cost)
            : "",
        warehouseId: String(row.warehouse.id),
      })),
    ),
  );

  return `/purchases/new?${params.toString()}`;
};

const InventoryClient = ({ name, image }: InventoryClientProps) => {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const initialWarehouseId = searchParams.get("warehouseId") ?? "";
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouseId);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | StockStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("stock_asc");
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<number[]>([]);
  const scopedWarehouseId = warehouseFilter ? Number(warehouseFilter) : undefined;
  const { data, isLoading, isError } = useInventoriesQuery();
  const { data: products } = useProductsQuery();
  const { data: categories } = useCategoriesQuery();
  const { data: warehouses } = useWarehousesQuery();
  const predictionsQuery = useInventoryDemandPredictions(
    scopedWarehouseId ? { warehouseId: scopedWarehouseId } : undefined,
  );
  const adjustInventory = useAdjustInventoryMutation();
  const [form, setForm] = useState({
    warehouse_id: "",
    product_id: "",
    change: "",
    reason: "ADJUSTMENT",
    note: "",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);

  const stockStatusLabels = useMemo(
    () => ({
      out: t("inventory.tableView.outOfStock"),
      low: t("inventory.tableView.lowStock"),
      in: t("inventory.tableView.inStock"),
    }),
    [t],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setWarehouseFilter(initialWarehouseId);
  }, [initialWarehouseId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, debouncedSearch, pageSize, sortBy, stockFilter, warehouseFilter]);

  const predictionByKey = useMemo(() => {
    const map = new Map<string, InventoryDemandPrediction>();

    (predictionsQuery.data?.predictions ?? []).forEach((prediction) => {
      map.set(
        getPredictionKey(prediction.product_id, prediction.warehouse_id ?? scopedWarehouseId),
        prediction,
      );

      if (prediction.warehouse_id == null) {
        map.set(getPredictionKey(prediction.product_id), prediction);
      }
    });

    return map;
  }, [predictionsQuery.data?.predictions, scopedWarehouseId]);

  const allRows = useMemo(() => {
    if (!data) return [] as InventoryTableRow[];

    return data.map((item) => {
      const prediction =
        predictionByKey.get(getPredictionKey(item.product.id, item.warehouse.id)) ??
        predictionByKey.get(getPredictionKey(item.product.id)) ??
        null;
      const effectiveStock = prediction?.stock_left ?? item.quantity;
      const stockStatus = getStockStatus(item, prediction);
      const categoryName =
        item.product.category?.name ?? t("productsPage.uncategorized");
      const dailySalesText = prediction
        ? formatNumber(prediction.predicted_daily_sales, locale, 1)
        : t("inventory.predictions.notAvailable");

      return {
        ...item,
        prediction,
        effectiveStock,
        stockStatus,
        dailySalesText,
        searchText: `${item.product.name} ${item.product.sku} ${categoryName} ${item.warehouse.name}`.toLowerCase(),
      };
    });
  }, [data, locale, predictionByKey, t]);

  const summary = useMemo(
    () => ({
      urgent: allRows.filter((row) => row.stockStatus === "out").length,
      low: allRows.filter((row) => row.stockStatus === "low").length,
      healthy: allRows.filter((row) => row.stockStatus === "in").length,
    }),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    const searched = allRows.filter((row) => {
      if (warehouseFilter && String(row.warehouse.id) !== warehouseFilter) {
        return false;
      }

      if (
        categoryFilter &&
        String(row.product.category?.id ?? "") !== categoryFilter
      ) {
        return false;
      }

      if (stockFilter !== "all" && row.stockStatus !== stockFilter) {
        return false;
      }

      if (debouncedSearch && !row.searchText.includes(debouncedSearch)) {
        return false;
      }

      return true;
    });

    return searched.sort((left, right) => {
      if (sortBy === "stock_asc" && left.effectiveStock !== right.effectiveStock) {
        return left.effectiveStock - right.effectiveStock;
      }

      if (sortBy === "stock_desc" && left.effectiveStock !== right.effectiveStock) {
        return right.effectiveStock - left.effectiveStock;
      }

      return left.product.name.localeCompare(right.product.name);
    });
  }, [allRows, categoryFilter, debouncedSearch, sortBy, stockFilter, warehouseFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, safeCurrentPage]);

  const selectedRows = useMemo(
    () => filteredRows.filter((row) => selectedRowIds.includes(row.id)),
    [filteredRows, selectedRowIds],
  );

  const allVisibleSelected =
    paginatedRows.length > 0 &&
    paginatedRows.every((row) => selectedRowIds.includes(row.id));

  const showingFrom = filteredRows.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const showingTo = Math.min(safeCurrentPage * pageSize, filteredRows.length);

  const parseServerErrors = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
      const messages = new Set<string>();
      if (data?.message) messages.add(data.message);
      if (data?.errors) {
        Object.values(data.errors).forEach((values) => {
          values.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const validateAll = () =>
    form.warehouse_id &&
    form.product_id &&
    !validateNumber(form.change, true) &&
    form.change.trim() &&
    Number(form.change) !== 0;

  const toggleRowSelection = (inventoryId: number) => {
    setSelectedRowIds((current) =>
      current.includes(inventoryId)
        ? current.filter((id) => id !== inventoryId)
        : [...current, inventoryId],
    );
  };

  const toggleSelectVisible = () => {
    setSelectedRowIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !paginatedRows.some((row) => row.id === id));
      }

      const next = new Set(current);
      paginatedRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
  };

  const handleAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormTouched(true);
    setServerError(null);
    if (!validateAll()) return;

    try {
      await adjustInventory.mutateAsync({
        warehouse_id: Number(form.warehouse_id),
        product_id: Number(form.product_id),
        change: Number(form.change),
        reason: form.reason as
          | "PURCHASE"
          | "SALE"
          | "ADJUSTMENT"
          | "RETURN"
          | "DAMAGE",
        note: form.note.trim() || undefined,
      });

      toast.success(t("inventory.updateSuccess"), {
        description: t("inventory.updateSuccessDescription", {
          change: form.change,
        }),
      });

      setForm({
        warehouse_id: "",
        product_id: "",
        change: "",
        reason: "ADJUSTMENT",
        note: "",
      });
      setFormTouched(false);
    } catch (error) {
      setServerError(parseServerErrors(error, t("inventory.updateError")));
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("inventory.title")}
      subtitle={t("inventory.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-gray-500">
            {t("inventory.kicker")}
          </p>
          <p className="max-w-3xl text-sm text-gray-600">{t("inventory.lead")}</p>
        </div>

        <section className="mt-5 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("inventory.tableView.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("inventory.tableView.description")}
            </p>
          </div>

          <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-red-700">
              <p className="text-sm font-semibold">
                {t("inventory.tableView.urgentSummary", { count: summary.urgent })}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-amber-700">
              <p className="text-sm font-semibold">
                {t("inventory.tableView.lowSummary", { count: summary.low })}
              </p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-700">
              <p className="text-sm font-semibold">
                {t("inventory.tableView.healthySummary", {
                  count: summary.healthy,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {t("inventory.tableView.allInventoryTitle")}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {t("inventory.tableView.allInventoryDescription")}
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.2fr)_repeat(4,minmax(0,0.7fr))]">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("inventory.tableView.searchPlaceholder")}
                  className="h-10 rounded-md border-gray-300"
                />

                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                >
                  <option value="">{t("inventory.tableView.allCategories")}</option>
                  {(categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>

                <select
                  value={warehouseFilter}
                  onChange={(event) => setWarehouseFilter(event.target.value)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                >
                  <option value="">{t("inventory.tableView.allWarehouses")}</option>
                  {(warehouses ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>

                <select
                  value={stockFilter}
                  onChange={(event) =>
                    setStockFilter(event.target.value as "all" | StockStatus)
                  }
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                >
                  <option value="all">{t("inventory.tableView.allStatus")}</option>
                  <option value="in">{t("inventory.tableView.inStock")}</option>
                  <option value="low">{t("inventory.tableView.lowStock")}</option>
                  <option value="out">{t("inventory.tableView.outOfStock")}</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as SortOption)}
                  className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                >
                  <option value="stock_asc">{t("inventory.tableView.sortStockLowHigh")}</option>
                  <option value="stock_desc">{t("inventory.tableView.sortStockHighLow")}</option>
                  <option value="name_asc">{t("inventory.tableView.sortName")}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={allVisibleSelected}
                  onChange={toggleSelectVisible}
                  aria-label={t("inventory.tableView.selectVisible")}
                />
                <span>{t("inventory.tableView.selectPage")}</span>
              </label>
              <span>
                {t("inventory.tableView.showing", {
                  from: showingFrom,
                  to: showingTo,
                  total: filteredRows.length,
                })}
              </span>
              {selectedRows.length > 0 ? (
                <span>{t("inventory.tableView.selected", { count: selectedRows.length })}</span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSizeOption)}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
              >
                <option value={10}>{t("inventory.tableView.pageSize", { count: 10 })}</option>
                <option value={25}>{t("inventory.tableView.pageSize", { count: 25 })}</option>
                <option value={50}>{t("inventory.tableView.pageSize", { count: 50 })}</option>
              </select>

              {selectedRows.length > 0 ? (
                <Button asChild type="button" className="h-10 rounded-md px-4">
                  <Link href={buildBulkPurchaseHref(selectedRows)}>
                    {t("inventory.tableView.restockSelected")}
                  </Link>
                </Button>
              ) : (
                <Button type="button" className="h-10 rounded-md px-4" disabled>
                  {t("inventory.tableView.restockSelected")}
                </Button>
              )}
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 py-5 text-sm text-gray-600 sm:px-5">
              {t("inventory.loading")}
            </div>
          ) : null}

          {predictionsQuery.isLoading && !isLoading ? (
            <div className="px-4 py-5 text-sm text-gray-600 sm:px-5">
              {t("inventory.predictions.loading")}
            </div>
          ) : null}

          {isError ? (
            <div className="px-4 py-5 text-sm text-destructive sm:px-5">
              {t("inventory.loadError")}
            </div>
          ) : null}

          {predictionsQuery.isError ? (
            <div className="px-4 py-5 text-sm text-destructive sm:px-5">
              {t("inventory.predictions.loadError")}
            </div>
          ) : null}

          {!isLoading && !isError && filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-600 sm:px-5">
              {allRows.length === 0
                ? t("inventory.empty")
                : t("inventory.tableView.emptyFiltered")}
            </div>
          ) : null}

          {!isLoading && !isError && filteredRows.length > 0 && summary.urgent + summary.low === 0 ? (
            <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
                {t("inventory.tableView.healthyState")}
              </div>
            </div>
          ) : null}

          {!isLoading && !isError && paginatedRows.length > 0 ? (
            <>
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-left">
                        <th className="w-12 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          <span className="sr-only">{t("inventory.tableView.selectPage")}</span>
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.productName")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.sku")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.category")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.warehouse")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.stock")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("inventory.tableView.dailySales")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.status")}
                        </th>
                        <th className="px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">
                          {t("common.action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-200 align-top">
                          <td className="px-5 py-4">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-gray-300"
                              checked={selectedRowIds.includes(row.id)}
                              onChange={() => toggleRowSelection(row.id)}
                              aria-label={t("inventory.tableView.selectRow", {
                                name: row.product.name,
                              })}
                            />
                          </td>
                          <td className="px-5 py-4">
                            <p className="line-clamp-2 max-w-[18rem] text-sm font-semibold text-gray-900">
                              {row.product.name}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {row.product.sku || t("common.notAssigned")}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {row.product.category?.name ?? t("productsPage.uncategorized")}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {row.warehouse.name}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            <span className={`font-semibold ${STOCK_STATUS_META[row.stockStatus].emphasisClass}`}>
                              {formatNumber(row.effectiveStock, locale)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-700">
                            {row.dailySalesText}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STOCK_STATUS_META[row.stockStatus].badgeClass}`}
                            >
                              {stockStatusLabels[row.stockStatus]}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Button asChild type="button" className="h-10 rounded-md px-4">
                              <Link href={buildPurchaseHref(row)}>
                                {t("inventory.tableView.restockNow")}
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {paginatedRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300"
                        checked={selectedRowIds.includes(row.id)}
                        onChange={() => toggleRowSelection(row.id)}
                        aria-label={t("inventory.tableView.selectRow", {
                          name: row.product.name,
                        })}
                      />

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {row.product.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {t("common.skuLabel", {
                            value: row.product.sku || t("common.notAssigned"),
                          })}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {row.product.category?.name ?? t("productsPage.uncategorized")} |{" "}
                          {row.warehouse.name}
                        </p>

                        <div className="mt-4 grid gap-2 text-sm text-gray-700">
                          <p>
                            <span className="font-medium">
                              {t("inventory.tableView.stockLabel", { value: "" }).replace(/: $/, ":")}
                            </span>{" "}
                            <span className={STOCK_STATUS_META[row.stockStatus].emphasisClass}>
                              {formatNumber(row.effectiveStock, locale)}
                            </span>
                          </p>
                          <p>
                            <span className="font-medium">
                              {t("inventory.tableView.dailySalesLabel", { value: "" }).replace(/: $/, ":")}
                            </span>{" "}
                            {row.dailySalesText}
                          </p>
                          <p>
                            <span className="font-medium">
                              {t("inventory.tableView.statusLabel", { value: "" }).replace(/: $/, ":")}
                            </span>{" "}
                            {stockStatusLabels[row.stockStatus]}
                          </p>
                        </div>

                        <div className="mt-4">
                          <Button asChild type="button" className="h-10 rounded-md px-4">
                            <Link href={buildPurchaseHref(row)}>
                              {t("inventory.tableView.restockNow")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-sm text-gray-600">
                  {t("inventory.tableView.pageStatus", {
                    current: safeCurrentPage,
                    total: totalPages,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safeCurrentPage <= 1}
                  >
                    {t("common.previous")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-md"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={safeCurrentPage >= totalPages}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("inventory.adjustTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("inventory.adjustDescription")}</p>
          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleAdjust} noValidate>
            <div className="grid gap-2">
              <Label htmlFor="warehouse_select" className="text-xs font-medium text-gray-500">
                {t("inventory.fields.warehouse")}
              </Label>
              <select
                id="warehouse_select"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={form.warehouse_id}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    warehouse_id: event.target.value,
                  }));
                  setServerError(null);
                }}
                aria-invalid={formTouched && !form.warehouse_id}
                aria-describedby={
                  formTouched && !form.warehouse_id ? "warehouse_select-error" : undefined
                }
              >
                <option value="">{t("inventory.selectWarehouse")}</option>
                {(warehouses ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              {formTouched && !form.warehouse_id ? (
                <span
                  id="warehouse_select-error"
                  className="block text-xs text-destructive"
                  role="alert"
                >
                  {t("common.selectOption")}
                </span>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product_select" className="text-xs font-medium text-gray-500">
                {t("inventory.fields.product")}
              </Label>
              <select
                id="product_select"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={form.product_id}
                onChange={(event) => {
                  setForm((prev) => ({
                    ...prev,
                    product_id: event.target.value,
                  }));
                  setServerError(null);
                }}
                aria-invalid={formTouched && !form.product_id}
                aria-describedby={
                  formTouched && !form.product_id ? "product_select-error" : undefined
                }
              >
                <option value="">{t("inventory.selectProduct")}</option>
                {(products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {product.sku}
                  </option>
                ))}
              </select>
              {formTouched && !form.product_id ? (
                <span
                  id="product_select-error"
                  className="block text-xs text-destructive"
                  role="alert"
                >
                  {t("common.selectOption")}
                </span>
              ) : null}
            </div>

            <ValidationField
              id="change"
              label={t("inventory.fields.quantityChange")}
              type="number"
              value={form.change}
              onChange={(value) => {
                setForm((prev) => ({ ...prev, change: value }));
                setServerError(null);
              }}
              validate={(value) => {
                if (!value.trim()) return t("validation.required");
                if (Number.isNaN(Number(value))) return t("validation.validNumber");
                if (Number(value) === 0) return t("inventory.nonZeroQuantity");
                return "";
              }}
              required
              placeholder={t("inventory.placeholders.quantityChange")}
              success
            />

            <div className="grid gap-2">
              <Label htmlFor="reason" className="text-xs font-medium text-gray-500">
                {t("inventory.fields.reason")}
              </Label>
              <select
                id="reason"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={form.reason}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    reason: event.target.value,
                  }))
                }
              >
                <option value="ADJUSTMENT">{t("inventory.reasons.ADJUSTMENT")}</option>
                <option value="PURCHASE">{t("inventory.reasons.PURCHASE")}</option>
                <option value="SALE">{t("inventory.reasons.SALE")}</option>
                <option value="RETURN">{t("inventory.reasons.RETURN")}</option>
                <option value="DAMAGE">{t("inventory.reasons.DAMAGE")}</option>
              </select>
            </div>

            <div className="grid gap-2 lg:col-span-2">
              <Label htmlFor="note" className="text-xs font-medium text-gray-500">
                {t("inventory.fields.note")}
              </Label>
              <Input
                id="note"
                value={form.note}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder={t("inventory.placeholders.note")}
                className="h-10 rounded-md border-gray-300 bg-white"
              />
            </div>

            <div className="lg:col-span-2">
              <Button
                type="submit"
                variant="primary"
                disabled={adjustInventory.isPending || (formTouched && !validateAll())}
                aria-disabled={
                  adjustInventory.isPending || (formTouched && !validateAll())
                }
                className="h-10 rounded-md px-5"
              >
                {t("inventory.applyAdjustment")}
              </Button>
              {(adjustInventory.isError || serverError) && (
                <p className="mt-3 text-sm text-destructive">
                  {serverError ?? t("inventory.updateError")}
                </p>
              )}
            </div>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default InventoryClient;
