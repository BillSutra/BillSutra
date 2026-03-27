"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Bot,
  Boxes,
  LineChart,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useI18n } from "@/providers/LanguageProvider";

const Features = () => {
  const { t } = useI18n();

  const features = [
    {
      title: t("landing.features.items.invoiceManagementTitle"),
      description: t("landing.features.items.invoiceManagementDescription"),
      icon: ReceiptText,
    },
    {
      title: t("landing.features.items.inventoryTrackingTitle"),
      description: t("landing.features.items.inventoryTrackingDescription"),
      icon: Boxes,
    },
    {
      title: t("landing.features.items.clientSupplierTitle"),
      description: t("landing.features.items.clientSupplierDescription"),
      icon: UsersRound,
    },
    {
      title: t("landing.features.items.insightsTitle"),
      description: t("landing.features.items.insightsDescription"),
      icon: LineChart,
    },
    {
      title: t("landing.features.items.gstSupportTitle"),
      description: t("landing.features.items.gstSupportDescription"),
      icon: ShieldCheck,
    },
    {
      title: t("landing.features.items.smartAssistantTitle"),
      description: t("landing.features.items.smartAssistantDescription"),
      icon: Bot,
    },
  ];

  return (
    <section id="features" className="bg-white py-20 text-foreground sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7a8ea4]">
              {t("landing.features.kicker")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#10233f] sm:text-4xl">
              {t("landing.features.title")}
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#627890]">
              {t("landing.features.description")}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dce7f1] bg-[#f8fbff] px-4 py-2 text-sm font-medium text-[#4f6882]">
            <Sparkles className="h-4 w-4 text-[#123d65]" />
            {t("landing.features.trustedBy")}
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="group overflow-hidden rounded-[1.75rem] border border-[#dce7f1] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] shadow-[0_24px_60px_-46px_rgba(18,61,101,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-[#bfd3e7] hover:shadow-[0_30px_80px_-44px_rgba(18,61,101,0.38)]"
            >
              <CardContent className="relative flex h-full flex-col gap-4 p-6">
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_center,rgba(18,61,101,0.12),rgba(18,61,101,0))] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123d65] text-white shadow-[0_18px_36px_-28px_rgba(18,61,101,0.55)]">
                  <feature.icon size={20} />
                </span>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7558]">
                  <WalletCards className="h-3.5 w-3.5" />
                  {t("landing.features.cardEyebrow")}
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-[#10233f]">
                  {feature.title}
                </h3>
                <p className="text-sm leading-6 text-[#627890]">
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
