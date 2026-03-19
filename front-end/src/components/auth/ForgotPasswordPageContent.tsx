"use client";

import ForgetPass from "@/components/auth/forgetPass";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { useI18n } from "@/providers/LanguageProvider";

const ForgotPasswordPageContent = () => {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f3ee] px-6 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-[#ecdccf] bg-white/90 px-10 py-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#f97316] to-[#fb7185]" />
            <div>
              <div className="text-2xl font-extrabold text-[#1f1b16]">
                {t("common.appName")}
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b45309]">
                {t("auth.forgotPage.badge")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#1f1b16]">
          {t("auth.forgotPage.title")}
        </h1>
        <p className="mt-2 text-sm text-[#5c4b3b]">
          {t("auth.forgotPage.description")}
        </p>

        <div className="mt-6">
          <ForgetPass />
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPageContent;
