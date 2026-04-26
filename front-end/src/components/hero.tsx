"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Hero = () => {
  const { t } = useI18n();

  const trustBadges = [
    {
      icon: Zap,
      label: t("landing.hero.fast"),
    },
    {
      icon: ShieldCheck,
      label: t("landing.hero.secure"),
    },
    {
      icon: CheckCircle2,
      label: t("landing.hero.reliable"),
    },
  ];

  const metrics = [
    {
      label: t("landing.hero.metricOneLabel"),
      value: t("landing.hero.metricOneValue"),
      tone: "text-blue-500 dark:text-blue-400",
    },
    {
      label: t("landing.hero.metricTwoLabel"),
      value: t("landing.hero.metricTwoValue"),
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("landing.hero.metricThreeLabel"),
      value: t("landing.hero.metricThreeValue"),
      tone: "text-amber-600 dark:text-amber-400",
    },
  ];

  const workflow = [
    {
      title: t("landing.hero.flowOneTitle"),
      description: t("landing.hero.flowOneDescription"),
      status: t("landing.hero.flowOneStatus"),
    },
    {
      title: t("landing.hero.flowTwoTitle"),
      description: t("landing.hero.flowTwoDescription"),
      status: t("landing.hero.flowTwoStatus"),
    },
    {
      title: t("landing.hero.flowThreeTitle"),
      description: t("landing.hero.flowThreeDescription"),
      status: t("landing.hero.flowThreeStatus"),
    },
  ];

  return (
    <section className="relative overflow-hidden border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_22%),linear-gradient(180deg,#f7fbff_0%,#f3f7fb_42%,#ffffff_100%)] pb-20 pt-10 text-foreground dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_22%),linear-gradient(180deg,#09090b_0%,#111113_44%,#18181b_100%)] sm:pb-24 sm:pt-14">
      <div className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgba(18,61,101,0.08)_1px,transparent_1px)] [background-size:24px_24px] dark:opacity-25 dark:[background-image:radial-gradient(rgba(161,161,170,0.2)_1px,transparent_1px)]" />

      <div className="mx-auto grid w-full max-w-7xl gap-14 px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/92 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-[0_18px_40px_-30px_rgba(37,99,235,0.35)] dark:border-blue-500/20 dark:bg-zinc-900/92 dark:text-zinc-300 dark:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)]">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {t("landing.hero.kicker")}
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 dark:text-white md:text-5xl lg:text-[4rem]">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-zinc-400 sm:text-lg">
              {t("landing.hero.description")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-500"
            >
              <Link href="/register">
                {t("landing.hero.primaryCta")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl border-zinc-300 bg-white/90 px-6 text-slate-900 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              <Link href="#product">
                <PlayCircle className="h-4 w-4" />
                {t("landing.hero.secondaryCta")}
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/88 px-4 py-4 text-sm font-medium text-slate-700 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.18)] transition-all duration-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.5)]"
              >
                <badge.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-zinc-400">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t("landing.hero.trustedBy")}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              {t("landing.hero.lossAversion")}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-4 top-10 hidden rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900/96 dark:shadow-[0_20px_46px_-34px_rgba(0,0,0,0.58)] lg:block">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {t("landing.hero.miniCardLabel")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {t("landing.hero.miniCardValue")}
            </p>
          </div>

          <div className="absolute -bottom-5 right-4 hidden rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900/96 dark:shadow-[0_20px_46px_-34px_rgba(0,0,0,0.58)] lg:block">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {t("landing.hero.miniCardTwoLabel")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
              {t("landing.hero.miniCardTwoValue")}
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/82 p-4 shadow-[0_40px_90px_-54px_rgba(15,23,42,0.28)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/92 dark:shadow-[0_34px_84px_-48px_rgba(0,0,0,0.62)] sm:p-5">
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    {t("landing.hero.previewLabel")}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    {t("landing.hero.previewTitle")}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    {t("landing.hero.previewSubtitle")}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  {t("landing.hero.live")}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      {metric.label}
                    </p>
                    <p className={`mt-3 text-2xl font-semibold ${metric.tone}`}>
                      {metric.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {t("landing.hero.chartTitle")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("landing.hero.chartRange")}
                      </p>
                    </div>
                    <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {t("landing.hero.chartBadge")}
                    </div>
                  </div>
                  <div className="mt-6 flex h-44 items-end gap-3">
                    {[44, 56, 63, 58, 78, 72, 92].map((height, index) => (
                      <div
                        key={`${height}-${index}`}
                        className="flex flex-1 flex-col items-center gap-2"
                      >
                        <div
                          className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#2563eb_0%,#60a5fa_100%)]"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
                          {t(`landing.hero.chartLabels.${index + 1}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        {t("landing.hero.sidePanelTitle")}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("landing.hero.sidePanelDescription")}
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {workflow.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-zinc-500">
                              {item.description}
                            </p>
                          </div>
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
