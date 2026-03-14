"use client";

import React, { useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateSupplierMutation,
  useDeleteSupplierMutation,
  useSuppliersQuery,
  useUpdateSupplierMutation,
} from "@/hooks/useInventoryQueries";

type SuppliersClientProps = {
  name: string;
  image?: string;
};

const SuppliersClient = ({ name, image }: SuppliersClientProps) => {
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
      title="Suppliers"
      subtitle="Track vendor contacts and procurement partners."
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            Supply chain
          </p>
          <p className="max-w-2xl text-base text-[#5c4b3b]">
            Track vendor contacts and procurement partners.
          </p>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Add supplier</h2>
            <p className="text-sm text-[#8a6d56]">
              Capture vendor contacts and preferred channels.
            </p>
            <form className="mt-4 grid gap-4" onSubmit={handleCreate}>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Supplier name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="vendor@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  placeholder="City, State"
                />
              </div>
              <Button
                type="submit"
                className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                disabled={isMutating}
              >
                Add supplier
              </Button>
              {(createSupplier.isError || updateSupplier.isError) && (
                <p className="text-sm text-[#b45309]">
                  Unable to save supplier right now.
                </p>
              )}
            </form>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Supplier list</h2>
            <p className="text-sm text-[#8a6d56]">
              Keep your most active partners handy.
            </p>
            <div className="mt-4">
              {isLoading && (
                <p className="text-sm text-[#8a6d56]">Loading suppliers...</p>
              )}
              {isError && (
                <p className="text-sm text-[#b45309]">
                  Failed to load suppliers.
                </p>
              )}
              {!isLoading && !isError && suppliers.length === 0 && (
                <p className="text-sm text-[#8a6d56]">No suppliers yet.</p>
              )}
              {!isLoading && !isError && suppliers.length > 0 && (
                <div className="grid gap-3">
                  {suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-3"
                    >
                      {editingId === supplier.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate}>
                          <div className="grid gap-2">
                            <Label>Name</Label>
                            <Input
                              value={editingForm.name}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }))
                              }
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={editingForm.email}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  email: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Phone</Label>
                            <Input
                              value={editingForm.phone}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  phone: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Address</Label>
                            <Input
                              value={editingForm.address}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  address: event.target.value,
                                }))
                              }
                            />
                          </div>
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
                              {supplier.name}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {supplier.email ?? "No email"}
                            </p>
                            <p className="text-xs text-[#8a6d56]">
                              {supplier.address ?? "No address"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-[#5c4b3b]">
                            <span>{supplier.phone ?? "No phone"}</span>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(supplier.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteSupplier.mutate(supplier.id)}
                              disabled={deleteSupplier.isPending}
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

export default SuppliersClient;
