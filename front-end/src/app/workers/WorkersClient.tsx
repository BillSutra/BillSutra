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
        return t("validation.validPhone");
      case "Password must be at least 6 characters":
        return t("workersPage.validation.passwordMin");
      default:
        return message;
    }
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) return t("workersPage.validation.passwordRequired");
    if (value.trim().length < 6) return t("workersPage.validation.passwordMin");
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
          error.response?.data?.message || t("workersPage.messages.createError"),
        );
        return;
      }

      setCreateError(t("workersPage.messages.createError"));
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
          error.response?.data?.message || t("workersPage.messages.updateError"),
        );
        return;
      }

      setUpdateError(t("workersPage.messages.updateError"));
    }
  };

  return (
    <DashboardLayout
      name={name}
      image={image}
      title={t("workersPage.title")}
      subtitle={t("workersPage.subtitle")}
    >
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-[#8a6d56]">
            {t("workersPage.kicker")}
          </p>
          <p className="max-w-3xl text-base text-[#5c4b3b]">
            {t("workersPage.lead")}
          </p>
        </div>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="grid gap-6">
            <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
              <h2 className="text-lg font-semibold">{t("workersPage.addTitle")}</h2>
              <p className="text-sm text-[#8a6d56]">
                {t("workersPage.addDescription")}
              </p>
              <form className="mt-4 grid gap-4" onSubmit={handleCreate} noValidate>
                <ValidationField
                  id="worker-name"
                  label={t("workersPage.fields.name")}
                  value={form.name}
                  onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                  validate={(value) => translateValidationMessage(validateName(value))}
                  required
                  placeholder={t("workersPage.placeholders.name")}
                  success
                />
                <ValidationField
                  id="worker-email"
                  label={t("workersPage.fields.email")}
                  type="email"
                  value={form.email}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, email: value }))
                  }
                  validate={(value) =>
                    value ? translateValidationMessage(validateEmail(value)) : ""
                  }
                  required
                  placeholder={t("workersPage.placeholders.email")}
                  success
                />
                <ValidationField
                  id="worker-phone"
                  label={t("workersPage.fields.phone")}
                  value={form.phone}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, phone: value.replace(/\D/g, "") }))
                  }
                  validate={(value) =>
                    translateValidationMessage(validatePhone(value))
                  }
                  required
                  placeholder={t("workersPage.placeholders.phone")}
                  success
                />
                <div className="grid gap-2">
                  <ValidationField
                    id="worker-password"
                    label={t("workersPage.fields.password")}
                    type="password"
                    value={form.password}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, password: value }))
                    }
                    validate={(value) =>
                      translateValidationMessage(validatePassword(value))
                    }
                    required
                    placeholder={t("workersPage.placeholders.password")}
                    success
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                  disabled={createWorker.isPending}
                >
                  {createWorker.isPending
                    ? t("workersPage.actions.creating")
                    : t("workersPage.actions.create")}
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
            <h2 className="text-lg font-semibold">{t("workersPage.listTitle")}</h2>
            <p className="text-sm text-[#8a6d56]">
              {t("workersPage.listDescription")}
            </p>
            <div className="mt-4">
              {isLoading ? (
                <p className="text-sm text-[#8a6d56]">{t("workersPage.loading")}</p>
              ) : null}
              {isError ? (
                <p className="text-sm text-[#b45309]">
                  {t("workersPage.loadError")}
                </p>
              ) : null}
              {!isLoading && !isError && workers.length === 0 ? (
                <p className="text-sm text-[#8a6d56]">
                  {t("workersPage.empty")}
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
                            label={t("workersPage.fields.name")}
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
                            label={t("workersPage.fields.phone")}
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
                            placeholder={t("workersPage.placeholders.phone")}
                            success
                          />
                          <ValidationField
                            id={`edit-worker-password-${worker.id}`}
                            label={t("workersPage.fields.newPassword")}
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
                            placeholder={t("workersPage.placeholders.keepPassword")}
                            success
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" disabled={updateWorker.isPending}>
                              {updateWorker.isPending
                                ? t("workersPage.actions.saving")
                                : t("workersPage.actions.save")}
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
                              {worker.phone || t("workersPage.messages.noPhone")}
                            </p>
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                              {t("workersPage.messages.addedMeta", {
                                role: worker.role,
                                date: formatCreatedAt(worker.createdAt),
                              })}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleEdit(worker.id)}
                            >
                              {t("workersPage.actions.edit")}
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
