"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import { Input } from "@/components/ui/input";
import { validateNumber } from "@/lib/validation";
import {
  useAdjustInventoryMutation,
  useInventoriesQuery,
  useProductsQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import { useInventoryDemandPredictions } from "@/hooks/usePredictionQueries";
import { useInventoryInsights } from "@/hooks/usePredictionQueries";
import InventoryPredictionDrawer from "@/components/inventory/inventory-prediction-drawer";
import SmartInventoryInsights from "@/components/inventory/SmartInventoryInsights";
import { useI18n } from "@/providers/LanguageProvider";
import type { Inventory, InventoryDemandPrediction } from "@/lib/apiClient";

type InventoryClientProps = {
  name: string;
  image?: string;
};

type InventoryRow = Inventory & {
  prediction: InventoryDemandPrediction | null;
};

const InventoryClient = ({ name, image }: InventoryClientProps) => {
  const { locale, t } = useI18n();
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "warning" | "normal">("all");
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const scopedWarehouseId = selectedWarehouseId ? Number(selectedWarehouseId) : undefined;
  const { data, isLoading, isError } = useInventoriesQuery(scopedWarehouseId);
  const { data: products } = useProductsQuery();
  const { data: warehouses } = useWarehousesQuery();
  const predictionsQuery = useInventoryDemandPredictions(
    scopedWarehouseId ? { warehouseId: scopedWarehouseId } : undefined,
  );
  const insightsQuery = useInventoryInsights(scopedWarehouseId);
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

  const predictionByProductId = useMemo(
    () =>
      new Map(
        (predictionsQuery.data?.predictions ?? []).map((prediction) => [
          prediction.product_id,
          prediction,
        ]),
      ),
    [predictionsQuery.data?.predictions],
  );

  const grouped = useMemo(() => {
    if (!data) {
      return [] as Array<{ name: string; items: InventoryRow[] }>;
    }

    const map = new Map<string, InventoryRow[]>();
    data.forEach((item) => {
      const key = item.warehouse.name;
      const existing = map.get(key) ?? [];
      const prediction = predictionByProductId.get(item.product.id) ?? null;
      if (alertFilter !== "all" && prediction?.alert_level !== alertFilter) {
        return;
      }
      existing.push({
        ...item,
        prediction,
      });
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([warehouseName, items]) => ({
      name: warehouseName,
      items: items.sort((left, right) => {
        const leftDays = left.prediction?.days_until_stockout ?? 9999;
        const rightDays = right.prediction?.days_until_stockout ?? 9999;
        return leftDays - rightDays;
      }),
    }));
  }, [alertFilter, data, predictionByProductId]);

  const selectedInventoryItem = useMemo(
    () => data?.find((item) => item.id === selectedInventoryId) ?? null,
    [data, selectedInventoryId],
  );

  const selectedPrediction =
    selectedInventoryItem?.product.id
      ? predictionByProductId.get(selectedInventoryItem.product.id) ?? null
      : null;

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

  const validateAll = () => {
    return (
      form.warehouse_id &&
      form.product_id &&
      !validateNumber(form.change, true) &&
      form.change.trim() &&
      Number(form.change) !== 0
    );
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
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
            {t("inventory.kicker")}
          </p>
          <p className="max-w-2xl text-base text-gray-500">
            {t("inventory.lead")}
          </p>
        </div>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {t("inventory.predictions.title")}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t("inventory.predictions.description")}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {predictionsQuery.data?.metadata
                  ? t("inventory.predictions.metadata", {
                      date: new Date(
                        predictionsQuery.data.metadata.generatedAt,
                      ).toLocaleDateString(locale),
                      basisDays: predictionsQuery.data.metadata.basisWindowDays,
                      scope:
                        predictionsQuery.data.metadata.warehouseScope.mode ===
                        "warehouse"
                          ? t("inventory.predictions.warehouseSpecific")
                          : t("inventory.predictions.allInventory"),
                    })
                  : t("inventory.predictions.metadataPending")}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
              <div className="grid gap-2">
                <Label htmlFor="inventory-warehouse-scope" className="text-xs text-gray-500">
                  {t("inventory.predictions.warehouseScope")}
                </Label>
                <select
                  id="inventory-warehouse-scope"
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  value={selectedWarehouseId}
                  onChange={(event) => setSelectedWarehouseId(event.target.value)}
                >
                  <option value="">{t("inventory.predictions.allWarehouses")}</option>
                  {(warehouses ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {([
                  ["all", t("inventory.predictions.filters.all")],
                  ["critical", t("inventory.predictions.filters.critical")],
                  ["warning", t("inventory.predictions.filters.warning")],
                  ["normal", t("inventory.predictions.filters.normal")],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAlertFilter(value)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${
                      alertFilter === value
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/70 dark:bg-indigo-500/10 dark:text-indigo-100"
                        : "border-gray-200 bg-white text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SmartInventoryInsights
          data={insightsQuery.data}
          isLoading={insightsQuery.isLoading}
          isError={insightsQuery.isError}
        />

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold">{t("inventory.adjustTitle")}</h2>
            <p className="text-sm text-gray-500">
              {t("inventory.adjustDescription")}
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleAdjust}
              noValidate
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="warehouse_select"
                  className="text-xs text-gray-500"
                >
                  {t("inventory.fields.warehouse")}
                </Label>
                <select
                  id="warehouse_select"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
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
                    formTouched && !form.warehouse_id
                      ? "warehouse_select-error"
                      : undefined
                  }
                >
                  <option value="">{t("inventory.selectWarehouse")}</option>
                  {(warehouses ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {formTouched && !form.warehouse_id && (
                  <span
                    id="warehouse_select-error"
                    className="text-xs text-destructive block"
                    role="alert"
                  >
                    {t("common.selectOption")}
                  </span>
                )}
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="product_select"
                  className="text-xs text-gray-500"
                >
                  {t("inventory.fields.product")}
                </Label>
                <select
                  id="product_select"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
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
                    formTouched && !form.product_id
                      ? "product_select-error"
                      : undefined
                  }
                >
                  <option value="">{t("inventory.selectProduct")}</option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku}
                    </option>
                  ))}
                </select>
                {formTouched && !form.product_id && (
                  <span
                    id="product_select-error"
                    className="text-xs text-destructive block"
                    role="alert"
                  >
                    {t("common.selectOption")}
                  </span>
                )}
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
                  if (isNaN(Number(value))) return t("validation.validNumber");
                  if (Number(value) === 0) {
                    return t("inventory.nonZeroQuantity");
                  }
                  return "";
                }}
                required
                placeholder={t("inventory.placeholders.quantityChange")}
                success
              />
              <div className="grid gap-2">
                <Label htmlFor="reason" className="text-xs text-gray-500">
                  {t("inventory.fields.reason")}
                </Label>
                <select
                  id="reason"
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  value={form.reason}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      reason: event.target.value,
                    }))
                  }
                >
                  <option value="ADJUSTMENT">
                    {t("inventory.reasons.ADJUSTMENT")}
                  </option>
                  <option value="PURCHASE">
                    {t("inventory.reasons.PURCHASE")}
                  </option>
                  <option value="SALE">{t("inventory.reasons.SALE")}</option>
                  <option value="RETURN">
                    {t("inventory.reasons.RETURN")}
                  </option>
                  <option value="DAMAGE">
                    {t("inventory.reasons.DAMAGE")}
                  </option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note" className="text-xs text-gray-500">
                  {t("inventory.fields.note")}
                </Label>
                <Input
                  id="note"
                  value={form.note}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder={t("inventory.placeholders.note")}
                  className="h-10 rounded-xl border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={
                  adjustInventory.isPending || (formTouched && !validateAll())
                }
                aria-disabled={
                  adjustInventory.isPending || (formTouched && !validateAll())
                }
              >
                {t("inventory.applyAdjustment")}
              </Button>
              {(adjustInventory.isError || serverError) && (
                <p className="text-sm text-destructive">
                  {serverError ?? t("inventory.updateError")}
                </p>
              )}
            </form>
          </div>

          <div className="grid gap-4">
            {isLoading && (
              <p className="text-sm text-gray-500">{t("inventory.loading")}</p>
            )}
            {predictionsQuery.isLoading && !isLoading && (
              <p className="text-sm text-gray-500">
                {t("inventory.predictions.loading")}
              </p>
            )}
            {isError && (
              <p className="text-sm text-destructive">
                {t("inventory.loadError")}
              </p>
            )}
            {predictionsQuery.isError && (
              <p className="text-sm text-destructive">
                {t("inventory.predictions.loadError")}
              </p>
            )}
            {!isLoading && !isError && grouped.length === 0 && (
              <p className="text-sm text-gray-500">{t("inventory.empty")}</p>
            )}
            {!isLoading && !isError && grouped.length > 0 && (
              <div className="grid gap-4">
                {grouped.map((group) => (
                  <div
                    key={group.name}
                    className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <h2 className="text-lg font-semibold">{group.name}</h2>
                    <div className="mt-4 hidden grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.9fr))_auto] gap-3 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500 lg:grid">
                      <span>{t("inventory.predictions.columns.product")}</span>
                      <span>{t("inventory.predictions.columns.stockLeft")}</span>
                      <span>{t("inventory.predictions.columns.dailySales")}</span>
                      <span>{t("inventory.predictions.columns.daysToStockout")}</span>
                      <span>{t("inventory.predictions.columns.reorderQty")}</span>
                      <span>{t("inventory.predictions.columns.action")}</span>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {group.items?.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 transition-colors hover:bg-indigo-50/60 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-indigo-500/10 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,0.9fr))_auto]"
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedInventoryId(item.id)}
                            className="text-left"
                          >
                            <p className="text-base font-semibold">
                              {item.product.name} - {item.product.sku}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t("inventory.reorderAt", {
                                level: item.product.reorder_level,
                              })}
                            </p>
                          </button>
                          <div className="text-sm text-gray-500">
                            {item.prediction?.stock_left ?? item.quantity}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.prediction
                              ? item.prediction.predicted_daily_sales.toFixed(1)
                              : t("inventory.predictions.notAvailable")}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.prediction
                              ? item.prediction.days_until_stockout >= 999
                                ? t("inventory.predictions.notProjected")
                                : item.prediction.days_until_stockout
                              : t("inventory.predictions.notAvailable")}
                          </div>
                          <div className="text-sm text-gray-500">
                            {item.prediction
                              ? item.prediction.recommended_reorder_quantity
                              : t("inventory.predictions.notAvailable")}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setSelectedInventoryId(item.id)}
                            >
                              {t("inventory.predictions.viewInsight")}
                            </Button>
                            {item.prediction ? (
                              <Button asChild type="button" variant="outline">
                                <Link
                                  href={`/purchases?productId=${item.product.id}&warehouseId=${item.warehouse.id}&quantity=${item.prediction.recommended_reorder_quantity}&unitCost=${item.prediction.unit_cost}&productLabel=${encodeURIComponent(`${item.product.name} - ${item.product.sku}`)}`}
                                >
                                  {t("inventory.predictions.createPurchaseSuggestion")}
                                </Link>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <InventoryPredictionDrawer
        open={selectedInventoryId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedInventoryId(null);
          }
        }}
        inventoryItem={selectedInventoryItem}
        prediction={selectedPrediction}
        metadata={predictionsQuery.data?.metadata ?? null}
      />
    </DashboardLayout>
  );
};

export default InventoryClient;
