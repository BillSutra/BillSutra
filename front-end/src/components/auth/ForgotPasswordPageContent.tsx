"use client";

import BrandLogo from "@/components/branding/BrandLogo";
import ForgetPass from "@/components/auth/forgetPass";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { useI18n } from "@/providers/LanguageProvider";

const ForgotPasswordPageContent = () => {
  const { t } = useI18n();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-4 py-8 text-foreground sm:px-6 sm:py-10">
      <div className="absolute inset-0 -z-10">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.18),rgba(18,61,101,0))]" />
        <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(241,175,34,0.22),rgba(241,175,34,0))]" />
      </div>
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border/80 bg-card/90 px-5 py-7 shadow-[0_24px_70px_-48px_rgba(17,37,63,0.45)] backdrop-blur-xl sm:px-10 sm:py-8">
        <BrandLogo
          variant="icon"
          className="pointer-events-none absolute -right-8 bottom-4 hidden opacity-[0.08] md:inline-flex"
          iconClassName="h-32 w-32 border-none bg-transparent p-0 shadow-none"
        />
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="space-y-4">
            <span className="inline-flex rounded-full border border-border/80 bg-card/85 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {t("auth.forgotPage.badge")}
            </span>
            <BrandLogo variant="lockup" className="w-full max-w-48" priority />
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-bold text-foreground">
          {t("auth.forgotPage.title")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
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
