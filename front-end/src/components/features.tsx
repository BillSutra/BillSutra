"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  Bot,
  Boxes,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Features = () => {
  const { t } = useI18n();

  const features = [
    {
      title: t("landing.features.items.simpleBillingTitle"),
      description: t("landing.features.items.simpleBillingDescription"),
      icon: Sparkles,
    },
    {
      title: t("landing.features.items.inventoryManagementTitle"),
      description: t("landing.features.items.inventoryManagementDescription"),
      icon: Boxes,
    },
    {
      title: t("landing.features.items.analyticsDashboardTitle"),
      description: t("landing.features.items.analyticsDashboardDescription"),
      icon: BarChart3,
    },
    {
      title: t("landing.features.items.gstInvoicesTitle"),
      description: t("landing.features.items.gstInvoicesDescription"),
      icon: ReceiptText,
    },
    {
      title: t("landing.features.items.aiAssistantTitle"),
      description: t("landing.features.items.aiAssistantDescription"),
      icon: Bot,
    },
    {
      title: t("landing.features.items.secureReliableTitle"),
      description: t("landing.features.items.secureReliableDescription"),
      icon: ShieldCheck,
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
            <Card
              key={feature.title}
              className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_56px_-42px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_30px_66px_-40px_rgba(37,99,235,0.16)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-blue-500/20 dark:hover:shadow-[0_24px_58px_-40px_rgba(0,0,0,0.54)]"
            >
              <CardContent className="relative flex h-full flex-col gap-4 p-6">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.12),rgba(37,99,235,0))] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-[0_18px_36px_-28px_rgba(37,99,235,0.5)]">
                  <feature.icon size={20} />
                </span>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  {t("landing.features.cardEyebrow")}
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-slate-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
