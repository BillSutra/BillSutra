"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/providers/LanguageProvider";

const Hero = () => {
  const { t } = useI18n();
  const chartHeights = [46, 58, 63, 60, 80, 74, 96];
  const chartLineOffsets = [78, 66, 58, 61, 38, 46, 22];

  const trustBadges = [
    { icon: Zap, label: t("landing.hero.fast") },
    { icon: ShieldCheck, label: t("landing.hero.secure") },
    { icon: Sparkles, label: t("landing.hero.reliable") },
  ];

  const metrics = [
    {
      label: t("landing.hero.metricOneLabel"),
      value: t("landing.hero.metricOneValue"),
      tone:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    },
    {
      label: t("landing.hero.metricTwoLabel"),
      value: t("landing.hero.metricTwoValue"),
      tone:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      label: t("landing.hero.metricThreeLabel"),
      value: t("landing.hero.metricThreeValue"),
      tone:
        "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    },
  ];

  const priorityCards = [
    {
      title: t("landing.hero.flowOneTitle"),
      description: t("landing.hero.flowOneDescription"),
      status: t("landing.hero.flowOneStatus"),
      accent:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      title: t("landing.hero.flowTwoTitle"),
      description: t("landing.hero.flowTwoDescription"),
      status: t("landing.hero.flowTwoStatus"),
      accent:
        "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300",
    },
    {
      title: t("landing.hero.flowThreeTitle"),
      description: t("landing.hero.flowThreeDescription"),
      status: t("landing.hero.flowThreeStatus"),
      accent:
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    },
  ];

  return (
    <section className="relative overflow-hidden border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.18),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_48%,#ffffff_100%)] pb-18 pt-12 text-foreground dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(129,140,248,0.16),transparent_24%),linear-gradient(180deg,#09090b_0%,#111113_44%,#18181b_100%)] sm:pb-24 sm:pt-16">
      <div className="absolute inset-0 -z-10 opacity-60 [background-image:radial-gradient(rgba(37,99,235,0.08)_1px,transparent_1px)] [background-size:24px_24px] dark:opacity-25 dark:[background-image:radial-gradient(rgba(161,161,170,0.2)_1px,transparent_1px)]" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6">
        <div className="max-w-3xl space-y-8 lg:max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/92 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 shadow-[0_18px_40px_-30px_rgba(37,99,235,0.25)] dark:border-blue-500/20 dark:bg-zinc-900/92 dark:text-blue-300 dark:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.5)]">
            <Sparkles className="h-3.5 w-3.5" />
            {t("landing.hero.kicker")}
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-slate-950 dark:text-white md:text-5xl lg:text-[4.25rem]">
              {t("landing.hero.title")}
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-zinc-400 sm:text-lg">
              {t("landing.hero.description")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t("landing.hero.trustedBy")}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              {t("landing.hero.urgency")}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl px-6 text-white"
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
              className="h-12 rounded-xl border-slate-200 bg-white/90 px-6 text-slate-900 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              <Link href="#product">
                <PlayCircle className="h-4 w-4" />
                {t("landing.hero.secondaryCta")}
              </Link>
            </Button>
          </div>

          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">
            {t("landing.hero.microNote")}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            {trustBadges.map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/88 px-4 py-4 text-sm font-medium text-slate-700 shadow-[0_20px_44px_-34px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_50px_-34px_rgba(37,99,235,0.16)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:shadow-[0_18px_42px_-34px_rgba(0,0,0,0.5)]"
              >
                <badge.icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl">
          <div className="absolute -left-5 top-8 hidden rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900/96 dark:shadow-[0_20px_46px_-34px_rgba(0,0,0,0.58)] lg:block">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              {t("landing.hero.miniCardLabel")}
            </p>
            <p className="mt-1 max-w-[14rem] text-sm font-semibold text-slate-900 dark:text-white">
              {t("landing.hero.miniCardValue")}
            </p>
          </div>

          <div className="absolute -right-3 bottom-8 hidden rounded-2xl border border-white/80 bg-white/92 px-4 py-3 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.18)] dark:border-zinc-800 dark:bg-zinc-900/96 dark:shadow-[0_20px_46px_-34px_rgba(0,0,0,0.58)] lg:block">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              {t("landing.hero.miniCardTwoLabel")}
            </p>
            <p className="mt-1 max-w-[14rem] text-sm font-semibold text-slate-900 dark:text-white">
              {t("landing.hero.miniCardTwoValue")}
            </p>
          </div>

          <div className="relative w-full rounded-[2.5rem] border border-white/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,0.84))] p-6 shadow-[0_60px_120px_-60px_rgba(37,99,235,0.3)] backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/92 dark:shadow-[0_34px_84px_-48px_rgba(0,0,0,0.62)] sm:p-8 lg:p-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.1),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(129,140,248,0.08),transparent_24%)]" />
            <div className="relative rounded-[2rem] border border-slate-200/90 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-zinc-800 dark:bg-zinc-950 sm:p-8 lg:p-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
                    {t("landing.hero.previewLabel")}
                  </p>
                  <p className="mt-1 text-[1.65rem] font-bold tracking-tight text-slate-950 dark:text-white sm:text-[1.85rem]">
                    {t("landing.hero.previewTitle")}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-zinc-400">
                    {t("landing.hero.previewSubtitle")}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 shadow-[0_12px_26px_-20px_rgba(16,185,129,0.2)] dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  {t("landing.hero.live")}
                </div>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-3">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-[0_16px_34px_-24px_rgba(15,23,42,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_42px_-24px_rgba(37,99,235,0.15)] dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                      {metric.label}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <p className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                        {metric.value}
                      </p>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${metric.tone}`}
                      >
                        {t("landing.hero.live")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[1.85rem] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_46px_-28px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 xl:col-span-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">
                        Sales (Last 7 days)
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        {t("landing.hero.chartRange")}
                      </p>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {t("landing.hero.chartBadge")}
                    </div>
                  </div>
                  <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] dark:border-zinc-800 dark:bg-[linear-gradient(180deg,#18181b_0%,#111113_100%)] sm:p-5">
                    <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
                      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500">
                          {t("landing.hero.chartRange")}
                        </p>
                        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                          ₹4.82L
                        </p>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          +12.4%
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500 sm:grid-cols-4">
                        <span>{t("landing.hero.metricOneLabel")}</span>
                        <span>{t("landing.hero.metricTwoLabel")}</span>
                        <span>{t("landing.hero.metricThreeLabel")}</span>
                        <span>Trend</span>
                      </div>
                    </div>
                    <div className="relative mt-5 h-64 rounded-[1.35rem] border border-slate-200 bg-white px-4 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-zinc-800 dark:bg-zinc-950 lg:h-72">
                      <div className="pointer-events-none absolute inset-x-4 top-3 bottom-10 grid grid-rows-5">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <div
                            key={index}
                            className="border-b border-dashed border-slate-200/80 dark:border-zinc-800"
                          />
                        ))}
                      </div>
                      <div className="pointer-events-none absolute inset-y-3 left-4 right-4 grid grid-cols-6">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <div
                            key={index}
                            className="border-r border-dashed border-slate-200/70 dark:border-zinc-800"
                          />
                        ))}
                      </div>
                      <div className="pointer-events-none absolute inset-x-4 bottom-10 h-24 rounded-t-[1.25rem] bg-[linear-gradient(180deg,rgba(59,130,246,0.14),rgba(59,130,246,0))]" />
                      <svg
                        viewBox="0 0 320 120"
                        className="pointer-events-none absolute inset-x-4 top-12 h-24 w-[calc(100%-2rem)]"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="heroPreviewLine" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#2563eb" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M0,72 C24,60 38,48 54,50 C72,52 84,62 106,56 C126,50 142,26 160,30 C182,36 198,48 214,44 C232,40 252,18 266,16 C286,14 300,24 320,8"
                          fill="none"
                          stroke="url(#heroPreviewLine)"
                          strokeWidth="4"
                          strokeLinecap="round"
                        />
                        {[0, 54, 106, 160, 214, 266, 320].map((pointX, index) => (
                          <circle
                            key={pointX}
                            cx={pointX}
                            cy={chartLineOffsets[index]}
                            r="4.5"
                            fill="#ffffff"
                            stroke="#2563eb"
                            strokeWidth="3"
                          />
                        ))}
                      </svg>
                      <div className="relative z-10 flex h-full items-end gap-3">
                        {chartHeights.map((height, index) => (
                          <div
                            key={`${height}-${index}`}
                            className="flex flex-1 flex-col items-center gap-2"
                          >
                            <div
                              className="relative w-full overflow-hidden rounded-t-2xl bg-[linear-gradient(180deg,#2563eb_0%,#60a5fa_100%)] shadow-[0_18px_30px_-24px_rgba(37,99,235,0.42)]"
                              style={{ height: `${height}%` }}
                            >
                              <div className="absolute inset-x-0 top-0 h-8 bg-white/20" />
                            </div>
                            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400 dark:text-zinc-500">
                              {t(`landing.hero.chartLabels.${index + 1}`)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.85rem] border border-slate-200 bg-white p-5 shadow-[0_18px_38px_-28px_rgba(15,23,42,0.1)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_26px_46px_-28px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-900 sm:p-6 xl:col-span-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-950 dark:text-white">
                        {t("landing.hero.sidePanelTitle")}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        {t("landing.hero.sidePanelDescription")}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2563eb,#6366f1)] text-white shadow-[0_18px_32px_-24px_rgba(37,99,235,0.42)]">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    {priorityCards.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-[1.35rem] border border-slate-200 bg-slate-50/90 px-4 py-4 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-blue-200 hover:bg-white hover:shadow-[0_18px_34px_-22px_rgba(37,99,235,0.12)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-500/20 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {item.title}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="h-12 w-px rounded-full bg-slate-200 dark:bg-zinc-800" />
                            <span
                              className={`inline-flex min-w-[5.9rem] justify-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${item.accent}`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[1.35rem] border border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] px-4 py-4 shadow-[0_16px_30px_-24px_rgba(37,99,235,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-24px_rgba(37,99,235,0.16)] dark:border-blue-500/20 dark:bg-[linear-gradient(135deg,#0f172a_0%,#18181b_100%)]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-[0_16px_28px_-22px_rgba(37,99,235,0.42)]">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">
                          {t("landing.hero.aiInsightTitle")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                          {t("landing.hero.aiInsightDescription")}
                        </p>
                      </div>
                    </div>
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
