"use client";

import {
  Globe2,
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Benefits = () => {
  const { t } = useI18n();

  const benefits = [
    {
      title: t("landing.usp.items.platformTitle"),
      description: t("landing.usp.items.platformDescription"),
      icon: LayoutDashboard,
    },
    {
      title: t("landing.usp.items.gstTitle"),
      description: t("landing.usp.items.gstDescription"),
      icon: WalletCards,
    },
    {
      title: t("landing.usp.items.simpleTitle"),
      description: t("landing.usp.items.simpleDescription"),
      icon: Sparkles,
    },
    {
      title: t("landing.usp.items.insightsTitle"),
      description: t("landing.usp.items.insightsDescription"),
      icon: TrendingUp,
    },
    {
      title: t("landing.usp.items.languageTitle"),
      description: t("landing.usp.items.languageDescription"),
      icon: Globe2,
    },
  ];

  return (
    <section className="bg-[#f8fbff] py-20 text-foreground">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a8ea4]">
            {t("landing.usp.kicker")}
          </p>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-[#10233f] sm:text-4xl">
            {t("landing.usp.title")}
          </h2>
          <p className="max-w-2xl text-base leading-7 text-[#627890]">
            {t("landing.usp.description")}
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-[1.75rem] border border-[#dce7f1] bg-white px-5 py-6 shadow-[0_24px_60px_-46px_rgba(18,61,101,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-46px_rgba(18,61,101,0.34)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123d65] text-white shadow-[0_18px_36px_-28px_rgba(18,61,101,0.52)]">
                <benefit.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-[#10233f]">
                {benefit.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[#627890]">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Benefits;
