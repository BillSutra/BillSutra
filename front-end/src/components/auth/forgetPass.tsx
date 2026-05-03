"use client";

import React, { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { forgetAction } from "@/actions/authActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/providers/LanguageProvider";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_SECONDS = 30;
const GENERIC_SUCCESS_MESSAGE =
  "If an account exists, a reset link has been sent.";

type FormState = {
  message: string;
  status: number;
  errors: Record<string, string | string[]>;
  data: Record<string, unknown>;
};

const getFieldError = (
  errors: Record<string, string | string[]> | undefined,
  field: string,
) => {
  const value = errors?.[field];
  return Array.isArray(value) ? value[0] : value;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const SubmitButton = ({
  disabled,
  cooldown,
}: {
  disabled: boolean;
  cooldown: number;
}) => {
  const { pending } = useFormStatus();
  const { safeT } = useI18n();
  const isDisabled = disabled || pending || cooldown > 0;

  return (
    <Button className="h-11 w-full" disabled={isDisabled} type="submit">
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {safeT("auth.forgotForm.sending", "Sending")}
        </>
      ) : cooldown > 0 ? (
        safeT("auth.forgotForm.resendIn", "Resend in {seconds}s", {
          seconds: cooldown,
        })
      ) : (
        safeT("auth.forgotForm.sendResetLink", "Send reset link")
      )}
    </Button>
  );
};

export default function ForgetPass() {
  const { t, safeT } = useI18n();
  const initialState: FormState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(forgetAction, initialState);
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const clientEmailError = useMemo(() => {
    if (!touched) return "";
    if (!normalizedEmail) return safeT("auth.forgotForm.emailRequired", "Email is required");
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return safeT("auth.forgotForm.emailInvalid", "Enter a valid email address");
    }
    return "";
  }, [normalizedEmail, safeT, touched]);
  const serverEmailError = getFieldError(state.errors, "email");
  const isValid = normalizedEmail.length > 0 && EMAIL_REGEX.test(normalizedEmail);

  useEffect(() => {
    if (state.status === 200) {
      toast.success(GENERIC_SUCCESS_MESSAGE);
      setCooldown(RESEND_SECONDS);
    } else if (state.status === 429) {
      toast.error(
        state.message ||
          safeT("auth.forgotForm.tooManyRequests", "Too many requests. Please wait before trying again."),
      );
    } else if (state.status >= 400) {
      toast.error(
        state.message ||
          safeT("auth.forgotForm.emailFailed", "Unable to send reset link right now."),
      );
    }
  }, [safeT, state.message, state.status]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    setTouched(true);

    if (!isValid || cooldown > 0) {
      event.preventDefault();
      toast.error(
        cooldown > 0
          ? safeT("auth.forgotForm.waitToResend", "Please wait before requesting another reset link.")
          : safeT("auth.forgotForm.emailInvalid", "Enter a valid email address"),
      );
    }
  };

  return (
    <form action={formAction} className="space-y-5" onSubmit={handleSubmit}>
      <input name="email" type="hidden" value={normalizedEmail} />
      <div className="space-y-2">
        <Label htmlFor="email">{t("auth.forgotForm.emailLabel")}</Label>
        <Input
          autoComplete="email"
          id="email"
          inputMode="email"
          onBlur={() => {
            setTouched(true);
            setEmail(normalizedEmail);
          }}
          onChange={(event) => setEmail(event.target.value.toLowerCase())}
          placeholder={t("auth.forgotForm.emailPlaceholder")}
          type="email"
          value={email}
        />
        {(clientEmailError || serverEmailError) && (
          <p className="text-sm text-destructive">
            {clientEmailError || serverEmailError}
          </p>
        )}
      </div>

      {state.status === 200 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {GENERIC_SUCCESS_MESSAGE}
        </div>
      )}

      <SubmitButton disabled={!isValid} cooldown={cooldown} />
    </form>
  );
}
