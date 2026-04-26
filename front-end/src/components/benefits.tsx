"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  PackageX,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Benefits = () => {
  const { t } = useI18n();

  const painPoints = [
    {
      icon: Clock3,
      title: t("landing.problem.items.one"),
      description: t("landing.problem.agitations.one"),
    },
    {
      icon: PackageX,
      title: t("landing.problem.items.two"),
      description: t("landing.problem.agitations.two"),
    },
    {
      icon: Wallet,
      title: t("landing.problem.items.three"),
      description: t("landing.problem.agitations.three"),
    },
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
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 lg:grid-cols-[0.94fr_1.06fr]">
        <div className="rounded-[2.1rem] border border-rose-200/80 bg-[linear-gradient(180deg,#fff7f7_0%,#fff1f2_100%)] p-7 shadow-[0_26px_54px_-40px_rgba(225,29,72,0.14)] dark:border-rose-500/20 dark:bg-rose-500/8 dark:shadow-[0_20px_48px_-38px_rgba(0,0,0,0.48)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-rose-600 dark:bg-zinc-900 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5" />
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
                key={item.title}
                className="rounded-[1.45rem] border border-white/90 bg-white/94 px-4 py-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.1)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_14px_30px_-26px_rgba(0,0,0,0.42)]"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/12 dark:text-rose-300">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[1.55rem] border border-amber-200 bg-amber-50 px-5 py-5 shadow-[0_18px_34px_-28px_rgba(245,158,11,0.16)] dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("landing.problem.lossTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-700 dark:text-amber-200/90">
              {t("landing.problem.lossDescription")}
            </p>
          </div>
        </div>

        <div className="rounded-[2.1rem] border border-blue-200/70 bg-white p-7 shadow-[0_28px_58px_-42px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_22px_50px_-40px_rgba(0,0,0,0.52)]">
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
                className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_18px_36px_-28px_rgba(37,99,235,0.14)] dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-500/20"
              >
                <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-zinc-300">
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.7rem] border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_52%,#eef2ff_100%)] p-6 dark:border-zinc-800 dark:bg-[linear-gradient(135deg,#111827_0%,#18181b_100%)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              {t("landing.problem.promiseLabel")}
            </p>
            <p className="mt-3 text-xl font-semibold text-slate-950 dark:text-white">
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
