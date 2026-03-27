"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  translateValidationMessage,
  validateName,
  validateEmail,
  validatePhone,
  validateRequired,
} from "@/lib/validation";
import { Label } from "@/components/ui/label";
import {
  useCreateSupplierMutation,
  useDeleteSupplierMutation,
  useSuppliersQuery,
  useUpdateSupplierMutation,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type SuppliersClientProps = {
  name: string;
  image?: string;
};

const SuppliersClient = ({ name, image }: SuppliersClientProps) => {
  const { t } = useI18n();
  const { data, isLoading, isError } = useSuppliersQuery();
  const createSupplier = useCreateSupplierMutation();
  const updateSupplier = useUpdateSupplierMutation();
  const deleteSupplier = useDeleteSupplierMutation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const suppliers = useMemo(() => data ?? [], [data]);

  const withTranslatedValidation =
    (validator: (value: string) => string) => (value: string) =>
      translateValidationMessage(t, validator(value));

  const isMutating =
    createSupplier.isPending ||
    updateSupplier.isPending ||
    deleteSupplier.isPending;

  const resetForm = () =>
    setForm({ name: "", email: "", phone: "", address: "" });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await createSupplier.mutateAsync({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
    });
    resetForm();
  };

  const handleEdit = (id: number) => {
    const current = suppliers.find((supplier) => supplier.id === id);
    if (!current) return;
    setEditingId(id);
    setEditingForm({
      name: current.name ?? "",
      email: current.email ?? "",
      phone: current.phone ?? "",
      address: current.address ?? "",
    });
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    await updateSupplier.mutateAsync({
      id: editingId,
      payload: {
        name: editingForm.name.trim(),
        email: editingForm.email.trim() || undefined,
        phone: editingForm.phone.trim() || undefined,
        address: editingForm.address.trim() || undefined,
      },
    });
    setEditingId(null);
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("suppliersPage.title")}
      subtitle={t("suppliersPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            {t("suppliersPage.kicker")}
          </p>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            {t("suppliersPage.subtitle")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">
              {t("suppliersPage.formTitle")}
            </h2>
            <p className="text-sm text-[#8a6d56]">
              {t("suppliersPage.formDescription")}
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleCreate}
              noValidate
            >
              <ValidationField
                id="name"
                label={t("suppliersPage.fields.name")}
                value={form.name}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, name: value }))
                }
                validate={withTranslatedValidation(validateName)}
                required
                placeholder={t("suppliersPage.placeholders.name")}
                success
              />
              <ValidationField
                id="email"
                label={t("suppliersPage.fields.email")}
                type="email"
                value={form.email}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, email: value }))
                }
                validate={(value) =>
                  value
                    ? translateValidationMessage(t, validateEmail(value))
                    : ""
                }
                placeholder={t("suppliersPage.placeholders.email")}
                success
              />
              <ValidationField
                id="phone"
                label={t("suppliersPage.fields.phone")}
                value={form.phone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, phone: value }))
                }
                validate={(value) =>
                  value
                    ? translateValidationMessage(t, validatePhone(value))
                    : ""
                }
                placeholder={t("suppliersPage.placeholders.phone")}
                success
              />
              <ValidationField
                id="address"
                label={t("suppliersPage.fields.address")}
                value={form.address}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, address: value }))
                }
                validate={withTranslatedValidation(validateRequired)}
                placeholder={t("suppliersPage.placeholders.address")}
                success
              />
              <Button
                type="submit"
                className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                disabled={isMutating}
              >
                {t("suppliersPage.addSupplier")}
              </Button>
              {(createSupplier.isError || updateSupplier.isError) && (
                <p className="text-sm text-[#b45309]">
                  {t("suppliersPage.saveError")}
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">
              {t("suppliersPage.listTitle")}
            </h2>
            <p className="text-sm text-[#8a6d56]">
              {t("suppliersPage.listDescription")}
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">
                  {t("suppliersPage.loading")}
                </p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  {t("suppliersPage.loadError")}
                </p>
              )}
              {!isLoading && !isError && suppliers.length === 0 && (
                <p className="text-sm text-[#8a6d56]">
                  {t("suppliersPage.empty")}
                </p>
              )}
              {!isLoading && !isError && suppliers.length > 0 && (
                <div className="grid gap-3">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3"
                    >
                      {editingId === supplier.id ? (
                        <form
                          className="grid gap-3"
                          onSubmit={handleUpdate}
                          noValidate
                        >
                          <ValidationField
                            id="edit-name"
                            label={t("suppliersPage.fields.name")}
                            value={editingForm.name}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                name: value,
                              }))
                            }
                            validate={withTranslatedValidation(validateName)}
                            required
                            success
                          />
                          <ValidationField
                            id="edit-email"
                            label={t("suppliersPage.fields.email")}
                            type="email"
                            value={editingForm.email}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                email: value,
                              }))
                            }
                            validate={(value) =>
                              value
                                ? translateValidationMessage(
                                    t,
                                    validateEmail(value),
                                  )
                                : ""
                            }
                            success
                          />
                          <ValidationField
                            id="edit-phone"
                            label={t("suppliersPage.fields.phone")}
                            value={editingForm.phone}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                phone: value,
                              }))
                            }
                            validate={(value) =>
                              value
                                ? translateValidationMessage(
                                    t,
                                    validatePhone(value),
                                  )
                                : ""
                            }
                            success
                          />
                          <ValidationField
                            id="edit-address"
                            label={t("suppliersPage.fields.address")}
                            value={editingForm.address}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                address: value,
                              }))
                            }
                            validate={withTranslatedValidation(validateRequired)}
                            success
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                              disabled={isMutating}
                            >
                              {t("suppliersPage.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              {supplier.name}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {supplier.email ?? t("suppliersPage.noEmail")}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {supplier.address ?? t("suppliersPage.noAddress")}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-[#5c4b3b]">
                            <span>{supplier.phone ?? t("suppliersPage.noPhone")}</span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(supplier.id)}
                            >
                              {t("suppliersPage.edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteSupplier.mutate(supplier.id)}
                              disabled={deleteSupplier.isPending}
                            >
                              {t("common.delete")}
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

export default SuppliersClient;
