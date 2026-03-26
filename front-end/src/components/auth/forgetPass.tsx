"use client";
import React, { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// import Link from "next/link";
import { forgetAction } from "@/actions/authActions";
// import SubmitBtn from "../common/submitBtn";
import SubmitBtn from "@/components/common/SubmitBtn";
// import { signIn } from "next-auth/react";
import { useI18n } from "@/providers/LanguageProvider";
export default function ForgetPass() {
  const { t } = useI18n();
  const initialState = {
    message: "",
    status: 0,
    errors: {},
    data: {},
  };
  const [state, formAction] = useActionState(forgetAction, initialState);

  useEffect(() => {
    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 422) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message || t("auth.forgotForm.emailSent"));
    }
  }, [state, t]);

  return (
    <form action={formAction}>
      <div className="mt-4">
        <Label htmlFor="email">{t("auth.forgotForm.emailLabel")}</Label>
        <Input
          placeholder={t("auth.forgotForm.emailPlaceholder")}
          name="email"
        />
        <span className="text-sm text-[#b97908]">{state.errors?.email}</span>
      </div>

      <div className="mt-4">
        <SubmitBtn />
      </div>
    </form>
  );
}
