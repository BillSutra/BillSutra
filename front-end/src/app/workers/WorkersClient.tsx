"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, XCircle } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ValidationField } from "@/components/ui/ValidationField";
import {
  useCreateWorkerMutation,
  useDeleteWorkerMutation,
  useWorkersOverviewQuery,
  useUpdateWorkerMutation,
} from "@/hooks/useInventoryQueries";
import {
  translateValidationMessage,
  validateEmail,
  validateName,
  validatePhone,
} from "@/lib/validation";
import { useI18n } from "@/providers/LanguageProvider";
import { useUserPermissionsQuery } from "@/hooks/useWorkspaceQueries";

type WorkersClientProps = {
  name: string;
  image?: string;
};

type WorkerFormState = {
  name: string;
  email: string;
  phone: string;
  password: string;
  accessRole: "ADMIN" | "SALESPERSON" | "STAFF" | "VIEWER";
  joiningDate: string;
  status: "ACTIVE" | "INACTIVE";
  incentiveType: "NONE" | "PERCENTAGE" | "PER_SALE";
  incentiveValue: string;
};

const DEFAULT_FORM: WorkerFormState = {
  name: "",
  email: "",
  phone: "",
  password: "",
  accessRole: "STAFF",
  joiningDate: "",
  status: "ACTIVE",
  incentiveType: "NONE",
  incentiveValue: "",
};

