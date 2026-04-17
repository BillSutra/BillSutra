"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/branding/BrandLogo";
import Login from "@/components/auth/login";
import Register from "@/components/auth/register";
import LanguageToggle from "@/components/language-toggle";
import ThemeToggle from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/providers/LanguageProvider";

type AuthView = "login" | "signup";

type AuthPageContentProps = {
  initialView?: AuthView;
};

const AuthPageContent = ({ initialView = "login" }: AuthPageContentProps) => {
  const { t } = useI18n();
  const [view, setView] = useState<AuthView>(initialView);

  const heroContent = useMemo(() => {
    if (view === "signup") {
      return {
        badge: t("auth.registerPage.badge"),
        title: t("auth.registerPage.title"),
        description: t("auth.registerPage.description"),
        firstMetricLabel: t("auth.registerPage.metricTeams"),
        firstMetricValue: "120+",
        secondMetricLabel: t("auth.registerPage.metricSetupTime"),
        secondMetricValue: "8 min",
      };
    }

    return {
      badge: t("auth.loginPage.badge"),
      title: t("auth.loginPage.title"),
      description: t("auth.loginPage.description"),
      firstMetricLabel: t("auth.loginPage.metricRevenue"),
      firstMetricValue: "Rs 2.3M",
      secondMetricLabel: t("auth.loginPage.metricOpenInvoices"),
      secondMetricValue: "124",
    };
  }, [t, view]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:flex-row lg:items-stretch lg:gap-6 lg:py-10">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.22),rgba(18,61,101,0))]" />
          <div className="absolute right-0 top-16 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(241,175,34,0.24),rgba(241,175,34,0))]" />
          <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(42,105,158,0.18),rgba(42,105,158,0))]" />
          <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.92),rgba(255,255,255,0))] dark:bg-[radial-gradient(circle_at_top,rgba(7,11,18,0.75),rgba(7,11,18,0))]" />
        </div>

        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="relative flex flex-1 flex-col justify-between gap-8 overflow-hidden rounded-4xl border border-border/80 bg-card/85 p-8 shadow-[0_32px_100px_-60px_rgba(17,37,63,0.42)] backdrop-blur-xl lg:max-w-116">
          <BrandLogo
            variant="icon"
            className="pointer-events-none absolute -right-10 bottom-2 hidden opacity-[0.08] md:inline-flex"
            iconClassName="h-40 w-40 border-none bg-transparent p-0 shadow-none"
          />
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-border/80 bg-card/85 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {heroContent.badge}
            </span>
            <BrandLogo variant="lockup" className="w-full max-w-[18rem]" priority />
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold leading-tight text-foreground">
                {heroContent.title}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">
                {heroContent.description}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between rounded-2xl border border-border/75 bg-card/80 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.28)]">
              <span>{heroContent.firstMetricLabel}</span>
              <span className="font-semibold text-foreground">
                {heroContent.firstMetricValue}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/75 bg-card/80 px-4 py-3 shadow-[0_18px_45px_-40px_rgba(17,37,63,0.28)]">
              <span>{heroContent.secondMetricLabel}</span>
              <span className="font-semibold text-foreground">
                {heroContent.secondMetricValue}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-1 items-center lg:mt-0">
          <div className="w-full rounded-4xl border border-border/80 bg-card/90 px-6 py-8 shadow-[0_36px_110px_-70px_rgba(17,37,63,0.4)] backdrop-blur-xl sm:px-8 sm:py-10">
            <div className="mb-6 flex flex-col gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {view === "login"
                    ? t("auth.loginPage.formKicker")
                    : t("auth.registerPage.formKicker")}
                </p>
                <h2 className="text-2xl font-semibold text-foreground">
                  {view === "login"
                    ? t("auth.loginPage.formTitle")
                    : t("auth.registerPage.formTitle")}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {view === "login"
                    ? t("auth.loginPage.formDescription")
                    : t("auth.registerPage.formDescription")}
                </p>
              </div>

              <div className="inline-flex w-full rounded-xl border border-border/80 bg-muted/35 p-1 sm:w-auto">
                <Button
                  type="button"
                  variant={view === "login" ? "default" : "ghost"}
                  className="h-9 flex-1 rounded-lg px-5 sm:flex-none"
                  onClick={() => setView("login")}
                >
                  {t("auth.shared.loginTab")}
                </Button>
                <Button
                  type="button"
                  variant={view === "signup" ? "default" : "ghost"}
                  className="h-9 flex-1 rounded-lg px-5 sm:flex-none"
                  onClick={() => setView("signup")}
                >
                  {t("auth.shared.signupTab")}
                </Button>
              </div>
            </div>

            <div className="relative min-h-152">
              <div
                className={cn(
                  "transition-all duration-300 ease-out",
                  view === "login"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 -translate-x-3 opacity-0",
                )}
                aria-hidden={view !== "login"}
              >
                <Login autoFocusFirstField={view === "login"} />
              </div>

              <div
                className={cn(
                  "transition-all duration-300 ease-out",
                  view === "signup"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none absolute inset-0 translate-x-3 opacity-0",
                )}
                aria-hidden={view !== "signup"}
              >
                <Register autoFocusFirstField={view === "signup"} />
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {view === "login" ? t("auth.loginPage.footerPrompt") : t("auth.registerPage.footerPrompt")}{" "}
              <button
                type="button"
                className="font-semibold text-primary transition-colors hover:text-primary/80"
                onClick={() => setView(view === "login" ? "signup" : "login")}
              >
                {view === "login"
                  ? t("auth.shared.signupTab")
                  : t("auth.shared.loginTab")}
              </button>
            </p>
            {view === "login" ? (
              <p className="mt-3 text-center text-sm text-muted-foreground">
                {t("auth.shared.workerPrompt")} {" "}
                <Link
                  href="/worker/login"
                  className="font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  {t("auth.shared.workerAction")}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPageContent;