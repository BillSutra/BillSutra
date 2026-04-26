"use client";

import { AlertTriangle, CheckCircle2, Sparkles, TrendingDown } from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Benefits = () => {
  const { t } = useI18n();

  const painPoints = [
    t("landing.problem.items.one"),
    t("landing.problem.items.two"),
    t("landing.problem.items.three"),
  ];

  const solutionPoints = [
    t("landing.problem.solutionOne"),
    t("landing.problem.solutionTwo"),
    t("landing.problem.solutionThree"),
  ];

  return (
    <section
      id="solutions"
      className="bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] py-20 text-foreground dark:bg-[linear-gradient(180deg,#111113_0%,#18181b_100%)]"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-rose-200/70 bg-rose-50/80 p-7 shadow-[0_24px_54px_-40px_rgba(225,29,72,0.18)] dark:border-rose-500/20 dark:bg-rose-500/8 dark:shadow-[0_20px_48px_-38px_rgba(0,0,0,0.48)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 dark:bg-zinc-900 dark:text-rose-300">
            <TrendingDown className="h-3.5 w-3.5" />
            {t("landing.problem.kicker")}
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.problem.title")}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.problem.description")}
          </p>

          <div className="mt-6 space-y-3">
            {painPoints.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/80 bg-white/88 px-4 py-4 text-sm text-slate-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("landing.problem.lossTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-200/90">
              {t("landing.problem.lossDescription")}
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-blue-200/70 bg-white p-7 shadow-[0_26px_58px_-42px_rgba(37,99,235,0.16)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_22px_50px_-40px_rgba(0,0,0,0.52)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            {t("landing.problem.solutionKicker")}
          </div>
          <h3 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.problem.solutionTitle")}
          </h3>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.problem.solutionDescription")}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {solutionPoints.map((item) => (
              <div
                key={item}
                className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-500/20"
              >
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-zinc-300">
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] p-5 dark:border-zinc-800 dark:bg-[linear-gradient(135deg,#111827_0%,#18181b_100%)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {t("landing.problem.promiseLabel")}
            </p>
            <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
              {t("landing.problem.promiseTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-zinc-400">
              {t("landing.problem.promiseDescription")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
