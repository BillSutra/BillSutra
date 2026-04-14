"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateWarehouseMutation,
  useDeleteWarehouseMutation,
  useInventoriesQuery,
  useUpdateWarehouseMutation,
  useWarehousesQuery,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type WarehousesClientProps = {
  name: string;
  image?: string;
};

const WarehousesClient = ({ name, image }: WarehousesClientProps) => {
  const { t } = useI18n();
  const { data: warehouses, isLoading, isError } = useWarehousesQuery();
  const { data: inventories } = useInventoriesQuery();
  const createWarehouse = useCreateWarehouseMutation();
  const updateWarehouse = useUpdateWarehouseMutation();
  const deleteWarehouse = useDeleteWarehouseMutation();
  const [form, setForm] = useState({ name: "", location: "" });
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof typeof form, string>>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", location: "" });

  const warehouseCards = useMemo(() => {
    const inventoryList = inventories ?? [];

    return (warehouses ?? []).map((warehouse) => {
      const warehouseItems = inventoryList.filter((item) => {
        const resolvedWarehouseId = item.warehouse_id ?? item.warehouse?.id;
        return resolvedWarehouseId === warehouse.id;
      });

      const totalProducts = warehouseItems.length;
      const outOfStock = warehouseItems.filter((item) => item.quantity <= 0).length;
      const lowStock = warehouseItems.filter(
        (item) =>
          item.quantity > 0 && item.quantity <= (item.product.reorder_level ?? 0),
      ).length;

      return {
        ...warehouse,
        totalProducts,
        lowStock,
        outOfStock,
      };
    });
  }, [inventories, warehouses]);

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
    const errors: Partial<Record<keyof typeof form, string>> = {};
    if (form.name.trim().length < 2) {
      errors.name = t("warehousesPage.validation.nameMin");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);
    if (!validateForm()) return;

    try {
      await createWarehouse.mutateAsync({
        name: form.name.trim(),
        location: form.location.trim() || undefined,
      });
      toast.success(t("warehousesPage.created"), {
        description: form.name.trim(),
      });
      setForm({ name: "", location: "" });
      setFieldErrors({});
    } catch (error) {
      setServerError(parseServerErrors(error, t("warehousesPage.createError")));
    }
  };

  const handleEditStart = (
    id: number,
    warehouseName: string,
    location?: string | null,
  ) => {
    setEditingId(id);
    setEditForm({ name: warehouseName, location: location ?? "" });
    setServerError(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({ name: "", location: "" });
  };

  const handleEditSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    if (editForm.name.trim().length < 2) {
      setServerError(t("warehousesPage.validation.nameMin"));
      return;
    }

    try {
      await updateWarehouse.mutateAsync({
        id: editingId,
        payload: {
          name: editForm.name.trim(),
          location: editForm.location.trim() || undefined,
        },
      });
      toast.success(t("warehousesPage.updated"), {
        description: editForm.name.trim(),
      });
      handleEditCancel();
    } catch (error) {
      setServerError(parseServerErrors(error, t("warehousesPage.updateError")));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t("warehousesPage.confirmDelete"))) return;
    try {
      await deleteWarehouse.mutateAsync(id);
      toast.success(t("warehousesPage.deleted"));
    } catch (error) {
      setServerError(parseServerErrors(error, t("warehousesPage.deleteError")));
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("warehousesPage.title")}
      subtitle={t("warehousesPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-gray-500">
            {t("warehousesPage.kicker")}
          </p>
          <p className="max-w-3xl text-sm text-gray-600">{t("warehousesPage.lead")}</p>
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.7fr)]">
          <aside className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 xl:sticky xl:top-24">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("warehousesPage.createTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {t("warehousesPage.createDescription")}
            </p>

            <form className="mt-5 grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-2">
                <Label htmlFor="warehouse_name">{t("warehousesPage.fields.name")}</Label>
                <Input
                  id="warehouse_name"
                  value={form.name}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, name: event.target.value }));
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    setServerError(null);
                  }}
                  className="h-10 rounded-md border-gray-300"
                />
                {fieldErrors.name ? (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="warehouse_location">
                  {t("warehousesPage.fields.location")}
                </Label>
                <Input
                  id="warehouse_location"
                  value={form.location}
                  onChange={(event) => {
                    setForm((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }));
                    setServerError(null);
                  }}
                  placeholder={t("warehousesPage.placeholders.location")}
                  className="h-10 rounded-md border-gray-300"
                />
              </div>

              <Button
                type="submit"
                className="h-10 rounded-md"
                disabled={createWarehouse.isPending}
              >
                {t("warehousesPage.actions.add")}
              </Button>

              {(createWarehouse.isError || serverError) && (
                <p className="text-sm text-destructive">
                  {serverError ?? t("warehousesPage.createError")}
                </p>
              )}
            </form>
          </aside>

          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-1 border-b border-gray-200 pb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {t("warehousesPage.listTitle")}
              </h2>
              <p className="text-sm text-gray-600">
                {t("warehousesPage.listDescription")}
              </p>
            </div>

            <div className="mt-5">
              {isLoading ? (
                <p className="text-sm text-gray-600">{t("warehousesPage.loading")}</p>
              ) : null}

              {isError ? (
                <p className="text-sm text-destructive">
                  {t("warehousesPage.loadError")}
                </p>
              ) : null}

              {!isLoading && !isError && warehouseCards.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
                  <p className="text-base font-semibold text-gray-900">No warehouse yet</p>
                  <p className="mt-2 text-sm text-gray-600">
                    Create your first warehouse to start tracking stock
                  </p>
                </div>
              ) : null}

              {!isLoading && !isError && warehouseCards.length > 0 ? (
                <div className="grid gap-4">
                  {warehouseCards.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-4"
                    >
                      {editingId === warehouse.id ? (
                        <form className="grid gap-3" onSubmit={handleEditSave}>
                          <div className="grid gap-2">
                            <Label>{t("warehousesPage.fields.name")}</Label>
                            <Input
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }))
                              }
                              className="h-10 rounded-md border-gray-300"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label>{t("warehousesPage.fields.location")}</Label>
                            <Input
                              value={editForm.location}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  location: event.target.value,
                                }))
                              }
                              className="h-10 rounded-md border-gray-300"
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" className="h-10 rounded-md">
                              {t("warehousesPage.actions.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleEditCancel}
                              className="h-10 rounded-md"
                            >
                              {t("warehousesPage.actions.cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-gray-900">
                              {warehouse.name}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {warehouse.location
                                ? `Location: ${warehouse.location}`
                                : t("warehousesPage.locationNotSet")}
                            </p>

                            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
                                  Total Products
                                </p>
                                <p className="mt-1 text-lg font-semibold text-gray-900">
                                  {warehouse.totalProducts}
                                </p>
                              </div>
                              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-700">
                                  Low Stock
                                </p>
                                <p className="mt-1 text-lg font-semibold text-amber-700">
                                  {warehouse.lowStock}
                                </p>
                              </div>
                              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.12em] text-red-700">
                                  Out of Stock
                                </p>
                                <p className="mt-1 text-lg font-semibold text-red-700">
                                  {warehouse.outOfStock}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <Button asChild type="button" className="h-10 rounded-md px-4">
                              <Link href={`/inventory?warehouseId=${warehouse.id}`}>
                                View Inventory
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                handleEditStart(
                                  warehouse.id,
                                  warehouse.name,
                                  warehouse.location,
                                )
                              }
                              className="h-10 rounded-md"
                            >
                              {t("warehousesPage.actions.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleDelete(warehouse.id)}
                              disabled={deleteWarehouse.isPending}
                              className="h-10 rounded-md"
                            >
                              {t("warehousesPage.actions.delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default WarehousesClient;
