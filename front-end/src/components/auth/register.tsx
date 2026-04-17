"use client";
import React, { FormEvent, useActionState, useEffect, useMemo, useState } from "react";

import { registerAction } from "@/actions/authActions";
import AuthFormField from "@/components/auth/AuthFormField";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";
import { captureAnalyticsEvent } from "@/lib/observability/client";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

type RegisterProps = {
  autoFocusFirstField?: boolean;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const asErrorText = (value: unknown) => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : "";
  }

  return typeof value === "string" ? value : "";
};

const Register = ({ autoFocusFirstField = false }: RegisterProps) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (value.length < 8) {
      return "Password should be at least 8 characters.";
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

  const serverErrors = {
    name: asErrorText(state.errors?.name),
    email: asErrorText(state.errors?.email),
    phone: asErrorText(state.errors?.phone),
    password: asErrorText(state.errors?.password),
    confirm_password: asErrorText(state.errors?.confirm_password),
  };

  useEffect(() => {
    if (state.status >= 400) {
      captureAnalyticsEvent("auth_signup_failed", {
        method: "password",
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 200) {
      captureAnalyticsEvent("auth_signup_succeeded", {
        method: "password",
      });
      toast.success(state.message || t("auth.registerForm.emailSent"));
    }
  }, [state, t]);

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
      <form
        action={formAction}
        className="grid gap-4"
        noValidate
        onSubmit={handleSubmit}
      >
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
          disabled={isRegisterSubmitting}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
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
          disabled={isRegisterSubmitting}
          rightAdornment={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8"
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

        <Button
          type="submit"
          className="mt-2 w-full"
          disabled={isRegisterSubmitting || hasClientError}
        >
          {isRegisterSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t("auth.shared.creatingAccount")}
            </>
          ) : (
            t("auth.shared.createAccount")
          )}
        </Button>
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
          className="mt-4 flex w-full items-center justify-center gap-3 border-border bg-card hover:bg-accent"
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
