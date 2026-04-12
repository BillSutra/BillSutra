"use client";
import React, { useActionState, useEffect } from "react";

import { registerAction } from "@/actions/authActions";
import SubmitBtn from "@/components/common/SubmitBtn";
import { Input } from "@/components/ui/input";
// import { useFormState } from 'react-dom';
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";
import { captureAnalyticsEvent } from "@/lib/observability/client";

const Register = () => {
  const { t } = useI18n();
  const initalState = {
    status: 0,
    message: "",
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(registerAction, initalState);

  useEffect(() => {
    if (state.status === 500) {
      captureAnalyticsEvent("auth_signup_failed", {
        method: "password",
        status: state.status,
      });
      toast.error(state.message);
    } else if (state.status === 422) {
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

  return (
    <div>
      <form
        action={formAction}
        className="grid gap-4"
        onSubmit={() =>
          captureAnalyticsEvent("auth_signup_started", {
            method: "password",
          })
        }
      >
        <div className="grid gap-2">
          <Label htmlFor="name">{t("auth.registerForm.nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            placeholder={t("auth.registerForm.namePlaceholder")}
            type="text"
          />
          <span className="text-xs text-destructive">{state.errors?.name}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.registerForm.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            placeholder={t("auth.registerForm.emailPlaceholder")}
            type="email"
          />
          <span className="text-xs text-destructive">
            {state.errors?.email}
          </span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">
            {t("auth.registerForm.passwordLabel")}
          </Label>
          <Input
            id="password"
            name="password"
            placeholder={t("auth.registerForm.passwordPlaceholder")}
            type="password"
          />
          <span className="text-xs text-destructive">
            {state.errors?.password}
          </span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirm_password">
            {t("auth.registerForm.confirmPasswordLabel")}
          </Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            placeholder={t("auth.registerForm.confirmPasswordPlaceholder")}
            type="password"
          />
          <span className="text-xs text-destructive">
            {state.errors?.confirm_password}
          </span>
        </div>

        <SubmitBtn />
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
