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
import {
  sendAccountVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/emailService";
import { useI18n } from "@/providers/LanguageProvider";

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
    const sendSignupEmails = async () => {
      try {
        const payload = state.data as { email?: string; name?: string } | undefined;
        const email = String(payload?.email ?? "");
        const name = String(payload?.name ?? "");
        if (!email || !name) return;

        await sendAccountVerificationEmail({
          user_email: email,
          user_name: name,
        });
        await sendWelcomeEmail({
          user_email: email,
          user_name: name,
        });
        toast.success(t("auth.registerForm.emailSent"));
      } catch {
        toast.error(t("auth.registerForm.emailFailed"));
      }
    };

    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 422) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message);
      void sendSignupEmails();
    }
  }, [state, t]);

  const handleGoogleSignup = () => {
    signIn("google", { callbackUrl: "/dashboard", redirect: true });
  };

  return (
    <div>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">{t("auth.registerForm.nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            placeholder={t("auth.registerForm.namePlaceholder")}
            type="text"
          />
          <span className="text-xs text-[#b45309]">{state.errors?.name}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.registerForm.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            placeholder={t("auth.registerForm.emailPlaceholder")}
            type="email"
          />
          <span className="text-xs text-[#b45309]">{state.errors?.email}</span>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("auth.registerForm.passwordLabel")}</Label>
          <Input
            id="password"
            name="password"
            placeholder={t("auth.registerForm.passwordPlaceholder")}
            type="password"
          />
          <span className="text-xs text-[#b45309]">
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
          <span className="text-xs text-[#b45309]">
            {state.errors?.confirm_password}
          </span>
        </div>

        <SubmitBtn />
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[#ecdccf]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-[#8a6d56]">
              {t("auth.registerForm.continueWith")}
            </span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 flex w-full items-center justify-center gap-3 border-[#ecdccf] bg-white"
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
