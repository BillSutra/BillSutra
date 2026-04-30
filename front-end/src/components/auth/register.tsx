"use client";
import React, {
  FormEvent,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";

import { registerAction } from "@/actions/authActions";
import AuthFormField from "@/components/auth/AuthFormField";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  User2,
  X,
} from "lucide-react";

type RegisterProps = {
  autoFocusFirstField?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const SPECIAL_CHARACTER_REGEX = /[@$!%*?&]/;

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const asErrorText = (value: unknown) => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
};

const Register = ({ autoFocusFirstField = false }: RegisterProps) => {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCompletingSignup, setIsCompletingSignup] = useState(false);
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    phone: false,
    password: false,
    confirmPassword: false,
  });

  const initalState = {
    status: 0,
    message: "",
    errors: {},
    data: {},
  };
  const [state, formAction, isRegisterSubmitting] = useActionState(
    registerAction,
    initalState,
  );

  const passwordChecks = useMemo(
    () => [
      {
        label: "Minimum 8 characters",
        met: password.length >= 8,
      },
      {
        label: "At least 1 uppercase letter",
        met: /[A-Z]/.test(password),
      },
      {
        label: "At least 1 lowercase letter",
        met: /[a-z]/.test(password),
      },
      {
        label: "At least 1 number",
        met: /\d/.test(password),
      },
      {
        label: "At least 1 special character",
        met: SPECIAL_CHARACTER_REGEX.test(password),
      },
    ],
    [password],
  );

  const passwordStrength = useMemo(() => {
    const metCount = passwordChecks.filter((rule) => rule.met).length;

    if (metCount <= 2) {
      return {
        label: "Weak",
        barClassName: "bg-red-500",
        textClassName: "text-red-600",
      };
    }

    if (metCount <= 4) {
      return {
        label: "Medium",
        barClassName: "bg-amber-500",
        textClassName: "text-amber-600",
      };
    }

    return {
      label: "Strong",
      barClassName: "bg-emerald-500",
      textClassName: "text-emerald-600",
    };
  }, [passwordChecks]);

  const isPasswordStrong = passwordChecks.every((rule) => rule.met);

  const validateName = (value: string) => {
    if (!value.trim()) {
      return "Enter your full name.";
    }

    if (value.trim().length < 2) {
      return "Name should have at least 2 characters.";
    }

    return "";
  };

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      return "Enter your email.";
    }

    if (!EMAIL_REGEX.test(value.trim())) {
      return "Enter a valid email address.";
    }

    return "";
  };

  const validatePhone = (value: string) => {
    if (!value.trim()) {
      return "Enter your phone number.";
    }

    if (!INDIAN_PHONE_REGEX.test(normalizePhone(value))) {
      return "Enter a valid Indian phone number.";
    }

    return "";
  };

  const validatePassword = (value: string) => {
    if (!value.trim()) {
      return "Create a password.";
    }

    const firstUnmetRule = [
      {
        test: value.length >= 8,
        message: "Minimum 8 characters",
      },
      {
        test: /[A-Z]/.test(value),
        message: "Must include uppercase letter",
      },
      {
        test: /[a-z]/.test(value),
        message: "Must include lowercase letter",
      },
      {
        test: /\d/.test(value),
        message: "Must include number",
      },
      {
        test: SPECIAL_CHARACTER_REGEX.test(value),
        message: "Must include special character",
      },
    ].find((rule) => !rule.test);

    if (firstUnmetRule) {
      return firstUnmetRule.message;
    }

    return "";
  };

  const validateConfirmPassword = (value: string, sourcePassword: string) => {
    if (!value.trim()) {
      return "Confirm your password.";
    }

    if (sourcePassword !== value) {
      return "Passwords do not match.";
    }

    return "";
  };

  const clientErrors = useMemo(
    () => ({
      name: touched.name ? validateName(name) : "",
      email: touched.email ? validateEmail(email) : "",
      phone: touched.phone ? validatePhone(phone) : "",
      password: touched.password ? validatePassword(password) : "",
      confirm_password: touched.confirmPassword
        ? validateConfirmPassword(confirmPassword, password)
        : "",
    }),
    [confirmPassword, email, name, password, phone, touched],
  );

  const hasClientError =
    Boolean(clientErrors.name) ||
    Boolean(clientErrors.email) ||
    Boolean(clientErrors.phone) ||
    Boolean(clientErrors.password) ||
    Boolean(clientErrors.confirm_password);

  const isFormValid = Boolean(
    name.trim() &&
      email.trim() &&
      phone.trim() &&
      password &&
      confirmPassword &&
      !validateName(name) &&
      !validateEmail(email) &&
      !validatePhone(phone) &&
      isPasswordStrong &&
      !validateConfirmPassword(confirmPassword, password),
  );

  const serverErrors = {
    name: asErrorText(state.errors?.name),
    email: asErrorText(state.errors?.email),
    phone: asErrorText(state.errors?.phone),
    password: asErrorText(state.errors?.password),
    confirm_password: asErrorText(state.errors?.confirm_password),
  };

  useEffect(() => {
    if (state.status === 503 && state.data?.verification) {
      toast.error(
        state.message ||
          "Account created, but we could not send the verification code yet.",
      );
      const verificationEmail =
        typeof state.data?.verification?.email === "string" &&
        state.data.verification.email.trim()
          ? state.data.verification.email.trim()
          : email.trim();
      const nextSearchParams = new URLSearchParams({
        email: verificationEmail,
        delivery: "failed",
      });
      if (typeof state.data?.verification?.retryAfter === "number") {
        nextSearchParams.set(
          "retryAfter",
          String(state.data.verification.retryAfter),
        );
      }
      if (typeof state.data?.verification?.expiresIn === "number") {
        nextSearchParams.set(
          "expiresIn",
          String(state.data.verification.expiresIn),
        );
      }

      setIsCompletingSignup(true);
      router.push(`/verify-email?${nextSearchParams.toString()}`);
    } else if (state.status >= 400) {
      captureAnalyticsEvent("auth_signup_failed", {
        method: "password",
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 201) {
      captureAnalyticsEvent("auth_signup_succeeded", {
        method: "password",
      });
      toast.success(state.message || "Account created. Verify your email to continue.");
      const verificationEmail =
        typeof state.data?.verification?.email === "string" &&
        state.data.verification.email.trim()
          ? state.data.verification.email.trim()
          : email.trim();
      const nextSearchParams = new URLSearchParams({
        email: verificationEmail,
      });
      if (typeof state.data?.verification?.retryAfter === "number") {
        nextSearchParams.set(
          "retryAfter",
          String(state.data.verification.retryAfter),
        );
      }
      if (typeof state.data?.verification?.expiresIn === "number") {
        nextSearchParams.set(
          "expiresIn",
          String(state.data.verification.expiresIn),
        );
      }
      if (state.data?.verification?.otpDeliveryFailed === true) {
        nextSearchParams.set("delivery", "failed");
      }

      setIsCompletingSignup(true);
      router.push(`/verify-email?${nextSearchParams.toString()}`);
    }
  }, [email, router, state, t]);

  const handleGoogleSignup = () => {
    captureAnalyticsEvent("auth_signup_started", {
      method: "google",
    });
    signIn("google", { callbackUrl: "/dashboard", redirect: true });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const nextTouched = {
      name: true,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true,
    };

    setTouched(nextTouched);

    const errors = {
      name: validateName(name),
      email: validateEmail(email),
      phone: validatePhone(phone),
      password: validatePassword(password),
      confirm_password: validateConfirmPassword(confirmPassword, password),
    };

    if (
      errors.name ||
      errors.email ||
      errors.phone ||
      errors.password ||
      errors.confirm_password
    ) {
      event.preventDefault();
      return;
    }

    captureAnalyticsEvent("auth_signup_started", {
      method: "password",
    });
  };

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[
          "Account details",
          "Secure password",
          "Verify email",
        ].map((step, index) => (
          <div
            key={step}
            className="rounded-2xl border border-white/65 bg-white/72 px-3 py-3 text-sm shadow-[0_18px_42px_-36px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/5"
          >
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
              Step {index + 1}
            </p>
            <p className="mt-1 font-medium text-foreground">{step}</p>
          </div>
        ))}
      </div>

      <form
        action={formAction}
        className="grid gap-4 rounded-[1.75rem] border border-white/65 bg-white/78 p-4 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.34)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 sm:p-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/[0.04] px-4 py-3 dark:border-primary/15 dark:bg-primary/[0.08]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">
              Workspace setup
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your account now and verify your email before entering the dashboard.
            </p>
          </div>
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:flex">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <AuthFormField
          id="name"
          name="name"
          label={t("auth.registerForm.nameLabel")}
          placeholder={t("auth.registerForm.namePlaceholder")}
          type="text"
          value={name}
          onChange={setName}
          onBlur={() => setTouched((current) => ({ ...current, name: true }))}
          autoComplete="name"
          autoFocus={autoFocusFirstField}
          error={clientErrors.name || serverErrors.name}
          disabled={isRegisterSubmitting}
          leftAdornment={<User2 className="h-4 w-4" />}
        />

        <AuthFormField
          id="email"
          name="email"
          label={t("auth.registerForm.emailLabel")}
          placeholder={t("auth.registerForm.emailPlaceholder")}
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setTouched((current) => ({ ...current, email: true }))}
          autoComplete="email"
          error={clientErrors.email || serverErrors.email}
          disabled={isRegisterSubmitting}
          leftAdornment={<Mail className="h-4 w-4" />}
        />

        <AuthFormField
          id="phone"
          name="phone"
          label={t("auth.shared.phoneLabel")}
          placeholder={t("auth.shared.phonePlaceholder")}
          type="tel"
          value={phone}
          onChange={setPhone}
          onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
          autoComplete="tel-national"
          inputMode="tel"
          error={clientErrors.phone || serverErrors.phone}
          disabled={isRegisterSubmitting}
          helperText={t("auth.shared.phoneHelper")}
          leftAdornment={<Phone className="h-4 w-4" />}
        />

        <AuthFormField
          id="password"
          name="password"
          label={t("auth.registerForm.passwordLabel")}
          placeholder={t("auth.registerForm.passwordPlaceholder")}
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((current) => ({ ...current, password: true }))}
          autoComplete="new-password"
          error={clientErrors.password || serverErrors.password}
          disabled={isRegisterSubmitting || isCompletingSignup}
          leftAdornment={<LockKeyhole className="h-4 w-4" />}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-full"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? t("common.hide") : t("common.show")}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          }
        />

        <div className="rounded-[1.45rem] border border-white/70 bg-slate-950/[0.035] p-4 shadow-[0_18px_42px_-38px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-white/[0.04]">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Password strength
            </span>
            <span className={passwordStrength.textClassName}>
              {password ? passwordStrength.label : "Enter a password"}
            </span>
          </div>
          <div className="mb-3 h-2 rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all duration-200 ${passwordStrength.barClassName}`}
              style={{
                width: `${(passwordChecks.filter((rule) => rule.met).length / passwordChecks.length) * 100}%`,
              }}
            />
          </div>
          <div className="grid gap-2">
            {passwordChecks.map((rule) => (
              <div
                key={rule.label}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {rule.met ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        </div>

        <AuthFormField
          id="confirm_password"
          name="confirm_password"
          label={t("auth.registerForm.confirmPasswordLabel")}
          placeholder={t("auth.registerForm.confirmPasswordPlaceholder")}
          type={showConfirmPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={setConfirmPassword}
          onBlur={() =>
            setTouched((current) => ({ ...current, confirmPassword: true }))
          }
          autoComplete="new-password"
          error={clientErrors.confirm_password || serverErrors.confirm_password}
          disabled={isRegisterSubmitting || isCompletingSignup}
          leftAdornment={<LockKeyhole className="h-4 w-4" />}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-full"
              onClick={() => setShowConfirmPassword((current) => !current)}
              aria-label={showConfirmPassword ? t("common.hide") : t("common.show")}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          }
        />

        <div className="rounded-2xl border border-white/60 bg-white/65 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          By continuing, you agree to keep your workspace secure and verify your email before using BillSutra.
        </div>

        <Button
          type="submit"
          className="mt-2 h-12 w-full rounded-2xl shadow-[0_24px_45px_-26px_rgba(2,132,199,0.58)] transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
          disabled={
            isRegisterSubmitting || isCompletingSignup || hasClientError || !isFormValid
          }
        >
          {isRegisterSubmitting || isCompletingSignup ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {isCompletingSignup
                ? "Preparing verification..."
                : t("auth.shared.creatingAccount")}
            </>
          ) : (
            t("auth.shared.createAccount")
          )}
        </Button>

        <div aria-live="polite" className="min-h-5 text-xs text-muted-foreground">
          {state.status >= 400 && state.message ? state.message : null}
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              {t("auth.registerForm.continueWith")}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 flex h-12 w-full items-center justify-center gap-3 rounded-2xl border-white/70 bg-white/78 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10"
          onClick={handleGoogleSignup}
          disabled={isRegisterSubmitting}
        >
          <Image
            src="/images/google.png"
            alt={t("auth.registerForm.googleLogoAlt")}
            width={18}
            height={18}
          />
          {t("auth.registerForm.google")}
        </Button>
      </div>
    </div>
  );
};

export default Register;
