"use client";

import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  useCreateWorkerMutation,
  useDeleteWorkerMutation,
  useUpdateWorkerMutation,
  useWorkersQuery,
} from "@/hooks/useInventoryQueries";
import { validateEmail, validateName, validatePhone } from "@/lib/validation";
import { useI18n } from "@/providers/LanguageProvider";

type WorkersClientProps = {
  name: string;
  image?: string;
};

const WorkersClient = ({ name, image }: WorkersClientProps) => {
  const { language, t } = useI18n();
  const { data, isLoading, isError } = useWorkersQuery();
  const createWorker = useCreateWorkerMutation();
  const deleteWorker = useDeleteWorkerMutation();
  const updateWorker = useUpdateWorkerMutation();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({
    name: "",
    phone: "",
    password: "",
  });
  const [updateError, setUpdateError] = useState("");

  const workers = useMemo(() => data ?? [], [data]);

  const translateValidationMessage = (message: string) => {
    switch (message) {
      case "Please enter a valid name (letters only)":
        return t("validation.validName");
      case "Enter a valid email address":
        return t("validation.validEmail");
      case "Enter a valid phone number":
        return "Enter a valid phone number";
      case "Password must be at least 6 characters":
        return "Password must be at least 6 characters";
      default:
        return message;
    }
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) return "This field is required";
    if (value.trim().length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const formatCreatedAt = (value: string) =>
    new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
      dateStyle: "medium",
    }).format(new Date(value));

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError("");

    try {
      await createWorker.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setForm({ name: "", email: "", phone: "", password: "" });
    } catch (error) {
      if (isAxiosError<{ message?: string }>(error)) {
        setCreateError(
          error.response?.data?.message || "Unable to create the worker right now.",
        );
        return;
      }

      setCreateError("Unable to create the worker right now.");
    }
  };

  const handleEdit = (workerId: string) => {
    const worker = workers.find((entry) => entry.id === workerId);
    if (!worker) return;
    setUpdateError("");
    setEditingId(workerId);
    setEditingForm({
      name: worker.name,
      phone: worker.phone ?? "",
      password: "",
    });
  };

  const handleUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setUpdateError("");

    try {
      await updateWorker.mutateAsync({
        id: editingId,
        payload: {
          name: editingForm.name.trim(),
          phone: editingForm.phone.trim(),
          password: editingForm.password.trim() || undefined,
        },
      });

      setEditingId(null);
      setEditingForm({ name: "", phone: "", password: "" });
    } catch (error) {
      if (isAxiosError<{ message?: string }>(error)) {
        setUpdateError(
          error.response?.data?.message || "Unable to update the worker right now.",
        );
        return;
      }

      setUpdateError("Unable to update the worker right now.");
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title="Worker Panel"
      subtitle="Create, update, and remove workers that belong to this business."
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            Team access
          </p>
          <p className="max-w-3xl text-base text-[#5c4b3b]">
            Every worker is tied to this business automatically. The frontend
            never sends a business id, so membership always comes from the
            authenticated admin session.
          </p>
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
              <h2 className="text-lg font-semibold">Add Worker</h2>
              <p className="text-sm text-[#8a6d56]">
                Create a worker account with an admin-generated password. Workers
                cannot sign themselves up.
              </p>
              <form className="mt-4 grid gap-4" onSubmit={handleCreate} noValidate>
                <ValidationField
                  id="worker-name"
                  label="Worker name"
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  validate={(value) => translateValidationMessage(validateName(value))}
                  required
                  placeholder="Riya Sharma"
                  success
                />
                <ValidationField
                  id="worker-email"
                  label="Worker email"
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, email: value }))
                  }
                  validate={(value) =>
                    value ? translateValidationMessage(validateEmail(value)) : ""
                  }
                  required
                  placeholder="riya@company.com"
                  success
                />
                <ValidationField
                  id="worker-phone"
                  label="Phone number"
                  value={form.phone}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, phone: value.replace(/\D/g, "") }))
                  }
                  validate={(value) =>
                    translateValidationMessage(validatePhone(value))
                  }
                  required
                  placeholder="9876543210"
                  success
                />
                <div className="grid gap-2">
                  <ValidationField
                    id="worker-password"
                    label="Password"
                    type="password"
                    value={form.password}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, password: value }))
                    }
                    validate={(value) =>
                      translateValidationMessage(validatePassword(value))
                    }
                    required
                    placeholder="Minimum 6 characters"
                    success
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                  disabled={createWorker.isPending}
                >
                  {createWorker.isPending ? "Creating..." : "Create Worker"}
                </Button>
                {createError ? (
                  <p className="text-sm text-[#b45309]">
                    {createError}
                  </p>
                ) : null}
              </form>
            </div>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <h2 className="text-lg font-semibold">Business Workers</h2>
            <p className="text-sm text-[#8a6d56]">
              Review every worker connected to this business and remove access
              when someone no longer needs it.
            </p>
            <div className="mt-4">
              {isLoading ? (
                <p className="text-sm text-[#8a6d56]">Loading workers...</p>
              ) : null}
              {isError ? (
                <p className="text-sm text-[#b45309]">
                  Unable to load workers right now.
                </p>
              ) : null}
              {!isLoading && !isError && workers.length === 0 ? (
                <p className="text-sm text-[#8a6d56]">
                  No workers have been added yet.
                </p>
              ) : null}
              {!isLoading && !isError && workers.length > 0 ? (
                <div className="grid gap-3">
                  {workers.map((worker) => (
                    <div
                      key={worker.id}
                      className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] px-4 py-4"
                    >
                      {editingId === worker.id ? (
                        <form className="grid gap-3" onSubmit={handleUpdate} noValidate>
                          <ValidationField
                            id={`edit-worker-name-${worker.id}`}
                            label="Worker name"
                            value={editingForm.name}
                            onChange={(value) =>
                              setEditingForm((prev) => ({ ...prev, name: value }))
                            }
                            validate={(value) =>
                              translateValidationMessage(validateName(value))
                            }
                            required
                            success
                          />
                          <ValidationField
                            id={`edit-worker-phone-${worker.id}`}
                            label="Phone number"
                            value={editingForm.phone}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                phone: value.replace(/\D/g, ""),
                              }))
                            }
                            validate={(value) =>
                              translateValidationMessage(validatePhone(value))
                            }
                            required
                            placeholder="9876543210"
                            success
                          />
                          <ValidationField
                            id={`edit-worker-password-${worker.id}`}
                            label="New password"
                            type="password"
                            value={editingForm.password}
                            onChange={(value) =>
                              setEditingForm((prev) => ({ ...prev, password: value }))
                            }
                            validate={(value) =>
                              value
                                ? translateValidationMessage(validatePassword(value))
                                : ""
                            }
                            placeholder="Leave blank to keep current password"
                            success
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={updateWorker.isPending}>
                              {updateWorker.isPending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditingForm({ name: "", phone: "", password: "" });
                              }}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                          {updateError ? (
                            <p className="text-sm text-[#b45309]">{updateError}</p>
                          ) : null}
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">{worker.name}</p>
                            <p className="text-sm text-[#5c4b3b]">{worker.email}</p>
                            <p className="text-sm text-[#5c4b3b]">
                              {worker.phone || "No phone number"}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                              {worker.role} - Added {formatCreatedAt(worker.createdAt)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(worker.id)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => deleteWorker.mutate(worker.id)}
                              disabled={deleteWorker.isPending}
                            >
                              {t("common.delete")}
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

export default WorkersClient;
