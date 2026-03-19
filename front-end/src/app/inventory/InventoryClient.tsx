"use client";

import React, { useMemo, useState } from "react";
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
import { useI18n } from "@/providers/LanguageProvider";

type InventoryClientProps = {
  name: string;
  image?: string;
};

const InventoryClient = ({ name, image }: InventoryClientProps) => {
  const { t } = useI18n();
  const { data, isLoading, isError } = useInventoriesQuery();
  const { data: products } = useProductsQuery();
  const { data: warehouses } = useWarehousesQuery();
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

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ name: string; items: typeof data }>;
    const map = new Map<string, typeof data>();
    data.forEach((item) => {
      const key = item.warehouse.name;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([warehouseName, items]) => ({
      name: warehouseName,
      items,
    }));
  }, [data]);

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
            {isError && (
              <p className="text-sm text-destructive">
                {t("inventory.loadError")}
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
                    <div className="mt-4 grid gap-3">
                      {group.items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-colors hover:bg-indigo-50/60 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-indigo-500/10"
                        >
                          <div>
                            <p className="text-base font-semibold">
                              {item.product.name} - {item.product.sku}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t("inventory.reorderAt", {
                                level: item.product.reorder_level,
                              })}
                            </p>
                          </div>
                          <div className="text-sm text-gray-500">
                            {t("inventory.stock", { quantity: item.quantity })}
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
    </DashboardLayout>
  );
};

export default InventoryClient;
