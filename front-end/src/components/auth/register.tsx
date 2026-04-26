"use client";
import React, {
  FormEvent,
  useActionState,
  useCallback,
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
import {
  bootstrapSecureAuthSession,
  isSecureAuthEnabled,
} from "@/lib/secureAuth";
import { captureFrontendException } from "@/lib/observability/shared";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LoaderCircle, X } from "lucide-react";

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

  const completeTokenSignup = useCallback(
    async (
      rawToken: unknown,
      options?: {
        isEmailVerified?: boolean | null;
      },
    ) => {
      if (typeof rawToken !== "string" || !rawToken.trim()) {
        toast.error("A valid login token was not returned.");
        return false;
      }

      const token = rawToken.trim().startsWith("Bearer ")
        ? rawToken.trim()
        : `Bearer ${rawToken.trim()}`;

      setIsCompletingSignup(true);
      try {
        const result = await signIn("auth-token", {
          token,
          redirect: false,
        });

        if (result?.error) {
          throw new Error("Unable to create your session.");
        }

        if (isSecureAuthEnabled()) {
          await bootstrapSecureAuthSession(token);
        }

        router.push(
          options?.isEmailVerified === false ? "/verify-email" : "/dashboard",
        );
        router.refresh();
        return true;
      } catch (error) {
        captureFrontendException(error, {
          tags: {
            flow: "auth.complete_signup_login",
          },
        });
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Unable to complete sign in.";
        toast.error(message);
        return false;
      } finally {
        setIsCompletingSignup(false);
      }
    },
    [router],
  );

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
      toast.success(state.message || "Registration successful.");
      void completeTokenSignup(state.data?.token, {
        isEmailVerified:
          typeof state.data?.user?.is_email_verified === "boolean"
            ? state.data.user.is_email_verified
            : null,
      });
    }
  }, [completeTokenSignup, state, t]);

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
          disabled={isRegisterSubmitting || isCompletingSignup}
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

        <div className="rounded-xl border border-border/80 bg-muted/30 p-3">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">
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
          disabled={
            isRegisterSubmitting || isCompletingSignup || hasClientError || !isFormValid
          }
        >
          {isRegisterSubmitting || isCompletingSignup ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {isCompletingSignup
                ? "Signing you in..."
                : t("auth.shared.creatingAccount")}
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
