"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  validateName,
  validateEmail,
  validatePhone,
  validateRequired,
} from "@/lib/validation";
import {
  useCreateCustomerMutation,
  useCustomersQuery,
  useDeleteCustomerMutation,
  useUpdateCustomerMutation,
} from "@/hooks/useInventoryQueries";
import { useI18n } from "@/providers/LanguageProvider";

type CustomersClientProps = {
  name: string;
  image?: string;
};

const CustomersClient = ({ name, image }: CustomersClientProps) => {
  const { t } = useI18n();
  const { data, isLoading, isError } = useCustomersQuery();
  const createCustomer = useCreateCustomerMutation();
  const updateCustomer = useUpdateCustomerMutation();
  const deleteCustomer = useDeleteCustomerMutation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });
  const [formTouched, setFormTouched] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const isMutating =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    deleteCustomer.isPending;

  const customers = useMemo(() => data ?? [], [data]);

  const resetForm = () =>
    setForm({ name: "", email: "", phone: "", address: "" });

  const validateAll = () => {
    return (
      !validateName(form.name) &&
      !validateEmail(form.email) &&
      !validatePhone(form.phone) &&
      !validateRequired(form.address)
    );
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormTouched(true);
    if (!validateAll()) return;
    await createCustomer.mutateAsync({
      name: form.name.trim(),
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      address: form.address.trim() || undefined,
    });
    resetForm();
    setFormTouched(false);
  };

  const handleEdit = (id: number) => {
    const current = customers.find((customer) => customer.id === id);
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
    await updateCustomer.mutateAsync({
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
      title={t("customers.title")}
      subtitle={t("customers.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="app-page-intro">
          <p className="app-kicker">{t("customers.kicker")}</p>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t("customers.title")}
          </h1>
          <p className="app-lead">{t("customers.lead")}</p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="app-panel rounded-3xl p-6">
            <h2 className="text-lg font-semibold text-foreground">
              {t("customers.addTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("customers.addDescription")}
            </p>
            <form className="mt-5 grid gap-4" onSubmit={handleCreate} noValidate>
              <ValidationField id="name" label={t("customers.fields.name")} value={form.name} onChange={(value) => setForm((prev) => ({ ...prev, name: value }))} validate={validateName} required placeholder={t("customers.placeholders.name")} success />
              <ValidationField id="email" label={t("customers.fields.email")} type="email" value={form.email} onChange={(value) => setForm((prev) => ({ ...prev, email: value }))} validate={validateEmail} required placeholder={t("customers.placeholders.email")} success />
              <ValidationField id="phone" label={t("customers.fields.phone")} value={form.phone} onChange={(value) => setForm((prev) => ({ ...prev, phone: value }))} validate={validatePhone} required placeholder={t("customers.placeholders.phone")} success />
              <ValidationField id="address" label={t("customers.fields.address")} value={form.address} onChange={(value) => setForm((prev) => ({ ...prev, address: value }))} validate={validateRequired} required placeholder={t("customers.placeholders.address")} success />
              <Button type="submit" disabled={isMutating || (!validateAll() && formTouched)} aria-disabled={isMutating || (!validateAll() && formTouched)}>
                {t("customers.actions.add")}
              </Button>
              {(createCustomer.isError || updateCustomer.isError) && (
                <p className="text-sm text-amber-700 dark:text-amber-300">{t("customers.saveError")}</p>
              )}
            </form>
          </div>

          <div className="app-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{t("customers.listTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("customers.listDescription")}
                </p>
              </div>
              {!isLoading && !isError && customers.length > 0 ? <span className="app-chip">{t("customers.count", { count: customers.length })}</span> : null}
            </div>
            <div className="mt-5">
              {isLoading && <div className="app-loading-skeleton h-64 w-full" />}
              {isError && <p className="text-sm text-amber-700 dark:text-amber-300">{t("customers.loadError")}</p>}
              {!isLoading && !isError && customers.length === 0 && <div className="app-empty-state text-sm">{t("customers.empty")}</div>}
              {!isLoading && !isError && customers.length > 0 && (
                <div className="grid gap-3">
                  {customers.map((customer) => (
                    <div key={customer.id} className="app-list-item px-4 py-4">
                      {editingId === customer.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate} noValidate>
                          <ValidationField id={`edit-name-${customer.id}`} label={t("customers.fields.name")} value={editingForm.name} onChange={(value) => setEditingForm((prev) => ({ ...prev, name: value }))} validate={validateName} required placeholder={t("customers.placeholders.name")} success />
                          <ValidationField id={`edit-email-${customer.id}`} label={t("customers.fields.email")} type="email" value={editingForm.email} onChange={(value) => setEditingForm((prev) => ({ ...prev, email: value }))} validate={validateEmail} required placeholder={t("customers.placeholders.email")} success />
                          <ValidationField id={`edit-phone-${customer.id}`} label={t("customers.fields.phone")} value={editingForm.phone} onChange={(value) => setEditingForm((prev) => ({ ...prev, phone: value }))} validate={validatePhone} required placeholder={t("customers.placeholders.phone")} success />
                          <ValidationField id={`edit-address-${customer.id}`} label={t("customers.fields.address")} value={editingForm.address} onChange={(value) => setEditingForm((prev) => ({ ...prev, address: value }))} validate={validateRequired} required placeholder={t("customers.placeholders.address")} success />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={isMutating}>{t("customers.actions.save")}</Button>
                            <Button type="button" variant="outline" onClick={() => setEditingId(null)}>{t("customers.actions.cancel")}</Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-base font-semibold text-foreground">{customer.name}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span className="app-chip">{customer.email ?? t("customers.fallbacks.email")}</span>
                              <span className="app-chip">{customer.phone ?? t("customers.fallbacks.phone")}</span>
                              <span className="app-chip">{customer.address ?? t("customers.fallbacks.address")}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" variant="outline" onClick={() => handleEdit(customer.id)}>{t("customers.actions.edit")}</Button>
                            <Button type="button" variant="destructive" onClick={() => deleteCustomer.mutate(customer.id)} disabled={deleteCustomer.isPending}>{t("customers.actions.delete")}</Button>
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

export default CustomersClient;
