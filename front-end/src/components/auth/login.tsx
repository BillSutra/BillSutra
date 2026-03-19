"use client";
import React, { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { loginAction } from "@/actions/authActions";
import SubmitBtn from "@/components/common/SubmitBtn";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useI18n } from "@/providers/LanguageProvider";

export default function Login() {
  const { t } = useI18n();
  const initialState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message);
      const rawToken = state.data?.token;
      const token =
        typeof rawToken === "string" ? rawToken.trim() : String(rawToken ?? "");
      if (token && token !== "undefined" && token !== "null") {
        window.localStorage.setItem("token", token);
      } else {
        window.localStorage.removeItem("token");
      }
      signIn("credentials", {
        email: state.data?.email,
        password: state.data?.password,
        redirect: true,
        callbackUrl: "/dashboard",
      });
    }
  }, [state]);

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard", redirect: true });
  };

  return (
    <>
      <form action={formAction} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">{t("auth.loginForm.emailLabel")}</Label>
          <Input
            placeholder={t("auth.loginForm.emailPlaceholder")}
            name="email"
          />
          <span className="text-xs text-[#b45309]">{state.errors?.email}</span>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.loginForm.passwordLabel")}</Label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#b45309]"
            >
              {t("auth.loginForm.forgotPassword")}
            </Link>
          </div>
          <Input
            type="password"
            placeholder={t("auth.loginForm.passwordPlaceholder")}
            name="password"
          />
          <span className="text-xs text-[#b45309]">
            {state.errors?.password}
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
              {t("auth.loginForm.continueWith")}
            </span>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex items-center justify-center gap-3 border-[#ecdccf] bg-white"
            onClick={handleGoogleLogin}
          >
            <Image
              src="/images/google.png"
              alt={t("auth.loginForm.googleLogoAlt")}
              width={18}
              height={18}
            />
            {t("auth.loginForm.google")}
          </Button>
        </div>
      </div>
    </>
  );
}
