"use client";

import React, { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios, { AxiosError } from "axios";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { resetPasswordAction } from "@/actions/authActions";
import { validateResetPassword } from "@/lib/apiEndPoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/providers/LanguageProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_REGEX = /^[a-f0-9]{48,128}$/i;
const SUCCESS_MESSAGE =
  "Password changed successfully. Redirecting to login...";

type FormState = {
  status: number;
  message: string;
  errors: Record<string, string | string[]>;
};

type TokenStatus = "idle" | "checking" | "valid" | "invalid" | "expired" | "used";

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePassword = (value: string) => value.trim();

const getFieldError = (
  errors: Record<string, string | string[]> | undefined,
  field: string,
) => {
  const value = errors?.[field];
  return Array.isArray(value) ? value[0] : value;
};

const passwordRules = [
  {
    key: "length",
    labelKey: "auth.resetForm.ruleLength",
    fallback: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  {
    key: "upper",
    labelKey: "auth.resetForm.ruleUppercase",
    fallback: "1 uppercase letter",
    test: (value: string) => /[A-Z]/.test(value),
  },
  {
    key: "lower",
    labelKey: "auth.resetForm.ruleLowercase",
    fallback: "1 lowercase letter",
    test: (value: string) => /[a-z]/.test(value),
  },
  {
    key: "number",
    labelKey: "auth.resetForm.ruleNumber",
    fallback: "1 number",
    test: (value: string) => /\d/.test(value),
  },
  {
    key: "special",
    labelKey: "auth.resetForm.ruleSpecial",
    fallback: "1 special character",
    test: (value: string) => /[^A-Za-z0-9\s]/.test(value),
  },
] as const;

const getTokenMessage = (status: TokenStatus, fallback?: string) => {
  if (fallback) return fallback;
  if (status === "expired") return "Reset link expired";
  if (status === "used") return "This link has already been used";
  if (status === "invalid") return "Invalid reset link";
  return "";
};

const SubmitButton = ({ disabled }: { disabled: boolean }) => {
  const { pending } = useFormStatus();
  const { safeT } = useI18n();

  return (
    <Button className="h-11 w-full" disabled={disabled || pending} type="submit">
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {safeT("auth.resetForm.updatingPassword", "Updating password")}
        </>
      ) : (
        safeT("auth.resetForm.changePassword", "Change password")
      )}
    </Button>
  );
};

