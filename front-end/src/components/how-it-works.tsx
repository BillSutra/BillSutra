"use client";

import { BadgeCheck, Boxes, ReceiptText, UserPlus2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/providers/LanguageProvider";

const HowItWorks = () => {
  const { t } = useI18n();

  const steps = [
    {
      step: t("landing.howItWorks.steps.one.step"),
      title: t("landing.howItWorks.steps.one.title"),
      description: t("landing.howItWorks.steps.one.description"),
      icon: UserPlus2,
    },
    {
      step: t("landing.howItWorks.steps.two.step"),
      title: t("landing.howItWorks.steps.two.title"),
      description: t("landing.howItWorks.steps.two.description"),
      icon: Boxes,
    },
    {
      step: t("landing.howItWorks.steps.three.step"),
      title: t("landing.howItWorks.steps.three.title"),
      description: t("landing.howItWorks.steps.three.description"),
      icon: ReceiptText,
    },
  ];

  return (
    <section id="how-it-works" className="bg-background py-20 text-foreground">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
            {t("landing.howItWorks.kicker")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            {t("landing.howItWorks.title")}
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-600 dark:text-zinc-400">
            {t("landing.howItWorks.description")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <Card
              key={step.step}
              className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_60px_-46px_rgba(15,23,42,0.12)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_22px_52px_-42px_rgba(0,0,0,0.48)]"
            >
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_18px_36px_-28px_rgba(37,99,235,0.52)]">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  {step.step}
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  {step.description}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t("landing.howItWorks.stepReady")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
