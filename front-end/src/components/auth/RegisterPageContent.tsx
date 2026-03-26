"use client";

import Link from "next/link";
import BrandLogo from "@/components/branding/BrandLogo";
import Register from "@/components/auth/register";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { useI18n } from "@/providers/LanguageProvider";

const RegisterPageContent = () => {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#edf5fb_0%,#f6f9fd_55%,#ffffff_100%)] text-[#10233f]">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:flex-row lg:items-stretch lg:gap-6 lg:py-10">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-20 top-6 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.18),rgba(18,61,101,0))]" />
          <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(241,175,34,0.24),rgba(241,175,34,0))]" />
          <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(42,105,158,0.18),rgba(42,105,158,0))]" />
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0))]" />
        </div>

        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 flex-col justify-between gap-8 overflow-hidden rounded-[2rem] border border-white/60 bg-white/72 p-8 shadow-[0_32px_100px_-60px_rgba(17,37,63,0.75)] backdrop-blur-xl lg:max-w-[29rem]">
          <BrandLogo
            variant="icon"
            className="pointer-events-none absolute -right-10 bottom-2 hidden opacity-[0.08] md:inline-flex"
            iconClassName="h-40 w-40 border-none bg-transparent p-0 shadow-none"
          />
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-[#d8e4ef] bg-white/90 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[#70859d]">
              {t("auth.registerPage.badge")}
            </span>
            <BrandLogo
              variant="lockup"
              className="w-full max-w-[18rem]"
              priority
            />
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-[#10233f]">
                {t("auth.registerPage.title")}
              </h1>
              <p className="text-sm leading-6 text-[#627890]">
                {t("auth.registerPage.description")}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-[#627890]">
            <div className="flex items-center justify-between rounded-2xl border border-[#d8e4ef] bg-white/88 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.35)]">
              <span>{t("auth.registerPage.metricTeams")}</span>
              <span className="font-semibold text-[#10233f]">120+</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-[#d8e4ef] bg-white/88 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.35)]">
              <span>{t("auth.registerPage.metricSetupTime")}</span>
              <span className="font-semibold text-[#10233f]">8 min</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-1 items-center lg:mt-0">
          <div className="w-full rounded-[2rem] border border-white/70 bg-white/92 px-8 py-10 shadow-[0_36px_110px_-70px_rgba(17,37,63,0.7)] backdrop-blur-xl">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#70859d]">
                {t("auth.registerPage.formKicker")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#10233f]">
                {t("auth.registerPage.formTitle")}
              </h2>
              <p className="mt-2 text-sm text-[#627890]">
                {t("auth.registerPage.formDescription")}
              </p>
            </div>
            <Register />
            <p className="mt-6 text-center text-sm text-[#627890]">
              {t("auth.registerPage.footerPrompt")}{" "}
              <Link
                href="/login"
                className="font-semibold text-[#123d65] transition-colors hover:text-[#b97908]"
              >
                {t("auth.registerPage.footerAction")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPageContent;