const ResetPass = () => {
  const { safeT } = useI18n();
  const initialState: FormState = {
    status: 0,
    message: "",
    errors: {},
  };
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const typedState = state as FormState;
  const sParams = useSearchParams();
  const router = useRouter();
  const initialEmail = normalizeEmail(sParams.get("email") ?? "");
  const token = (sParams.get("token") ?? "").trim();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>("idle");
  const [tokenMessage, setTokenMessage] = useState("");

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const trimmedPassword = useMemo(() => normalizePassword(password), [password]);
  const trimmedConfirmPassword = useMemo(
    () => normalizePassword(confirmPassword),
    [confirmPassword],
  );
  const passedRules = passwordRules.filter((rule) =>
    rule.test(trimmedPassword),
  ).length;
  const strengthPercent = (passedRules / passwordRules.length) * 100;
  const strengthLabel =
    passedRules <= 2 ? "Weak" : passedRules <= 4 ? "Good" : "Strong";

  const clientErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (touched.email) {
      if (!normalizedEmail) {
        errors.email = safeT("auth.resetForm.emailRequired", "Email is required");
      } else if (!EMAIL_REGEX.test(normalizedEmail)) {
        errors.email = safeT("auth.resetForm.emailInvalid", "Enter a valid email address");
      }
    }

    if (touched.password) {
      if (!trimmedPassword) {
        errors.password = safeT("auth.resetForm.passwordRequired", "Password is required");
      } else {
        const missingRule = passwordRules.find(
          (rule) => !rule.test(trimmedPassword),
        );
        if (missingRule) {
          errors.password = safeT(missingRule.labelKey, missingRule.fallback);
        }
      }
    }

    if (touched.confirmPassword) {
      if (!trimmedConfirmPassword) {
        errors.confirm_password = safeT(
          "auth.resetForm.confirmPasswordRequired",
          "Confirm password is required",
        );
      } else if (trimmedPassword !== trimmedConfirmPassword) {
        errors.confirm_password = safeT(
          "auth.resetForm.passwordMismatch",
          "Passwords do not match",
        );
      }
    }

    return errors;
  }, [
    normalizedEmail,
    safeT,
    touched.confirmPassword,
    touched.email,
    touched.password,
    trimmedConfirmPassword,
    trimmedPassword,
  ]);

  const isPasswordValid =
    trimmedPassword.length > 0 &&
    passwordRules.every((rule) => rule.test(trimmedPassword));
  const isFormValid =
    EMAIL_REGEX.test(normalizedEmail) &&
    isPasswordValid &&
    trimmedConfirmPassword.length > 0 &&
    trimmedPassword === trimmedConfirmPassword &&
    tokenStatus === "valid";

  useEffect(() => {
    if (!token || !TOKEN_REGEX.test(token)) {
      setTokenStatus("invalid");
      setTokenMessage("Invalid reset link");
      return;
    }

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      setTokenStatus("idle");
      setTokenMessage("");
      return;
    }

    let cancelled = false;
    setTokenStatus("checking");
    setTokenMessage("");

    axios
      .get(validateResetPassword, {
        params: {
          email: normalizedEmail,
          token,
        },
      })
      .then(() => {
        if (!cancelled) {
          setTokenStatus("valid");
          setTokenMessage("");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        const response = error instanceof AxiosError ? error.response?.data : null;
        const message =
          typeof response?.message === "string" ? response.message : "";
        const code =
          typeof response?.data?.code === "string" ? response.data.code : "";
        const nextStatus: TokenStatus =
          code === "expired"
            ? "expired"
            : code === "used"
              ? "used"
              : "invalid";

        setTokenStatus(nextStatus);
        setTokenMessage(getTokenMessage(nextStatus, message));
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedEmail, token]);

  useEffect(() => {
    if (typedState.status === 200) {
      toast.success(SUCCESS_MESSAGE);
      const timeout = window.setTimeout(() => {
        router.replace("/login");
      }, 3000);

      return () => window.clearTimeout(timeout);
    }

    if (typedState.status >= 400) {
      const serverTokenError = getFieldError(typedState.errors, "token");
      if (serverTokenError) {
        const message = String(serverTokenError);
        setTokenStatus(
          message.toLowerCase().includes("expired")
            ? "expired"
            : message.toLowerCase().includes("used")
              ? "used"
              : "invalid",
        );
        setTokenMessage(message);
      }

      toast.error(typedState.message || "Unable to reset password.");
    }
  }, [router, typedState.errors, typedState.message, typedState.status]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
    });

    if (!isFormValid) {
      event.preventDefault();
      toast.error(
        tokenStatus !== "valid"
          ? getTokenMessage(tokenStatus, tokenMessage) || "Invalid reset link"
          : "Please fix the highlighted fields.",
      );
    }
  };

  if (typedState.status === 200) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
        <CheckCircle2 className="mx-auto h-10 w-10" />
        <p className="mt-4 text-base font-semibold">{SUCCESS_MESSAGE}</p>
      </div>
    );
  }

  const tokenError = getTokenMessage(tokenStatus, tokenMessage);
  const canEditForm = tokenStatus !== "invalid" && tokenStatus !== "expired" && tokenStatus !== "used";

  return (
    <form action={formAction} className="space-y-5" onSubmit={handleSubmit}>
      <input name="email" type="hidden" value={normalizedEmail} />
      <input name="password" type="hidden" value={trimmedPassword} />
      <input name="confirm_password" type="hidden" value={trimmedConfirmPassword} />
      <input name="token" type="hidden" value={token} />

      {tokenStatus === "checking" && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Checking reset link
        </div>
      )}

      {tokenError && tokenStatus !== "idle" && (
        <div className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{tokenError}</p>
            {!canEditForm && (
              <Button asChild className="mt-3 h-9" variant="outline">
                <Link href="/forgot-password">
                  {safeT("auth.resetForm.requestNewLink", "Request a new link")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reset-email">
          {safeT("auth.resetForm.emailLabel", "Email")}
        </Label>
        <Input
          autoComplete="email"
          disabled={!canEditForm}
          id="reset-email"
          inputMode="email"
          onBlur={() => {
            setTouched((current) => ({ ...current, email: true }));
            setEmail(normalizedEmail);
          }}
          onChange={(event) => setEmail(event.target.value.toLowerCase())}
          placeholder={safeT("auth.resetForm.emailPlaceholder", "you@company.com")}
          type="email"
          value={email}
        />
        {(clientErrors.email || getFieldError(typedState.errors, "email")) && (
          <p className="text-sm text-destructive">
            {clientErrors.email || getFieldError(typedState.errors, "email")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-password">
          {safeT("auth.resetForm.passwordLabel", "Password")}
        </Label>
        <div className="relative">
          <Input
            autoComplete="new-password"
            disabled={!canEditForm}
            id="reset-password"
            onBlur={() =>
              setTouched((current) => ({ ...current, password: true }))
            }
            onChange={(event) => setPassword(event.target.value)}
            placeholder={safeT(
              "auth.resetForm.passwordPlaceholder",
              "Create a strong password",
            )}
            type={showPassword ? "text" : "password"}
            value={password}
          />
          <button
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            disabled={!canEditForm}
            onClick={() => setShowPassword((current) => !current)}
            type="button"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 transition-all"
              style={{ width: `${strengthPercent}%` }}
            />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            {safeT("auth.resetForm.strengthLabel", "Strength")}: {strengthLabel}
          </p>
        </div>
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          {passwordRules.map((rule) => {
            const passed = rule.test(trimmedPassword);
            return (
              <span
                className={passed ? "text-emerald-600 dark:text-emerald-300" : ""}
                key={rule.key}
              >
                {passed ? "OK" : "-"} {safeT(rule.labelKey, rule.fallback)}
              </span>
            );
          })}
        </div>
        {(clientErrors.password || getFieldError(typedState.errors, "password")) && (
          <p className="text-sm text-destructive">
            {clientErrors.password || getFieldError(typedState.errors, "password")}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-confirm-password">
          {safeT("auth.resetForm.confirmPasswordLabel", "Confirm password")}
        </Label>
        <div className="relative">
          <Input
            autoComplete="new-password"
            disabled={!canEditForm}
            id="reset-confirm-password"
            onBlur={() =>
              setTouched((current) => ({ ...current, confirmPassword: true }))
            }
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder={safeT(
              "auth.resetForm.confirmPasswordPlaceholder",
              "Repeat your password",
            )}
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
          />
          <button
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground disabled:opacity-50"
            disabled={!canEditForm}
            onClick={() => setShowConfirmPassword((current) => !current)}
            type="button"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {(clientErrors.confirm_password ||
          getFieldError(typedState.errors, "confirm_password")) && (
          <p className="text-sm text-destructive">
            {clientErrors.confirm_password ||
              getFieldError(typedState.errors, "confirm_password")}
          </p>
        )}
      </div>

      <SubmitButton disabled={!isFormValid || !canEditForm} />
    </form>
  );
};

export default ResetPass;
