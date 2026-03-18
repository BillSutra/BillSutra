"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

type CustomersClientProps = {
  name: string;
  image?: string;
};

const CustomersClient = ({ name, image }: CustomersClientProps) => {
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

  // Validate all fields before submit
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
      title="Customers"
      subtitle="Keep contact details and recent activity handy."
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            Relationships
          </p>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            Keep contact details and recent activity handy.
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Add customer</h2>
            <p className="text-sm text-[#8a6d56]">
              Capture contact details for billing and follow-ups.
            </p>
            <form
              className="mt-4 grid gap-4"
              onSubmit={handleCreate}
              noValidate
            >
              <ValidationField
                id="name"
                label="Name"
                value={form.name}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, name: value }))
                }
                validate={validateName}
                required
                placeholder="Customer name"
                success
              />
              <ValidationField
                id="email"
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, email: value }))
                }
                validate={validateEmail}
                required
                placeholder="name@example.com"
                success
              />
              <ValidationField
                id="phone"
                label="Phone"
                value={form.phone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, phone: value }))
                }
                validate={validatePhone}
                required
                placeholder="9876543210"
                success
              />
              <ValidationField
                id="address"
                label="Address"
                value={form.address}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, address: value }))
                }
                validate={validateRequired}
                required
                placeholder="City, State"
                success
              />
              <Button
                type="submit"
                className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                disabled={isMutating || (!validateAll() && formTouched)}
                aria-disabled={isMutating || (!validateAll() && formTouched)}
              >
                Add customer
              </Button>
              {(createCustomer.isError || updateCustomer.isError) && (
                <p className="text-sm text-[#b45309]">
                  Unable to save customer right now.
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Customer list</h2>
            <p className="text-sm text-[#8a6d56]">
              Keep your top accounts at your fingertips.
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">Loading customers...</p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  Failed to load customers.
                </p>
              )}
              {!isLoading && !isError && customers.length === 0 && (
                <p className="text-sm text-[#8a6d56]">No customers yet.</p>
              )}
              {!isLoading && !isError && customers.length > 0 && (
                <div className="grid gap-3">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3"
                    >
                      {editingId === customer.id ? (
                        <form
                          className="grid gap-3"
                          onSubmit={handleUpdate}
                          noValidate
                        >
                          <ValidationField
                            id={`edit-name-${customer.id}`}
                            label="Name"
                            value={editingForm.name}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                name: value,
                              }))
                            }
                            validate={validateName}
                            required
                            placeholder="Customer name"
                            success
                          />
                          <ValidationField
                            id={`edit-email-${customer.id}`}
                            label="Email"
                            type="email"
                            value={editingForm.email}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                email: value,
                              }))
                            }
                            validate={validateEmail}
                            required
                            placeholder="name@example.com"
                            success
                          />
                          <ValidationField
                            id={`edit-phone-${customer.id}`}
                            label="Phone"
                            value={editingForm.phone}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                phone: value,
                              }))
                            }
                            validate={validatePhone}
                            required
                            placeholder="9876543210"
                            success
                          />
                          <ValidationField
                            id={`edit-address-${customer.id}`}
                            label="Address"
                            value={editingForm.address}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                address: value,
                              }))
                            }
                            validate={validateRequired}
                            required
                            placeholder="City, State"
                            success
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                              disabled={isMutating}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              {customer.name}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {customer.email ?? "No email"}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {customer.address ?? "No address"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-[#5c4b3b]">
                            <span>{customer.phone ?? "No phone"}</span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(customer.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteCustomer.mutate(customer.id)}
                              disabled={deleteCustomer.isPending}
                            >
                              Delete
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

export default CustomersClient;
