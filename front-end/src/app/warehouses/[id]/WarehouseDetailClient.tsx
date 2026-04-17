"use client";

import React, { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  useAdjustInventoryMutation,
  useInventoriesQuery,
  useProductsQuery,
  useWarehouseQuery,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type WarehouseDetailClientProps = {
  name: string;
  image?: string;
  warehouseId: number;
};

const WarehouseDetailClient = ({
  name,
  image,
  warehouseId,
}: WarehouseDetailClientProps) => {
  const { t, safeT } = useI18n();
  const { data, isLoading, isError } = useWarehouseQuery(warehouseId);
  const {
    data: inventories,
    isLoading: isLoadingInventory,
    isError: isInventoryError,
  } = useInventoriesQuery(warehouseId);
  const { data: products } = useProductsQuery();
  const adjustInventory = useAdjustInventoryMutation();
  const [form, setForm] = useState({
    product_id: "",
    change: "",
    reason: "ADJUSTMENT",
    note: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);

  const filteredInventories = (inventories ?? []).filter((item) => {
    const resolvedId = item.warehouse_id ?? item.warehouse?.id;
    return resolvedId === warehouseId;
  });

  const stockItems =
    filteredInventories.length > 0
      ? filteredInventories
      : (data?.inventories ?? []);

  const parseServerErrors = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      const payload = error.response?.data as
        | { message?: string; errors?: Record<string, string[]> }
        | undefined;
      const messages = new Set<string>();
      if (payload?.message) messages.add(payload.message);
      if (payload?.errors) {
        Object.values(payload.errors).forEach((values) => {
          values.forEach((value) => messages.add(value));
        });
      }
      if (messages.size) return Array.from(messages).join(" ");
    }
    return fallback;
  };

  const validateQuantityChange = (value: string) => {
    if (!value.trim()) return t("validation.required");
    if (Number.isNaN(Number(value))) return t("validation.validNumber");
    if (Number(value) === 0) return t("inventory.nonZeroQuantity");
    return "";
  };

  const validateAll = () => {
    return (
      form.product_id &&
      !validateQuantityChange(form.change) &&
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
        warehouse_id: warehouseId,
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

      setForm({ product_id: "", change: "", reason: "ADJUSTMENT", note: "" });
      setFieldErrors({});
      setFormTouched(false);
    } catch (error) {
      setServerError(parseServerErrors(error, t("inventory.updateError")));
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={data?.name ?? t("warehousesPage.detail.titleFallback")}
      subtitle={data?.location ?? t("warehousesPage.locationNotSet")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <Link href="/warehouses" className="text-sm text-primary">
            {t("warehousesPage.detail.backToWarehouses")}
          </Link>
          <p className="max-w-2xl text-base text-muted-foreground">
            {data?.location ?? t("warehousesPage.locationNotSet")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {t("warehousesPage.detail.quickAdjustTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("warehousesPage.detail.quickAdjustDescription")}
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleAdjust}
              noValidate
            >
              <div className="grid gap-2">
                <Label htmlFor="product_select">{t("inventory.fields.product")}</Label>
                <select
                  id="product_select"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.product_id}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      product_id: event.target.value,
                    }));
                    setFieldErrors((prev) => ({ ...prev, product_id: "" }));
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
                    {safeT(
                      "validation.selectOptionError",
                      "Please select an option",
                    )}
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
                  setFieldErrors((prev) => ({ ...prev, change: "" }));
                  setServerError(null);
                }}
                validate={validateQuantityChange}
                required
                placeholder={t("inventory.placeholders.quantityChange")}
                success
              />
              <div className="grid gap-2">
                <Label htmlFor="reason">{t("inventory.fields.reason")}</Label>
                <select
                  id="reason"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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
                  <option value="RETURN">{t("inventory.reasons.RETURN")}</option>
                  <option value="DAMAGE">{t("inventory.reasons.DAMAGE")}</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note">{t("inventory.fields.note")}</Label>
                <Input
                  id="note"
                  value={form.note}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder={t("inventory.placeholders.note")}
                />
              </div>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("warehousesPage.detail.stockTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {t("warehousesPage.detail.stockDescription")}
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {inventories
                  ? t("warehousesPage.detail.itemCount", {
                      count: stockItems.length,
                    })
                  : ""}
              </div>
            </div>
            {(isLoading || isLoadingInventory) && (
              <p className="text-sm text-muted-foreground">
                {t("inventory.loading")}
              </p>
            )}
            {(isError || isInventoryError) && (
              <p className="text-sm text-destructive">
                {t("inventory.loadError")}
              </p>
            )}
            {!isLoading &&
              !isError &&
              !isLoadingInventory &&
              !isInventoryError &&
              (!inventories || stockItems.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  {t("warehousesPage.detail.empty")}
                </p>
              )}
            {!isLoading &&
              !isError &&
              !isLoadingInventory &&
              !isInventoryError &&
              inventories &&
              stockItems.length > 0 && (
                <div className="grid gap-3">
                  {stockItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted px-4 py-3"
                    >
                      <div>
                        <p className="text-base font-semibold">
                          {item.product.name} - {item.product.sku}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("warehousesPage.detail.stockLeft", {
                            count: item.quantity,
                          })}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t("warehousesPage.detail.reorderLevel", {
                          count: item.product.reorder_level,
                        })}
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

export default WarehouseDetailClient;
