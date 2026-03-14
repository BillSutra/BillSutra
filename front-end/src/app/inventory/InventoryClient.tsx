"use client";

import React, { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdjustInventoryMutation,
  useInventoriesQuery,
  useProductsQuery,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";

type InventoryClientProps = {
  name: string;
  image?: string;
};

const InventoryClient = ({ name, image }: InventoryClientProps) => {
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{ name: string; items: typeof data }>;
    const map = new Map<string, typeof data>();
    data.forEach((item) => {
      const key = item.warehouse.name;
      const existing = map.get(key) ?? [];
      existing.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
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

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.warehouse_id) errors.warehouse_id = "Select a warehouse.";
    if (!form.product_id) errors.product_id = "Select a product.";

    const change = Number(form.change);
    if (!Number.isFinite(change) || change === 0) {
      errors.change = "Enter a non-zero quantity change.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!validateForm()) return;

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

      toast.success("Inventory updated", {
        description: `Change: ${form.change} units`,
      });

      setForm({
        warehouse_id: "",
        product_id: "",
        change: "",
        reason: "ADJUSTMENT",
        note: "",
      });
      setFieldErrors({});
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
      title="Warehouse Inventory"
      subtitle="All warehouse stock levels, grouped by location."
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
            Inventory
          </p>
          <p className="max-w-2xl text-base text-gray-500">
            All warehouse stock levels, grouped by location.
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-semibold">Adjust inventory</h2>
            <p className="text-sm text-gray-500">
              Log stock movements for audits and corrections.
            </p>
            <form className="mt-4 grid gap-4" onSubmit={handleAdjust}>
              <div className="grid gap-2">
                <Label
                  htmlFor="warehouse_select"
                  className="text-xs text-gray-500"
                >
                  Warehouse
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
                    setFieldErrors((prev) => ({ ...prev, warehouse_id: "" }));
                    setServerError(null);
                  }}
                >
                  <option value="">Select warehouse</option>
                  {(warehouses ?? []).map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
                {fieldErrors.warehouse_id && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.warehouse_id}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="product_select"
                  className="text-xs text-gray-500"
                >
                  Product
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
                    setFieldErrors((prev) => ({ ...prev, product_id: "" }));
                    setServerError(null);
                  }}
                >
                  <option value="">Select product</option>
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} • {product.sku}
                    </option>
                  ))}
                </select>
                {fieldErrors.product_id && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.product_id}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="change" className="text-xs text-gray-500">
                  Quantity change
                </Label>
                <Input
                  id="change"
                  type="number"
                  value={form.change}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      change: event.target.value,
                    }));
                    setFieldErrors((prev) => ({ ...prev, change: "" }));
                    setServerError(null);
                  }}
                  placeholder="Use negative values to remove stock"
                  className="h-10 rounded-xl border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                />
                {fieldErrors.change && (
                  <p className="text-xs text-destructive">
                    {fieldErrors.change}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reason" className="text-xs text-gray-500">
                  Reason
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
                  <option value="ADJUSTMENT">Adjustment</option>
                  <option value="PURCHASE">Purchase</option>
                  <option value="SALE">Sale</option>
                  <option value="RETURN">Return</option>
                  <option value="DAMAGE">Damage</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note" className="text-xs text-gray-500">
                  Note
                </Label>
                <Input
                  id="note"
                  value={form.note}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, note: event.target.value }))
                  }
                  placeholder="Optional context"
                  className="h-10 rounded-xl border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                disabled={adjustInventory.isPending}
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

          <div className="grid gap-4">
            {isLoading && (
              <p className="text-sm text-gray-500">Loading inventory...</p>
            )}
            {isError && (
              <p className="text-sm text-destructive">
                Failed to load inventory.
              </p>
            )}
            {!isLoading && !isError && grouped.length === 0 && (
              <p className="text-sm text-gray-500">No inventory records yet.</p>
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
                              {item.product.name} • {item.product.sku}
                            </p>
                            <p className="text-xs text-gray-500">
                              Reorder at {item.product.reorder_level}
                            </p>
                          </div>
                          <div className="text-sm text-gray-500">
                            Stock: {item.quantity}
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
