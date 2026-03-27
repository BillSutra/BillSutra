"use client";

import { Suspense } from "react";
import BrandLogo from "@/components/branding/BrandLogo";
import ResetPass from "@/components/auth/resetPass";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { useI18n } from "@/providers/LanguageProvider";

const ResetPasswordPageContent = () => {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#edf5fb_0%,#f6f9fd_55%,#ffffff_100%)] px-6 py-10">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.18),rgba(18,61,101,0))]" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(241,175,34,0.22),rgba(241,175,34,0))]" />
      </div>
      <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/92 px-10 py-8 shadow-[0_36px_110px_-70px_rgba(17,37,63,0.7)] backdrop-blur-xl">
        <BrandLogo
          variant="icon"
          className="pointer-events-none absolute -right-8 bottom-4 hidden opacity-[0.08] md:inline-flex"
          iconClassName="h-32 w-32 border-none bg-transparent p-0 shadow-none"
        />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-[#d8e4ef] bg-white/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#70859d]">
              {t("auth.resetPage.badge")}
            </span>
            <BrandLogo variant="lockup" className="w-full max-w-[12rem]" priority />
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[#10233f]">
          {t("auth.resetPage.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#627890]">
          {t("auth.resetPage.description")}
        </p>

        <div className="mt-6">
          <Suspense fallback={<div>{t("common.loading")}</div>}>
            <ResetPass />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPageContent;
