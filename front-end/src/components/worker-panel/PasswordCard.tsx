"use client";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeWorkerPassword } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

type PasswordCardProps = {
  onPasswordChanged?: () => void;
};

type PasswordForm = {
  current_password: string;
  password: string;
  confirm_password: string;
};

type ApiError = {
  response?: { data?: { message?: string; errors?: Record<string, string> } };
};

const passwordRules = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number", test: (value: string) => /\d/.test(value) },
  { label: "Special", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

const PasswordInput = ({
  id,
  label,
  value,
  error,
  show,
  placeholder,
  disabled,
  onToggleShow,
  onChange,
  onCapsLockChange,
}: {
  id: keyof PasswordForm;
  label: string;
  value: string;
  error?: string;
  show: boolean;
  placeholder: string;
  disabled?: boolean;
  onToggleShow: () => void;
  onChange: (value: string) => void;
  onCapsLockChange?: (active: boolean) => void;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyUp={(event) => onCapsLockChange?.(event.getModifierState("CapsLock"))}
        onKeyDown={(event) => onCapsLockChange?.(event.getModifierState("CapsLock"))}
        className={cn("pr-10", error && "border-destructive")}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
    {error ? <p className="text-xs text-destructive">{error}</p> : null}
  </div>
);

const PasswordCard = ({ onPasswordChanged }: PasswordCardProps) => {
  const [formData, setFormData] = React.useState<PasswordForm>({
    current_password: "",
    password: "",
    confirm_password: "",
  });
  const [visibleFields, setVisibleFields] = React.useState<
    Partial<Record<keyof PasswordForm, boolean>>
  >({});
  const [capsLockActive, setCapsLockActive] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<keyof PasswordForm, string>>>({});

  const passedRules = passwordRules.filter((rule) => rule.test(formData.password)).length;
  const strength = Math.round((passedRules / passwordRules.length) * 100);
  const passwordsMatch =
    formData.confirm_password.length > 0 &&
    formData.password === formData.confirm_password;

  const mutation = useMutation({
    mutationFn: changeWorkerPassword,
    onSuccess: () => {
      toast.success("Password changed successfully");
      setFormData({ current_password: "", password: "", confirm_password: "" });
      setErrors({});
      onPasswordChanged?.();
    },
    onError: (error: ApiError) => {
      const message = error.response?.data?.message ?? "Failed to change password";
      toast.error(message);
      setErrors(error.response?.data?.errors ?? {});
    },
  });

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof PasswordForm, string>> = {};

    if (!formData.current_password) {
      nextErrors.current_password = "Current password is required";
    }

    const missingRule = passwordRules.find((rule) => !rule.test(formData.password));
    if (!formData.password) {
      nextErrors.password = "New password is required";
    } else if (missingRule) {
      nextErrors.password = "Use 8+ chars with upper, lower, number, and special character";
    }

    if (!formData.confirm_password) {
      nextErrors.confirm_password = "Confirm your new password";
    } else if (formData.password !== formData.confirm_password) {
      nextErrors.confirm_password = "Passwords do not match";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;
    mutation.mutate(formData);
  };

  const setField = (field: keyof PasswordForm, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const toggleShow = (field: keyof PasswordForm) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-5 w-5 text-primary" />
          Change Password
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Update your worker login password with a stronger credential.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <PasswordInput
            id="current_password"
            label="Current Password"
            value={formData.current_password}
            error={errors.current_password}
            show={Boolean(visibleFields.current_password)}
            placeholder="Enter current password"
            disabled={mutation.isPending}
            onToggleShow={() => toggleShow("current_password")}
            onChange={(value) => setField("current_password", value)}
            onCapsLockChange={setCapsLockActive}
          />

          <PasswordInput
            id="password"
            label="New Password"
            value={formData.password}
            error={errors.password}
            show={Boolean(visibleFields.password)}
            placeholder="Create a strong password"
            disabled={mutation.isPending}
            onToggleShow={() => toggleShow("password")}
            onChange={(value) => setField("password", value)}
            onCapsLockChange={setCapsLockActive}
          />

          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  strength >= 80
                    ? "bg-emerald-500"
                    : strength >= 50
                      ? "bg-amber-500"
                      : "bg-rose-500",
                )}
                style={{ width: `${strength}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {passwordRules.map((rule) => {
                const passed = rule.test(formData.password);
                return (
                  <span
                    key={rule.label}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-1",
                      passed
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {rule.label}
                  </span>
                );
              })}
            </div>
          </div>

          <PasswordInput
            id="confirm_password"
            label="Confirm Password"
            value={formData.confirm_password}
            error={errors.confirm_password}
            show={Boolean(visibleFields.confirm_password)}
            placeholder="Re-enter new password"
            disabled={mutation.isPending}
            onToggleShow={() => toggleShow("confirm_password")}
            onChange={(value) => setField("confirm_password", value)}
            onCapsLockChange={setCapsLockActive}
          />

          {formData.confirm_password ? (
            <p
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                passwordsMatch ? "text-emerald-600" : "text-destructive",
              )}
            >
              {passwordsMatch ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {passwordsMatch ? "Passwords match" : "Passwords do not match"}
            </p>
          ) : null}

          {capsLockActive ? (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200">
              <ShieldAlert className="h-4 w-4" />
              Caps Lock is on
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            Update Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default PasswordCard;
