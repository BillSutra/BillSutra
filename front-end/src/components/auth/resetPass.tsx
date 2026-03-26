"use client";
import React, { useActionState, useEffect } from "react";

import { resetPasswordAction } from "@/actions/authActions";
import SubmitBtn from "@/components/common/SubmitBtn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/providers/LanguageProvider";

const ResetPass = () => {
  const { t } = useI18n();
  const initalState = {
    status: 0,
    message: "",
    errors: {},
  };
  const [state, formAction] = useActionState(resetPasswordAction, initalState);
  const sParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (state.status === 500) {
      toast.error(state.message);
    } else if (state.status === 422) {
      toast.error(state.message);
    } else if (state.status === 200) {
      toast.success(state.message);

      setTimeout(() => {
        router.replace("/login");
      }, 1000);
    }
  }, [router, state]);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="token" value={sParams.get("token") ?? ""} />
        <div className="mt-4">
          <Label htmlFor="email">{t("auth.resetForm.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            placeholder={t("auth.resetForm.emailPlaceholder")}
            type="email"
            readOnly
            value={sParams.get("email") ?? " "}
          />
          <span className="text-sm text-[#b97908]">{state.errors?.email}</span>
        </div>
        <div className="mt-4">
          <Label htmlFor="Password">{t("auth.resetForm.passwordLabel")}</Label>
          <Input
            id="Password"
            name="password"
            placeholder={t("auth.resetForm.passwordPlaceholder")}
            type="password"
          />
          <span className="text-sm text-[#b97908]">{state.errors?.password}</span>
        </div>
        <div className="mt-4">
          <Label htmlFor="ConfirmPassword">
            {t("auth.resetForm.confirmPasswordLabel")}
          </Label>
          <Input
            id="ConfirmPassword"
            name="confirmpassword"
            placeholder={t("auth.resetForm.confirmPasswordPlaceholder")}
            type="password"
          />
          <span className="text-sm text-[#b97908]">
            {state.errors?.confirm_password}
          </span>
        </div>

        <div className="mt-4">
          <SubmitBtn />
        </div>
      </form>
    </div>
  );
};

export default ResetPass;