const WORKER_PASSWORD_RULES = [
  {
    id: "length",
    labelKey: "workersPage.passwordRules.length",
    test: (value: string) => value.length >= 8,
  },
  {
    id: "uppercase",
    labelKey: "workersPage.passwordRules.uppercase",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    id: "lowercase",
    labelKey: "workersPage.passwordRules.lowercase",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    id: "number",
    labelKey: "workersPage.passwordRules.number",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "special",
    labelKey: "workersPage.passwordRules.special",
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
] as const;

const workerPasswordStrength = (value: string) => {
  const passed = WORKER_PASSWORD_RULES.filter((rule) => rule.test(value)).length;

  if (passed <= 2) {
    return {
      labelKey: "workersPage.passwordStrength.weak",
      className: "bg-red-500",
      textClassName: "text-red-600",
      width: "33%",
    };
  }

  if (passed <= 4) {
    return {
      labelKey: "workersPage.passwordStrength.medium",
      className: "bg-amber-500",
      textClassName: "text-amber-600",
      width: "66%",
    };
  }

  return {
    labelKey: "workersPage.passwordStrength.strong",
    className: "bg-emerald-500",
    textClassName: "text-emerald-600",
    width: "100%",
  };
};

const isWorkerPasswordStrong = (value: string) =>
  WORKER_PASSWORD_RULES.every((rule) => rule.test(value));

type WorkerPasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error: string;
  required?: boolean;
  showGuidance?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const WorkerPasswordField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  required = false,
  showGuidance = true,
  t,
}: WorkerPasswordFieldProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const strength = workerPasswordStrength(value);
  const shouldShowError = Boolean(value && error);
  const shouldShowChecklist = showGuidance && Boolean(value);

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium text-[#1f1b16]">
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </label>
      <div className="relative">
        <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a6d56]" />
        <input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          aria-invalid={shouldShowError}
          aria-describedby={shouldShowError ? `${id}-error` : undefined}
          className={[
            "h-10 w-full rounded-md border bg-white py-2 pl-10 pr-11 text-sm outline-none transition-all focus:ring-2",
            shouldShowError
              ? "border-red-500/85 focus:ring-red-500/25"
              : value && !error
                ? "border-emerald-500/80 focus:ring-emerald-500/25"
                : "border-[#e6d5c6] focus:ring-[#8a6d56]/20",
          ].join(" ")}
        />
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#5c4b3b] transition-colors hover:bg-[#f2e6dc]"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>

      {shouldShowError ? (
        <p id={`${id}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {shouldShowChecklist ? (
        <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="font-medium text-[#1f1b16]">
              {t("workersPage.passwordStrength.label")}
            </span>
            <span className={strength.textClassName}>
              {t(strength.labelKey)}
            </span>
          </div>
          <div className="mb-3 h-2 rounded-full bg-[#f2e6dc]">
            <div
              className={`h-2 rounded-full transition-all ${strength.className}`}
              style={{ width: strength.width }}
            />
          </div>
          <div className="grid gap-1.5">
            {WORKER_PASSWORD_RULES.map((rule) => {
              const passed = rule.test(value);
              return (
                <div
                  key={rule.id}
                  className="flex items-center gap-2 text-xs text-[#5c4b3b]"
                >
                  {passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                  )}
                  <span>{t(rule.labelKey)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const WorkersClient = ({ name, image }: WorkersClientProps) => {
  const { language, t } = useI18n();
  const [period, setPeriod] = useState<"today" | "this_week" | "this_month">(
    "this_month",
  );
  const {
    data: permissions,
    isLoading: isPermissionsLoading,
    isError: isPermissionsError,
  } = useUserPermissionsQuery();
  const hasTeamAccess = permissions?.features.teamAccess ?? false;
  const { data, isLoading, isError } = useWorkersOverviewQuery(
    period,
    hasTeamAccess,
  );
  const createWorker = useCreateWorkerMutation();
  const deleteWorker = useDeleteWorkerMutation();
  const updateWorker = useUpdateWorkerMutation();
  const [form, setForm] = useState<WorkerFormState>(DEFAULT_FORM);
  const [createError, setCreateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<WorkerFormState>(DEFAULT_FORM);
  const [updateError, setUpdateError] = useState("");

  const workers = useMemo(() => data?.workers ?? [], [data?.workers]);
  const summary = data?.summary;
  const recentActivity = data?.recentActivity ?? [];
  const leaderboard = data?.leaderboard ?? [];

  const localizeValidation = (message: string) => {
    if (message === "Password must be at least 6 characters") {
      return t("workersPage.validation.passwordMin");
    }

    return translateValidationMessage(t, message);
  };

  const validatePassword = (value: string, required = true) => {
    if (!value) {
      return required ? t("workersPage.validation.passwordRequired") : "";
    }
    if (!isWorkerPasswordStrong(value)) {
      return t("workersPage.validation.passwordStrong");
    }
    return "";
  };

  const validateIncentiveValue = (
    type: "NONE" | "PERCENTAGE" | "PER_SALE",
    rawValue: string,
  ) => {
    if (type === "NONE") return "";
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return t("workersPage.validation.incentiveInvalid");
    }
    if (type === "PERCENTAGE" && parsed > 100) {
      return t("workersPage.validation.incentivePercentMax");
    }
    return "";
  };

  const isCreateFormValid =
    !validateName(form.name) &&
    !validateEmail(form.email) &&
    !validatePhone(form.phone) &&
    !validatePassword(form.password) &&
    !validateIncentiveValue(form.incentiveType, form.incentiveValue);

  const isUpdateFormValid =
    !validateName(editingForm.name) &&
    !validateEmail(editingForm.email) &&
    !validatePhone(editingForm.phone) &&
    !validatePassword(editingForm.password, false) &&
    !validateIncentiveValue(
      editingForm.incentiveType,
      editingForm.incentiveValue,
    );

  const formatCreatedAt = (value: string) =>
    new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
      dateStyle: "medium",
    }).format(new Date(value));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(language === "hi" ? "hi-IN" : "en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError("");

    try {
      await createWorker.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        accessRole: form.accessRole,
        status: form.status,
        joiningDate: form.joiningDate || undefined,
        incentiveType: form.incentiveType,
        incentiveValue:
          form.incentiveType === "NONE"
            ? 0
            : Number(form.incentiveValue || "0"),
      });
      setForm(DEFAULT_FORM);
    } catch (error) {
      if (isAxiosError<{ message?: string }>(error)) {
        setCreateError(
          error.response?.data?.message ||
            t("workersPage.messages.createError"),
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
      email: worker.email,
      phone: worker.phone ?? "",
      password: "",
      accessRole: worker.roleLabel ?? "STAFF",
      joiningDate: worker.joiningDate ? worker.joiningDate.slice(0, 10) : "",
      status: worker.status ?? "ACTIVE",
      incentiveType: worker.incentiveType ?? "NONE",
      incentiveValue: String(worker.incentiveValue ?? ""),
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
          email: editingForm.email.trim(),
          phone: editingForm.phone.trim(),
          password: editingForm.password || undefined,
          accessRole: editingForm.accessRole,
          status: editingForm.status,
          joiningDate: editingForm.joiningDate || undefined,
          incentiveType: editingForm.incentiveType,
          incentiveValue:
            editingForm.incentiveType === "NONE"
              ? 0
              : Number(editingForm.incentiveValue || "0"),
        },
      });

      setEditingId(null);
      setEditingForm(DEFAULT_FORM);
    } catch (error) {
      if (isAxiosError<{ message?: string }>(error)) {
        setUpdateError(
          error.response?.data?.message ||
            t("workersPage.messages.updateError"),
        );
        return;
      }

      setUpdateError(t("workersPage.messages.updateError"));
    }
  };

  const handleDisableWorker = async (
    workerId: string,
    status: "ACTIVE" | "INACTIVE",
  ) => {
    setUpdateError("");
    try {
      await updateWorker.mutateAsync({
        id: workerId,
        payload: {
          status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        },
      });
    } catch {
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
        {isPermissionsLoading ? (
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6 text-sm text-[#5c4b3b]">
            Checking your plan access for worker management...
          </div>
        ) : null}

        {isPermissionsError ? (
          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6 text-sm text-[#b45309]">
            We could not verify your worker access right now. Please retry in a
            moment.
          </div>
        ) : null}

        {!isPermissionsLoading && !isPermissionsError && !hasTeamAccess ? (
          <div className="rounded-3xl border border-[#ecdccf] bg-white/95 p-8 shadow-[0_24px_60px_-42px_rgba(92,75,59,0.22)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
              Team access
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-[#1f1b16]">
              Worker settings are not enabled on your current plan.
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-[#5c4b3b]">
              Upgrade your workspace to unlock worker accounts, role permissions,
              attendance-ready operations, and team controls.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="bg-[#1f1b16] text-white hover:bg-[#2c2520]">
                <Link href="/pricing">View plans</Link>
              </Button>
            </div>
          </div>
        ) : null}

        {!isPermissionsLoading && !isPermissionsError && hasTeamAccess ? (
          <>
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
              <h2 className="text-lg font-semibold">
                {t("workersPage.addTitle")}
              </h2>
              <p className="text-sm text-[#8a6d56]">
                {t("workersPage.addDescription")}
              </p>
              <form
                className="mt-4 grid gap-4"
                onSubmit={handleCreate}
                noValidate
              >
                <ValidationField
                  id="worker-name"
                  label={t("workersPage.fields.name")}
                  value={form.name}
                  onChange={(value) =>
                    setForm((prev) => ({ ...prev, name: value }))
                  }
                  validate={(value) => localizeValidation(validateName(value))}
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
                    value ? localizeValidation(validateEmail(value)) : ""
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
                    setForm((prev) => ({
                      ...prev,
                      phone: value.replace(/\D/g, ""),
                    }))
                  }
                  validate={(value) => localizeValidation(validatePhone(value))}
                  required
                  placeholder={t("workersPage.placeholders.phone")}
                  success
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                    {t("workersPage.fields.role")}
                    <select
                      className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                      value={form.accessRole}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          accessRole: event.target
                            .value as WorkerFormState["accessRole"],
                        }))
                      }
                    >
                      <option value="ADMIN">
                        {t("workersPage.roles.admin")}
                      </option>
                      <option value="SALESPERSON">
                        {t("workersPage.roles.sales")}
                      </option>
                      <option value="STAFF">
                        {t("workersPage.roles.staff")}
                      </option>
                      <option value="VIEWER">
                        {t("workersPage.roles.viewer")}
                      </option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                    {t("workersPage.fields.status")}
                    <select
                      className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                      value={form.status}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          status: event.target
                            .value as WorkerFormState["status"],
                        }))
                      }
                    >
                      <option value="ACTIVE">
                        {t("workersPage.statuses.active")}
                      </option>
                      <option value="INACTIVE">
                        {t("workersPage.statuses.inactive")}
                      </option>
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                  {t("workersPage.fields.joiningDate")}
                  <input
                    type="date"
                    className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                    value={form.joiningDate}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        joiningDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                    {t("workersPage.fields.incentiveType")}
                    <select
                      className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                      value={form.incentiveType}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          incentiveType: event.target
                            .value as WorkerFormState["incentiveType"],
                          incentiveValue:
                            event.target.value === "NONE"
                              ? ""
                              : prev.incentiveValue,
                        }))
                      }
                    >
                      <option value="NONE">
                        {t("workersPage.incentive.none")}
                      </option>
                      <option value="PERCENTAGE">
                        {t("workersPage.incentive.percentage")}
                      </option>
                      <option value="PER_SALE">
                        {t("workersPage.incentive.perSale")}
                      </option>
                    </select>
                  </label>
                  {form.incentiveType !== "NONE" ? (
                    <ValidationField
                      id="worker-incentive-value"
                      label={t("workersPage.fields.incentiveValue")}
                      value={form.incentiveValue}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, incentiveValue: value }))
                      }
                      validate={(value) =>
                        validateIncentiveValue(form.incentiveType, value)
                      }
                      required
                      placeholder={
                        form.incentiveType === "PERCENTAGE"
                          ? t("workersPage.placeholders.incentivePercent")
                          : t("workersPage.placeholders.incentiveAmount")
                      }
                    />
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <WorkerPasswordField
                    id="worker-password"
                    label={t("workersPage.fields.password")}
                    value={form.password}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, password: value }))
                    }
                    error={validatePassword(form.password)}
                    required
                    placeholder={t("workersPage.placeholders.password")}
                    t={t}
                  />
                </div>
                <Button
                  type="submit"
                  className="bg-[#1f1b16] text-white hover:bg-[#2c2520]"
                  disabled={createWorker.isPending || !isCreateFormValid}
                >
                  {createWorker.isPending
                    ? t("workersPage.actions.creating")
                    : t("workersPage.actions.create")}
                </Button>
                {createError ? (
                  <p className="text-sm text-[#b45309]">{createError}</p>
                ) : null}
              </form>
            </div>

            <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  {t("workersPage.leaderboard.title")}
                </h2>
                <p className="text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                  {t("workersPage.leaderboard.kicker")}
                </p>
              </div>
              <div className="mt-4 grid gap-2">
                {leaderboard.length === 0 ? (
                  <p className="text-sm text-[#8a6d56]">
                    {t("workersPage.empty")}
                  </p>
                ) : (
                  leaderboard.map((entry) => (
                    <div
                      key={entry.workerId}
                      className="flex items-center justify-between rounded-lg border border-[#f2e6dc] px-3 py-2"
                    >
                      <p className="text-sm font-medium">
                        #{entry.rank} {entry.name}
                      </p>
                      <div className="text-right text-xs text-[#5c4b3b]">
                        <p>{formatCurrency(entry.totalSales)}</p>
                        <p>
                          {t("workersPage.cards.totalOrders")}:{" "}
                          {entry.totalOrders}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#ecdccf] bg-white/90 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {t("workersPage.listTitle")}
                </h2>
                <p className="text-sm text-[#8a6d56]">
                  {t("workersPage.listDescription")}
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[#e6d5c6] bg-white p-1 text-xs font-medium">
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 ${
                    period === "today"
                      ? "bg-[#1f1b16] text-white"
                      : "text-[#5c4b3b]"
                  }`}
                  onClick={() => setPeriod("today")}
                >
                  {t("workersPage.filters.today")}
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 ${
                    period === "this_week"
                      ? "bg-[#1f1b16] text-white"
                      : "text-[#5c4b3b]"
                  }`}
                  onClick={() => setPeriod("this_week")}
                >
                  {t("workersPage.filters.thisWeek")}
                </button>
                <button
                  type="button"
                  className={`rounded-md px-3 py-1 ${
                    period === "this_month"
                      ? "bg-[#1f1b16] text-white"
                      : "text-[#5c4b3b]"
                  }`}
                  onClick={() => setPeriod("this_month")}
                >
                  {t("workersPage.filters.thisMonth")}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                  {t("workersPage.cards.totalSales")}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatCurrency(summary?.totalSales ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                  {t("workersPage.cards.totalOrders")}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {summary?.totalOrders ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                  {t("workersPage.cards.incentiveEarned")}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatCurrency(summary?.incentiveEarned ?? 0)}
                </p>
              </div>
              <div className="rounded-xl border border-[#f2e6dc] bg-[#fff9f2] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-[#8a6d56]">
                  {t("workersPage.cards.thisMonthSales")}
                </p>
                <p className="mt-2 text-xl font-semibold">
                  {formatCurrency(summary?.thisMonthSales ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#f2e6dc] p-4">
              <h3 className="text-sm font-semibold">
                {t("workersPage.activity.title")}
              </h3>
              <div className="mt-3 grid gap-2">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-[#8a6d56]">
                    {t("workersPage.activity.empty")}
                  </p>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div
                      key={`${activity.workerId}-${activity.reference}-${index}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#fff9f2] px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{activity.workerName}</p>
                        <p className="text-xs text-[#5c4b3b]">
                          {activity.activityType} {activity.reference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(activity.amount)}
                        </p>
                        <p className="text-xs text-[#5c4b3b]">
                          {formatCreatedAt(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4">
              {isLoading ? (
                <p className="text-sm text-[#8a6d56]">
                  {t("workersPage.loading")}
                </p>
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
                        <form
                          className="grid gap-3"
                          onSubmit={handleUpdate}
                          noValidate
                        >
                          <ValidationField
                            id={`edit-worker-name-${worker.id}`}
                            label={t("workersPage.fields.name")}
                            value={editingForm.name}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                name: value,
                              }))
                            }
                            validate={(value) =>
                              localizeValidation(validateName(value))
                            }
                            required
                            success
                          />
                          <ValidationField
                            id={`edit-worker-email-${worker.id}`}
                            label={t("workersPage.fields.email")}
                            type="email"
                            value={editingForm.email}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                email: value,
                              }))
                            }
                            validate={(value) =>
                              localizeValidation(validateEmail(value))
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
                              localizeValidation(validatePhone(value))
                            }
                            required
                            placeholder={t("workersPage.placeholders.phone")}
                            success
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                              {t("workersPage.fields.role")}
                              <select
                                className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                                value={editingForm.accessRole}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    accessRole: event.target
                                      .value as WorkerFormState["accessRole"],
                                  }))
                                }
                              >
                                <option value="ADMIN">
                                  {t("workersPage.roles.admin")}
                                </option>
                                <option value="SALESPERSON">
                                  {t("workersPage.roles.sales")}
                                </option>
                                <option value="STAFF">
                                  {t("workersPage.roles.staff")}
                                </option>
                                <option value="VIEWER">
                                  {t("workersPage.roles.viewer")}
                                </option>
                              </select>
                            </label>
                            <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                              {t("workersPage.fields.status")}
                              <select
                                className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                                value={editingForm.status}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    status: event.target
                                      .value as WorkerFormState["status"],
                                  }))
                                }
                              >
                                <option value="ACTIVE">
                                  {t("workersPage.statuses.active")}
                                </option>
                                <option value="INACTIVE">
                                  {t("workersPage.statuses.inactive")}
                                </option>
                              </select>
                            </label>
                          </div>
                          <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                            {t("workersPage.fields.joiningDate")}
                            <input
                              type="date"
                              className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                              value={editingForm.joiningDate}
                              onChange={(event) =>
                                setEditingForm((prev) => ({
                                  ...prev,
                                  joiningDate: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="grid gap-1 text-sm font-medium text-[#1f1b16]">
                              {t("workersPage.fields.incentiveType")}
                              <select
                                className="h-10 rounded-md border border-[#e6d5c6] bg-white px-3 text-sm"
                                value={editingForm.incentiveType}
                                onChange={(event) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    incentiveType: event.target
                                      .value as WorkerFormState["incentiveType"],
                                    incentiveValue:
                                      event.target.value === "NONE"
                                        ? ""
                                        : prev.incentiveValue,
                                  }))
                                }
                              >
                                <option value="NONE">
                                  {t("workersPage.incentive.none")}
                                </option>
                                <option value="PERCENTAGE">
                                  {t("workersPage.incentive.percentage")}
                                </option>
                                <option value="PER_SALE">
                                  {t("workersPage.incentive.perSale")}
                                </option>
                              </select>
                            </label>
                            {editingForm.incentiveType !== "NONE" ? (
                              <ValidationField
                                id={`edit-worker-incentive-${worker.id}`}
                                label={t("workersPage.fields.incentiveValue")}
                                value={editingForm.incentiveValue}
                                onChange={(value) =>
                                  setEditingForm((prev) => ({
                                    ...prev,
                                    incentiveValue: value,
                                  }))
                                }
                                validate={(value) =>
                                  validateIncentiveValue(
                                    editingForm.incentiveType,
                                    value,
                                  )
                                }
                                required
                                placeholder={
                                  editingForm.incentiveType === "PERCENTAGE"
                                    ? t(
                                        "workersPage.placeholders.incentivePercent",
                                      )
                                    : t(
                                        "workersPage.placeholders.incentiveAmount",
                                      )
                                }
                              />
                            ) : null}
                          </div>
                          <WorkerPasswordField
                            id={`edit-worker-password-${worker.id}`}
                            label={t("workersPage.fields.newPassword")}
                            value={editingForm.password}
                            onChange={(value) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                password: value,
                              }))
                            }
                            error={validatePassword(
                              editingForm.password,
                              false,
                            )}
                            placeholder={t(
                              "workersPage.placeholders.keepPassword",
                            )}
                            showGuidance={Boolean(editingForm.password)}
                            t={t}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="submit"
                              disabled={
                                updateWorker.isPending || !isUpdateFormValid
                              }
                            >
                              {updateWorker.isPending
                                ? t("workersPage.actions.saving")
                                : t("workersPage.actions.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditingForm(DEFAULT_FORM);
                              }}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                          {updateError ? (
                            <p className="text-sm text-[#b45309]">
                              {updateError}
                            </p>
                          ) : null}
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-semibold">
                              {worker.name}
                            </p>
                            <p className="text-sm text-[#5c4b3b]">
                              {worker.email}
                            </p>
                            <p className="text-sm text-[#5c4b3b]">
                              {worker.phone ||
                                t("workersPage.messages.noPhone")}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-[#f2e6dc] px-2 py-1">
                                {worker.roleLabel ?? "STAFF"}
                              </span>
                              <span className="rounded-full bg-[#f2e6dc] px-2 py-1">
                                {worker.status ?? "ACTIVE"}
                              </span>
                            </div>
                            <div className="mt-2 grid gap-1 text-xs text-[#5c4b3b] sm:grid-cols-2">
                              <p>
                                {t("workersPage.cards.totalSales")}:{" "}
                                {formatCurrency(
                                  worker.metrics?.totalSales ?? 0,
                                )}
                              </p>
                              <p>
                                {t("workersPage.cards.totalOrders")}:{" "}
                                {worker.metrics?.totalOrders ?? 0}
                              </p>
                              <p>
                                {t("workersPage.cards.incentiveEarned")}:{" "}
                                {formatCurrency(
                                  worker.metrics?.incentiveEarned ?? 0,
                                )}
                              </p>
                              <p>
                                {t("workersPage.fields.lastActive")}:{" "}
                                {worker.lastActiveAt
                                  ? formatCreatedAt(worker.lastActiveAt)
                                  : t("workersPage.messages.neverActive")}
                              </p>
                            </div>
                            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#8a6d56]">
                              {t("workersPage.messages.addedMeta", {
                                role: worker.roleLabel ?? worker.role,
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
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                handleDisableWorker(
                                  worker.id,
                                  worker.status ?? "ACTIVE",
                                )
                              }
                              disabled={updateWorker.isPending}
                            >
                              {worker.status === "INACTIVE"
                                ? t("workersPage.actions.enable")
                                : t("workersPage.actions.disable")}
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
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export default WorkersClient;
