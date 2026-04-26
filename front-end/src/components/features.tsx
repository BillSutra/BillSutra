"use client";

import {
  BarChart3,
  Bot,
  Boxes,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";
import FeatureCard from "@/components/feature-card";

const Features = () => {
  const { t } = useI18n();

  const features = [
    {
      title: t("landing.features.items.simpleBillingTitle"),
      description: t("landing.features.items.simpleBillingDescription"),
      icon: Sparkles,
      tone:
        "border-blue-200 bg-[linear-gradient(135deg,#eff6ff,#dbeafe)] text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300",
    },
    {
      title: t("landing.features.items.inventoryManagementTitle"),
      description: t("landing.features.items.inventoryManagementDescription"),
      icon: Boxes,
      tone:
        "border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#d1fae5)] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
    {
      title: t("landing.features.items.analyticsDashboardTitle"),
      description: t("landing.features.items.analyticsDashboardDescription"),
      icon: BarChart3,
      tone:
        "border-violet-200 bg-[linear-gradient(135deg,#f5f3ff,#ede9fe)] text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    },
    {
      title: t("landing.features.items.gstInvoicesTitle"),
      description: t("landing.features.items.gstInvoicesDescription"),
      icon: ReceiptText,
      tone:
        "border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#ffedd5)] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    },
    {
      title: t("landing.features.items.aiAssistantTitle"),
      description: t("landing.features.items.aiAssistantDescription"),
      icon: Bot,
      tone:
        "border-fuchsia-200 bg-[linear-gradient(135deg,#fdf4ff,#fae8ff)] text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-300",
    },
    {
      title: t("landing.features.items.secureReliableTitle"),
      description: t("landing.features.items.secureReliableDescription"),
      icon: ShieldCheck,
      tone:
        "border-slate-200 bg-[linear-gradient(135deg,#f8fafc,#e2e8f0)] text-slate-700 dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300",
    },
  ];

  return (
    <section id="features" className="bg-background py-20 text-foreground sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              {t("landing.features.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {t("landing.features.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-zinc-400">
              {t("landing.features.description")}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            <Sparkles className="h-4 w-4" />
            {t("landing.features.trustedBy")}
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              eyebrow={t("landing.features.cardEyebrow")}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
              tone={feature.tone}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
