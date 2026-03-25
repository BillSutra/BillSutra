"use client";

import React, { useState } from "react";
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
  const { data, isLoading, isError } = useWarehousesQuery();
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
    name: string,
    location?: string | null,
  ) => {
    setEditingId(id);
    setEditForm({ name, location: location ?? "" });
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
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            {t("warehousesPage.kicker")}
          </p>
          <p className="max-w-2xl text-base text-muted-foreground">
            {t("warehousesPage.lead")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {t("warehousesPage.createTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("warehousesPage.createDescription")}
            </p>
            <form className="mt-4 grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-2">
                <Label htmlFor="warehouse_name">
                  {t("warehousesPage.fields.name")}
                </Label>
                <Input
                  id="warehouse_name"
                  value={form.name}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, name: event.target.value }));
                    setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    setServerError(null);
                  }}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive">{fieldErrors.name}</p>
                )}
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
                />
              </div>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
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
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">
              {t("warehousesPage.listTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("warehousesPage.listDescription")}
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-muted-foreground">
                  {t("warehousesPage.loading")}
                </p>
              )}
              {isError && (
                <p className="text-sm text-destructive">
                  {t("warehousesPage.loadError")}
                </p>
              )}
              {!isLoading && !isError && data && data.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("warehousesPage.empty")}
                </p>
              )}
              {!isLoading && !isError && data && data.length > 0 && (
                <div className="grid gap-3">
                  {data.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className="rounded-xl border border-border bg-muted px-4 py-3"
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
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                              {t("warehousesPage.actions.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleEditCancel}
                            >
                              {t("warehousesPage.actions.cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              {warehouse.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {warehouse.location ??
                                t("warehousesPage.locationNotSet")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/warehouses/${warehouse.id}`}
                              className="text-sm text-primary"
                            >
                              {t("warehousesPage.actions.viewStock")}
                            </Link>
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
                            >
                              {t("warehousesPage.actions.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => handleDelete(warehouse.id)}
                              disabled={deleteWarehouse.isPending}
                            >
                              {t("warehousesPage.actions.delete")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default WarehousesClient;
