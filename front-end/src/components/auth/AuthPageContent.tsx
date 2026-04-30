"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Boxes,
  BrainCircuit,
  CreditCard,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users2,
} from "lucide-react";
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

  const benefits = useMemo(
    () => [
      {
        icon: CreditCard,
        label: t("auth.shared.benefits.gstReadyBilling"),
      },
      {
        icon: Boxes,
        label: t("auth.shared.benefits.smartInventory"),
      },
      {
        icon: BadgeCheck,
        label: t("auth.shared.benefits.paymentReminders"),
      },
      {
        icon: BrainCircuit,
        label: t("auth.shared.benefits.aiInsights"),
      },
      {
        icon: Users2,
        label: t("auth.shared.benefits.multiUserAccess"),
      },
    ],
    [t],
  );

  const floatingCards = useMemo(
    () => [
      {
        icon: TrendingUp,
        title: t("auth.shared.showcaseCards.revenue.title"),
        value: t("auth.shared.showcaseCards.revenue.value"),
        accent:
          "from-emerald-500/18 via-emerald-400/10 to-transparent text-emerald-950 dark:text-emerald-100",
        position: "lg:absolute lg:right-6 lg:top-24",
        animationDelay: "0s",
      },
      {
        icon: ShieldCheck,
        title: t("auth.shared.showcaseCards.pending.title"),
        value: t("auth.shared.showcaseCards.pending.value"),
        accent:
          "from-amber-500/18 via-amber-400/12 to-transparent text-amber-950 dark:text-amber-100",
        position: "lg:absolute lg:left-8 lg:bottom-34",
        animationDelay: "1.2s",
      },
      {
        icon: TriangleAlert,
        title: t("auth.shared.showcaseCards.stock.title"),
        value: t("auth.shared.showcaseCards.stock.value"),
        accent:
          "from-sky-500/18 via-sky-400/12 to-transparent text-sky-950 dark:text-sky-100",
        position: "lg:absolute lg:right-14 lg:bottom-12",
        animationDelay: "2.4s",
      },
    ],
    [t],
  );

  const trustPills = useMemo(
    () => [
      {
        icon: Sparkles,
        label: t("auth.shared.trust.businesses"),
      },
      {
        icon: ShieldCheck,
        label: t("auth.shared.trust.secureLogin"),
      },
      {
        icon: BadgeCheck,
        label: t("auth.shared.trust.encryptedData"),
      },
      {
        icon: BrainCircuit,
        label: t("auth.shared.trust.fastSupport"),
      },
    ],
    [t],
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(20,112,135,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(246,189,96,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] text-foreground dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_top_right,rgba(250,204,21,0.08),transparent_24%),linear-gradient(180deg,rgba(4,9,18,1),rgba(9,14,24,1))]">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
        <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18),transparent_68%)] blur-2xl" />
        <div className="absolute right-[-5rem] top-10 h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.2),transparent_70%)] blur-2xl" />
        <div className="absolute bottom-[-4rem] left-1/3 h-64 w-64 rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.13),transparent_68%)] blur-2xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="mb-4 flex justify-end gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="grid flex-1 gap-6 lg:grid-cols-[1.08fr_0.92fr] xl:gap-8">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-white/70 p-6 shadow-[0_32px_90px_-50px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_34px_100px_-60px_rgba(0,0,0,0.72)] sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),transparent_42%,rgba(251,191,36,0.12))] dark:bg-[linear-gradient(135deg,rgba(56,189,248,0.12),transparent_42%,rgba(251,191,36,0.08))]" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

            <div className="relative flex h-full flex-col justify-between gap-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  {heroContent.badge}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <BrandLogo
                    variant="header"
                    className="w-full sm:w-auto"
                    textClassName="text-left"
                  />
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("auth.shared.trust.businesses")}
                  </div>
                </div>

                <div className="max-w-2xl space-y-4">
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-[2.85rem]">
                    {heroContent.title}
                  </h1>
                  <p className="max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                    {heroContent.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {benefits.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/78 px-4 py-3 shadow-[0_18px_44px_-36px_rgba(15,23,42,0.32)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-32px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-white/6"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[20rem] rounded-[1.75rem] border border-white/70 bg-slate-950/[0.035] p-5 dark:border-white/10 dark:bg-white/[0.035]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      {heroContent.firstMetricLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {heroContent.firstMetricValue}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300">
                      <TrendingUp className="h-4 w-4" />
                      {t("auth.shared.stats.healthyGrowth")}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/6">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                      {heroContent.secondMetricLabel}
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      {heroContent.secondMetricValue}
                    </p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300">
                      <ShieldCheck className="h-4 w-4" />
                      {t("auth.shared.stats.syncedLive")}
                    </p>
                  </div>
                </div>

                {floatingCards.map(
                  ({ icon: Icon, title, value, accent, position, animationDelay }) => (
                    <div
                      key={title}
                      className={cn(
                        "rounded-[1.35rem] border border-white/75 bg-gradient-to-br px-4 py-3 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.38)] backdrop-blur-xl dark:border-white/10 dark:bg-white/8",
                        accent,
                        position,
                      )}
                      style={{
                        animation: "authFloat 6.8s ease-in-out infinite",
                        animationDelay,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-slate-900 shadow-sm dark:bg-white/15 dark:text-white">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                            {title}
                          </p>
                          <p className="mt-1 text-lg font-semibold tracking-tight text-current">
                            {value}
                          </p>
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>

          <section className="flex items-center">
            <div
              className="w-full rounded-[2rem] border border-white/60 bg-white/72 p-5 shadow-[0_34px_100px_-56px_rgba(15,23,42,0.4)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/6 sm:p-6 lg:p-8"
              style={{ animation: "authReveal 520ms ease-out" }}
            >
              <div className="mb-6 flex flex-col gap-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {view === "login"
                      ? t("auth.loginPage.formKicker")
                      : t("auth.registerPage.formKicker")}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-[2rem]">
                    {view === "login"
                      ? t("auth.loginPage.formTitle")
                      : t("auth.registerPage.formTitle")}
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {view === "login"
                      ? t("auth.loginPage.formDescription")
                      : t("auth.registerPage.formDescription")}
                  </p>
                </div>

                <div
                  className="inline-flex w-full rounded-2xl border border-white/70 bg-slate-950/[0.035] p-1.5 dark:border-white/10 dark:bg-white/[0.045] sm:w-auto"
                  role="tablist"
                  aria-label={t("auth.shared.authTabs")}
                >
                  <Button
                    type="button"
                    variant={view === "login" ? "default" : "ghost"}
                    className={cn(
                      "h-10 flex-1 rounded-xl px-5 text-sm font-semibold transition-all duration-200 sm:flex-none",
                      view === "login"
                        ? "shadow-[0_16px_32px_-22px_rgba(2,132,199,0.58)]"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                    )}
                    onClick={() => setView("login")}
                    role="tab"
                    aria-selected={view === "login"}
                    aria-controls="auth-panel-login"
                    id="auth-tab-login"
                  >
                    {t("auth.shared.loginTab")}
                  </Button>
                  <Button
                    type="button"
                    variant={view === "signup" ? "default" : "ghost"}
                    className={cn(
                      "h-10 flex-1 rounded-xl px-5 text-sm font-semibold transition-all duration-200 sm:flex-none",
                      view === "signup"
                        ? "shadow-[0_16px_32px_-22px_rgba(2,132,199,0.58)]"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
                    )}
                    onClick={() => setView("signup")}
                    role="tab"
                    aria-selected={view === "signup"}
                    aria-controls="auth-panel-signup"
                    id="auth-tab-signup"
                  >
                    {t("auth.shared.signupTab")}
                  </Button>
                </div>
              </div>

              <div className="relative min-h-[50rem] sm:min-h-[54rem]">
                <div
                  id="auth-panel-login"
                  role="tabpanel"
                  aria-labelledby="auth-tab-login"
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
                  id="auth-panel-signup"
                  role="tabpanel"
                  aria-labelledby="auth-tab-signup"
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

              <div className="mt-6 space-y-4 border-t border-white/60 pt-6 dark:border-white/10">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {trustPills.map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/70 px-3 py-2.5 text-xs font-medium text-slate-600 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                    >
                      <Icon className="h-4 w-4 text-primary" />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  {view === "login"
                    ? t("auth.loginPage.footerPrompt")
                    : t("auth.registerPage.footerPrompt")}{" "}
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
                  <p className="text-center text-sm text-muted-foreground">
                    {t("auth.shared.workerPrompt")}{" "}
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
          </section>
        </div>
      </div>

      <style>{`
        @keyframes authFloat {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes authReveal {
          0% {
            opacity: 0;
            transform: translateY(16px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default AuthPageContent;
