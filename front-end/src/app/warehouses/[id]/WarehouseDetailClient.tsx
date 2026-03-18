"use client";

import React, { useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ValidationField } from "@/components/ui/ValidationField";
import { validateNumber } from "@/lib/validation";
import {
  useAdjustInventoryMutation,
  useInventoriesQuery,
  useProductsQuery,
  useWarehouseQuery,
} from "@/hooks/useInventoryQueries";

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

  const validateAll = () => {
    return (
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

      toast.success("Inventory updated", {
        description: `Change: ${form.change} units`,
      });

      setForm({ product_id: "", change: "", reason: "ADJUSTMENT", note: "" });
      setFieldErrors({});
      setFormTouched(false);
    } catch (error) {
      setServerError(
        parseServerErrors(error, "Unable to adjust inventory right now."),
      );
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={data?.name ?? "Warehouse"}
      subtitle={data?.location ?? "Location not set"}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <Link href="/warehouses" className="text-sm text-primary">
            ← Back to warehouses
          </Link>
          <p className="max-w-2xl text-base text-muted-foreground">
            {data?.location ?? "Location not set"}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Quick adjust</h2>
            <p className="text-sm text-muted-foreground">
              Apply a stock change directly to this warehouse.
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleAdjust}
              noValidate
            >
              <div className="grid gap-2">
                <Label htmlFor="product_select">Product</Label>
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
                  <option value="">Select product</option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} • {product.sku}
                    </option>
                  ))}
                </select>
                {formTouched && !form.product_id && (
                  <span
                    id="product_select-error"
                    className="text-xs text-destructive block"
                    role="alert"
                  >
                    Please select an option
                  </span>
                )}
              </div>
              <ValidationField
                id="change"
                label="Quantity change"
                type="number"
                value={form.change}
                onChange={(value) => {
                  setForm((prev) => ({ ...prev, change: value }));
                  setFieldErrors((prev) => ({ ...prev, change: "" }));
                  setServerError(null);
                }}
                validate={(value) => {
                  if (!value.trim()) return "This field is required";
                  if (isNaN(Number(value))) return "Enter a valid number";
                  if (Number(value) === 0)
                    return "Enter a non-zero quantity change.";
                  return "";
                }}
                required
                placeholder="Use negative values to remove stock"
                success
              />
              <div className="grid gap-2">
                <Label htmlFor="reason">Reason</Label>
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
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="PURCHASE">Purchase</option>
                  <option value="SALE">Sale</option>
                  <option value="RETURN">Return</option>
                  <option value="DAMAGE">Damage</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note">Note</Label>
                <Input
                  id="note"
                  value={form.note}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="Optional context"
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
                Apply adjustment
              </Button>
              {(adjustInventory.isError || serverError) && (
                <p className="text-sm text-destructive">
                  {serverError ?? "Unable to adjust inventory right now."}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Stock left</h2>
                <p className="text-sm text-muted-foreground">
                  Remaining stock by product for this warehouse.
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                {inventories ? `${stockItems.length} items` : ""}
              </div>
            </div>
            {(isLoading || isLoadingInventory) && (
              <p className="text-sm text-muted-foreground">
                Loading inventory...
              </p>
            )}
            {(isError || isInventoryError) && (
              <p className="text-sm text-destructive">
                Failed to load inventory.
              </p>
            )}
            {!isLoading &&
              !isError &&
              !isLoadingInventory &&
              !isInventoryError &&
              (!inventories || stockItems.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No items stored here yet.
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
                          {item.product.name} • {item.product.sku}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Stock left: {item.quantity}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Reorder level: {item.product.reorder_level}
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
