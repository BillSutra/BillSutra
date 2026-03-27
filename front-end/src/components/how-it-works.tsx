"use client";

import {
  BadgeCheck,
  Boxes,
  Building2,
  ChartColumnBig,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/providers/LanguageProvider";

const HowItWorks = () => {
  const { t } = useI18n();

  const steps = [
    {
      step: t("landing.howItWorks.steps.one.step"),
      title: t("landing.howItWorks.steps.one.title"),
      description: t("landing.howItWorks.steps.one.description"),
      icon: Building2,
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
      icon: ChartColumnBig,
    },
  ];

  return (
    <section id="how-it-works" className="bg-white py-20 text-foreground">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a8ea4]">
            {t("landing.howItWorks.kicker")}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#10233f] sm:text-4xl">
            {t("landing.howItWorks.title")}
          </h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map((step) => (
            <Card
              key={step.step}
              className="relative overflow-hidden rounded-[1.75rem] border border-[#dce7f1] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_24px_60px_-46px_rgba(18,61,101,0.28)]"
            >
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123d65] text-white shadow-[0_18px_36px_-28px_rgba(18,61,101,0.52)]">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#7a8ea4]">
                  {step.step}
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-[#10233f]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-[#627890]">
                  {step.description}
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#d7e4f1] bg-white/90 px-3 py-1.5 text-xs font-medium text-[#4f6882]">
                  <BadgeCheck className="h-3.5 w-3.5 text-[#2f8f68]" />
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
